"""Exact isolation, immutable source and deterministic YouTube profile checks."""
import hashlib
import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location("youtube_build", ROOT / "native/v3/build_youtube_canary.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


def effective(text):
    return [line.strip() for line in text.splitlines() if line.strip() and not line.lstrip().startswith("#")]


def section(text, name):
    return text.split(name, 1)[1].split("\n[", 1)[0]


def hooks(text):
    return {line.split(" = ", 1)[0]: line for line in text.splitlines() if " = type=" in line}


class YouTubeCanaryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = (ROOT / "build/khanh-rocket-v3-test.conf").read_text()
        cls.profiles = build.render()
        cls.compat = cls.profiles["khanh-rocket-youtube-v3-canary.conf"]
        cls.only = cls.profiles["khanh-rocket-youtube-only-v3.conf"]

    def test_compat_changes_only_the_browse_script_uri(self):
        base, canary = effective(self.base), effective(self.compat)
        self.assertEqual(len(base), len(canary))
        changes = [(a, b) for a, b in zip(base, canary) if a != b]
        self.assertEqual(len(changes), 1)
        old, new = changes[0]
        self.assertTrue(old.startswith("youtube.native.browse = "))
        self.assertEqual(old.split("script-path=")[0], new.split("script-path=")[0])
        self.assertIn("/native/v3/scripts/youtube-feed-filter.js", new)

    def test_player_and_fourteen_other_hooks_remain_exact(self):
        before, after = hooks(self.base), hooks(self.compat)
        self.assertEqual(len(after), 15)
        for name, line in before.items():
            if name != "youtube.native.browse":
                self.assertEqual(after[name], line)
        self.assertEqual(hooks(self.only)["youtube.native.response"], before["youtube.native.response"])
        self.assertEqual(build.blob((ROOT / "native/v2/scripts/youtube-player-protobuf.js").read_bytes()),
                         "d0dea75aeb1a86bb85b234a5ed2aa22eee31b315")

    def test_existing_rules_rewrites_map_local_and_mitm_are_preserved(self):
        for name in ("[Rule]", "[Header Rewrite]", "[Url Rewrite]", "[Map Local]", "[MITM]"):
            self.assertEqual(section(self.compat, name), section(self.base, name))
        for name in ("[Rule]", "[Url Rewrite]", "[Map Local]"):
            self.assertEqual(effective(section(self.only, name)), effective(section(self.base, name)))

    def test_youtube_only_has_two_hooks_and_no_other_app_hosts(self):
        self.assertEqual(set(hooks(self.only)), {"youtube.native.response", "youtube.native.browse"})
        self.assertEqual(section(self.only, "[MITM]").strip(),
                         "hostname = *.googlevideo.com, youtubei.googleapis.com, www.youtube.com, s.youtube.com")
        self.assertNotIn("[Header Rewrite]", self.only)
        for host in ("revenuecat", "spotify", "soundcloud", "khanh.invalid", "truecaller"):
            self.assertNotIn(host, self.only)

    def test_feed_and_player_hook_patterns_never_overlap(self):
        patterns = {}
        for name, line in hooks(self.only).items():
            pattern = re.search(r"pattern=([^,]+)", line).group(1).replace("\\\\", "\\")
            patterns[name] = re.compile(pattern)
            self.assertIn("binary-body-mode=1", line)
            self.assertIn("max-size=5242880", line)
        for endpoint in ("player", "get_watch", "reel/reel_watch_sequence", "browse", "next", "search", "guide"):
            for suffix in ("", "?synthetic=1"):
                url = "https://youtubei.googleapis.com/youtubei/v1/" + endpoint + suffix
                matched = [name for name, pattern in patterns.items() if pattern.search(url)]
                if endpoint == "guide":
                    self.assertEqual(matched, [])
                else:
                    expected = "youtube.native.browse" if endpoint in ("browse", "next", "search") else "youtube.native.response"
                    self.assertEqual(matched, [expected])

    def test_sources_and_all_three_protected_profile_blobs_are_exact(self):
        lock = build.verify_sources()
        self.assertRegex(lock["ref"], r"^[0-9a-f]{40}$")
        for path, expected in build.PROTECTED.items():
            self.assertEqual(build.blob((ROOT / path).read_bytes()), expected)

    def test_pin_hash_ref_and_inventory_drift_fail(self):
        original = json.loads(build.LOCK.read_text())
        for change in ({"ref": "main"}, {"ref": "0" * 40}, {"path": "native/v2/scripts/youtube-player-protobuf.js"},
                       {"sha256": "0" * 64}, {"git_blob_sha1": "0" * 40}):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as td:
                lock = Path(td) / "lock.json"
                lock.write_text(json.dumps({**original, **change}))
                with patch.object(build, "LOCK", lock):
                    with self.assertRaises(ValueError):
                        build.verify_sources()

    def test_generation_targets_only_new_profiles_and_checked_in_builds_match(self):
        self.assertEqual(set(self.profiles), set(build.TARGETS))
        self.assertFalse(set(build.PROTECTED).intersection("build/" + name for name in self.profiles))
        for name, content in self.profiles.items():
            self.assertEqual((ROOT / "build" / name).read_text(), content)
        self.assertEqual(build.render(), self.profiles)

    def test_output_profile_drift_fails_check_without_rewriting_any_files(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "build").mkdir()
            for name, content in self.profiles.items():
                (root / "build" / name).write_text(content)
            changed = root / "build" / build.TARGETS[0]
            changed.write_text(changed.read_text().replace("max-size=5242880", "max-size=-1", 1))
            before = changed.read_bytes()
            with patch.object(build, "ROOT", root), patch.object(build, "render", return_value=self.profiles), \
                 patch("sys.argv", ["build_youtube_canary.py", "--check"]):
                with self.assertRaisesRegex(SystemExit, "stale YouTube canary"):
                    build.main()
            self.assertEqual(changed.read_bytes(), before)

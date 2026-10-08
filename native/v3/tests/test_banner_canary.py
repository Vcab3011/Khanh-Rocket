"""Protect V3 playback and all unrelated hooks while testing banners."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / "build" / "khanh-rocket-v3-test.conf"
BANNER = ROOT / "build" / "khanh-rocket-v3-banner-test.conf"
PRODUCTION = ROOT / "build" / "khanh-rocket.conf"
PIN = "9811b9d45503fe39b10177239856597c338b8bf1"


def effective(text):
    return [x.strip() for x in text.splitlines() if x.strip() and not x.lstrip().startswith("#")]


def name_to_line(lines):
    return {s.split(" = ", 1)[0]:s for s in lines if " = type=" in s}


class BannerCanaryIsolationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = BASE.read_text(encoding="utf-8")
        cls.banner = BANNER.read_text(encoding="utf-8")

    def test_only_youtube_browse_hook_differs(self):
        base = effective(self.base)
        banner = effective(self.banner)
        self.assertEqual(len(base), len(banner))
        changes = [(x, y) for x, y in zip(base, banner) if x != y]
        self.assertEqual(len(changes), 1, changes)
        a, b = changes[0]
        self.assertTrue(a.startswith("youtube.native.browse = "))
        self.assertTrue(b.startswith("youtube.native.browse = "))
        old_prefix = a.split("script-path=", 1)[0]
        new_prefix = b.split("script-path=", 1)[0]
        self.assertEqual(old_prefix, new_prefix)
        self.assertIn(f"/{PIN}/native/v3/scripts/youtube-banner-filter.js", b)

    def test_player_and_background_script_are_identical(self):
        a = name_to_line(effective(self.base))
        b = name_to_line(effective(self.banner))
        self.assertEqual(a["youtube.native.response"], b["youtube.native.response"])
        self.assertIn("/native/v2/scripts/youtube-player-protobuf.js", b["youtube.native.response"])

    def test_mitm_rules_and_other_scripts_identical(self):
        a = effective(self.base)
        b = effective(self.banner)
        for sec in ("[Rule]", "[Header Rewrite]", "[Url Rewrite]", "[Map Local]", "[MITM]"):
            self.assertEqual(
                self.base.split(sec, 1)[1].split("\n[", 1)[0],
                self.banner.split(sec, 1)[1].split("\n[", 1)[0],
                sec,
            )
        self.assertEqual(sum("script-path=" in x for x in b), 15)
        for key, original in name_to_line(a).items():
            if key != "youtube.native.browse":
                self.assertEqual(original, name_to_line(b)[key])

    def test_script_has_no_network_or_persistent_storage(self):
        js = (ROOT / "native" / "v3" / "scripts" / "youtube-banner-filter.js").read_text(encoding="utf-8")
        source = re.sub(r"/\*[\s\S]*?\*/", "", js)
        for forbidden in ("$task.fetch", "$httpClient", "$persistentStore", "$prefs", "XMLHttpRequest", "eval("):
            self.assertNotIn(forbidden, source)

    def test_original_main_baseline_never_modified(self):
        original = PRODUCTION.read_text(encoding="utf-8")
        lock = (ROOT / "native" / "fixtures" / "working-directives.lock").read_text(encoding="utf-8")
        self.assertEqual(effective(original), effective(lock))


if __name__ == "__main__":
    unittest.main()

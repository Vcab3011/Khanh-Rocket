"""Security/regression tests for independently generated Khanh Rocket V3 canaries."""
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "native" / "v3"))
from build_canary import build, FEATURES, source, V2_COMMIT, V3_COMMIT

V3 = ROOT / "native" / "v3" / "build"
PRODUCTION = ROOT / "build" / "khanh-rocket.conf"
LOCK = ROOT / "native" / "fixtures" / "working-directives.lock"
OWN_URL = re.compile(
    r"^https://raw\.githubusercontent\.com/Vcab3011/Khanh-Rocket/"
    r"([0-9a-f]{40})/native/v[23]/scripts/[a-z0-9-]+\.js$"
)


def effective(text):
    return [line.strip() for line in text.splitlines()
            if line.strip() and not line.strip().startswith("#")]


def script_lines(text):
    return text.split("[Script]", 1)[1].split("[Map Local]", 1)[0].strip().splitlines()


def sources(text):
    return [re.search(r"script-path=(https://[^,\s]+)", x).group(1)
            for x in script_lines(text) if "script-path=" in x]


class V3BuildTest(unittest.TestCase):
    def test_original_remains_unchanged(self):
        self.assertEqual(
            effective(PRODUCTION.read_text(encoding="utf-8")),
            effective(LOCK.read_text(encoding="utf-8")),
        )

    def test_generated_profiles_are_deterministic(self):
        for profile in ("privacy", "compat"):
            with self.subTest(profile=profile):
                actual = (V3 / f"{profile}-canary.conf").read_text(encoding="utf-8")
                self.assertEqual(actual, build(profile))

    def test_every_script_is_owned_and_commit_pinned(self):
        for profile, count in (("privacy", 3), ("compat", 14)):
            text = (V3 / f"{profile}-canary.conf").read_text(encoding="utf-8")
            links = sources(text)
            self.assertEqual(len(links), count)
            for uri in links:
                self.assertRegex(uri, OWN_URL)
                ref = OWN_URL.fullmatch(uri).group(1)
                self.assertIn(ref, {V2_COMMIT, V3_COMMIT})
            self.assertNotIn("sub.store", text)
            self.assertNotIn("%APPEND%", text)
            self.assertNotIn("/releases/latest/", text)
            self.assertNotIn("https://raw.githubusercontent.com/duyvinh09/", text)
            self.assertNotIn("https://raw.githubusercontent.com/app2smile/", text)

    def test_privacy_limits_mitm_scope(self):
        privacy = (V3 / "privacy-canary.conf").read_text(encoding="utf-8")
        hosts = privacy.split("hostname = ", 1)[1].splitlines()[0]
        self.assertNotIn("api.revenuecat.com", hosts)
        self.assertNotIn("api.picsart.com", hosts)
        self.assertNotIn("sub.store", hosts)
        self.assertIn("khanh.invalid", hosts)
        self.assertIn("youtubei.googleapis.com", hosts)

    def test_controls_switch_off_mitm_and_hooks_together(self):
        text = build("privacy", {"youtube", "spotify-url"})
        self.assertNotIn("googlevideo.com", text)
        self.assertNotIn("youtubei.googleapis.com", text)
        self.assertNotIn("spotify.com", text)
        self.assertEqual(len(sources(text)), 1)
        self.assertIn("hostname = khanh.invalid", text)

    def test_revenuecat_module_is_opt_in_and_limited(self):
        compat = build("compat", {"locket", "revenuecat-header"})
        self.assertNotIn("api.revenuecat.com", compat)
        self.assertNotIn("revenuecat =", compat)
        self.assertNotIn("deleteHeader =", compat)
        self.assertNotIn("x-revenuecat-etag", compat.lower())

    def test_external_or_mutable_git_refs_rejected(self):
        with self.assertRaises(ValueError):
            build("privacy", v3_ref="main")
        with self.assertRaises(ValueError):
            build("privacy", {"unknown"})
        with self.assertRaises(ValueError):
            build("bad-profile")

    def test_body_capture_limits_on_high_volume_paths(self):
        compat = build("compat")
        self.assertNotIn("max-size=-1", compat)
        self.assertIn("max-size=5242880", compat)
        self.assertIn("max-size=262144", compat)
        self.assertIn("max-size=131072", compat)
        self.assertIn("Native Offline Subscriptions", compat)


if __name__ == "__main__":
    unittest.main()

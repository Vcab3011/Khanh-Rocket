"""Static CI tests for isolated, non-invasive Egern lab modules."""
import re
import json
import unittest
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
MODULES = ROOT / "modules"
PINS = json.loads((ROOT / "supply-chain-lock.json").read_text())["script_blobs"]
OBS_SHA = PINS["lab/build/egern-observer.js"]["ref"]
WIDGET_SHA = PINS["lab/build/egern-status.js"]["ref"]
RESET_SHA = PINS["lab/build/egern-reset.js"]["ref"]
APP_HOSTS = {
    "egern-locket-observe.yaml": "api.revenuecat.com",
    "egern-soundcloud-observe.yaml": "api-mobile.soundcloud.com",
    "egern-youtube-observe.yaml": "youtubei.googleapis.com",
}

class ModulesTest(unittest.TestCase):
    def test_scoped_modules(self):
        for filename, host in APP_HOSTS.items():
            with self.subTest(filename=filename):
                source=(MODULES / filename).read_text(encoding="utf-8")
                config=yaml.safe_load(source)
                self.assertTrue(config["mitm"]["enabled"])
                self.assertEqual(config["mitm"]["hostnames"],[host])
                self.assertNotIn("ca_p12",source)
                self.assertNotIn("ca_passphrase",source)
                self.assertEqual(len(config["scriptings"]),1)
                script=config["scriptings"][0]["http_response"]
                re.compile(script["match"])
                self.assertIn("/" + OBS_SHA + "/lab/build/egern-observer.js",script["script_url"])
                self.assertEqual(script["update_interval"],86400)
                self.assertLessEqual(script["timeout"],10)
                self.assertNotIn("header_rewrites",config)
                self.assertNotIn("url_rewrites",config)
                self.assertNotIn("body_rewrites",config)
                self.assertNotIn("%APPEND%",source)
                self.assertNotIn("aqvpn",source.lower())
                if filename.endswith("youtube-observe.yaml"):
                    self.assertFalse(script["body_required"])
                else:
                    self.assertTrue(script["body_required"])
                    self.assertTrue(script["binary_body"])
                    self.assertLessEqual(script["max_size"],262144)

    def test_status_widget_does_not_request_mitm(self):
        data=yaml.safe_load((MODULES/"egern-observe-status.yaml").read_text(encoding="utf-8"))
        self.assertNotIn("mitm",data)
        self.assertEqual(len(data["scriptings"]),1)
        status=data["scriptings"][0]["generic"]
        self.assertIn("/" + WIDGET_SHA + "/lab/build/egern-status.js",status["script_url"])

    def test_reset_module_is_manual_and_has_no_mitm(self):
        data=yaml.safe_load((MODULES/"egern-observe-reset.yaml").read_text(encoding="utf-8"))
        self.assertNotIn("mitm",data)
        self.assertEqual(len(data["scriptings"]),1)
        reset=data["scriptings"][0]["generic"]
        self.assertIn("/" + RESET_SHA + "/lab/build/egern-reset.js",reset["script_url"])
        self.assertEqual(reset["update_interval"],86400)

    def test_no_production_files_edited_by_bundler(self):
        source=(ROOT/"tools/build_runtime.py").read_text(encoding="utf-8")
        self.assertNotIn("build/khanh-rocket.conf",source)
        self.assertNotIn("build/khanh-rocket-v3-test.conf",source)

    def test_module_patterns_match_only_documented_app_paths(self):
        paths = {
            "egern-locket-observe.yaml": ("https://api.revenuecat.com/v1/subscribers/synthetic-account",
                                           ["https://api.revenuecat.com/v2/subscribers/a", "https://api.revenuecat.com/v1/subscribers/a/more"]),
            "egern-soundcloud-observe.yaml": ("https://api-mobile.soundcloud.com/configuration/ios",
                                               ["https://api-mobile.soundcloud.com/configuration/ios/more"]),
            "egern-youtube-observe.yaml": ("https://youtubei.googleapis.com/youtubei/v1/player",
                                           ["https://youtubei.googleapis.com/youtubei/v1/player/more"]),
        }
        for name, (valid, rejected) in paths.items():
            hook = yaml.safe_load((MODULES / name).read_text())["scriptings"][0]["http_response"]
            pattern = re.compile(hook["match"])
            for url in [valid, valid + "?synthetic-query=1"]:
                self.assertIsNotNone(pattern.search(url))
            for url in [*rejected, valid.replace(".com/", ".com.evil.invalid/"), valid.replace("https://", "http://")]:
                self.assertIsNone(pattern.search(url))

if __name__=="__main__":
    unittest.main()

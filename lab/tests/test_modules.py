"""Static CI tests for isolated, non-invasive Egern lab modules."""
import re
import unittest
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
MODULES = ROOT / "modules"
OBS_SHA = "d735822182c8ea215739aa595f6cfff815ea8bac"
WIDGET_SHA = "64e4a8ff606a329ca6bedc750f8bed58c590feb6"
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
                    self.assertLessEqual(script["max_size"],262144)

    def test_status_widget_does_not_request_mitm(self):
        data=yaml.safe_load((MODULES/"egern-observe-status.yaml").read_text(encoding="utf-8"))
        self.assertNotIn("mitm",data)
        self.assertEqual(len(data["scriptings"]),1)
        status=data["scriptings"][0]["generic"]
        self.assertIn("/" + WIDGET_SHA + "/lab/build/egern-status.js",status["script_url"])

    def test_no_production_files_edited_by_bundler(self):
        source=(ROOT/"tools/build_runtime.py").read_text(encoding="utf-8")
        self.assertNotIn("build/khanh-rocket.conf",source)
        self.assertNotIn("build/khanh-rocket-v3-test.conf",source)

if __name__=="__main__":
    unittest.main()

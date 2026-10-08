"""Guard that experimental profiles never silently replace working 10in1.

Profiles are validated as source inventories; real device operation remains unverified.
"""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
NATIVE = ROOT / "native" / "v2" / "build" / "native-only-canary.conf"
HYBRID = ROOT / "native" / "v2" / "build" / "hybrid-canary.conf"
PRODUCTION = ROOT / "build" / "khanh-rocket.conf"
LOCK = ROOT / "native" / "fixtures" / "working-directives.lock"
PIN = "d7d43523dd973c0184a70a3398935c15eef96648"
OWNED_PREFIX = f"https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/{PIN}/native/v2/scripts/"

def directives(src):
    return [x.strip() for x in src.splitlines() if x.strip() and not x.lstrip().startswith("#")]

def hooks(text):
    section = False
    result = []
    for line in text.splitlines():
        if line.strip() == "[Script]":
            section = True
            continue
        if section and line.startswith("["):
            break
        if section and " = type=" in line and "script-path=" in line:
            result.append(line)
    return result

def sources(text):
    return [re.search(r"script-path=(https://[^,\s]+)", hook).group(1) for hook in hooks(text)]

class CanaryProfilesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.native = NATIVE.read_text(encoding="utf-8")
        cls.hybrid = HYBRID.read_text(encoding="utf-8")
        cls.prod = PRODUCTION.read_text(encoding="utf-8")

    def test_baseline_never_changed(self):
        self.assertEqual(directives(self.prod), directives(LOCK.read_text(encoding="utf-8")))

    def test_native_only_owns_every_js(self):
        files = sources(self.native)
        self.assertEqual(len(files), 13)
        self.assertTrue(all(f.startswith(OWNED_PREFIX) for f in files))
        self.assertNotIn("sub.store", self.native)
        self.assertNotIn("Sub-Store", self.native)
        self.assertNotIn("youtube.request =", self.native)
        self.assertIn("INCOMPLETE", self.native)

    def test_hybrid_explicitly_reports_upstream_dependencies(self):
        urls = sources(self.hybrid)
        self.assertEqual(len(urls), 17)
        self.assertEqual(sum(u.startswith(OWNED_PREFIX) for u in urls), 12)
        upstream = [u for u in urls if not u.startswith(OWNED_PREFIX)]
        self.assertEqual(len(upstream), 5)
        self.assertEqual(sum("sub-store-org" in u for u in upstream), 3)
        self.assertEqual(sum("duyvinh09/Module_IOS" in u for u in upstream), 2)
        self.assertIn("TEST ONLY", self.hybrid)

    def test_original_routing_rules_remain_intact(self):
        def rules(text):
            return text.split("[Rule]", 1)[1].split("[Header Rewrite]", 1)[0].strip()
        self.assertEqual(rules(self.hybrid), rules(self.prod))
        self.assertEqual(rules(self.native), rules(self.prod))

if __name__ == "__main__":
    unittest.main()

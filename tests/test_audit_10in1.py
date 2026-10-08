"""Static inventory regression tests: no network, no external script execution."""
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from audit_10in1 import audit


class AuditTests(unittest.TestCase):
    def test_current_profile_has_script_and_mitm_inventory(self):
        result = audit((ROOT / "build" / "khanh-rocket.conf").read_text(encoding="utf-8"))
        self.assertEqual(result["script_declarations"], 17)
        self.assertGreaterEqual(result["distinct_script_urls"], 1)
        self.assertGreaterEqual(len(result["mitm_hostname_patterns"]), 1)
        self.assertTrue(all(item["url"].startswith("https://") for item in result["scripts"]))

    def test_mutable_references_flagged(self):
        sample = """[Script]
test = type=http-response,script-path=https://raw.githubusercontent.com/example/repo/refs/heads/main/test.js
pinned = type=http-response,script-path=https://raw.githubusercontent.com/example/repo/1234567890abcdef/test.js
[MITM]
hostname = example.com, *.example.net
"""
        result = audit(sample)
        self.assertEqual(result["mutable_script_declarations"], 1)
        self.assertEqual(result["mitm_hostname_patterns"], ["example.com", "*.example.net"])

    def test_http_script_rejected(self):
        with self.assertRaises(ValueError):
            audit("[Script]\ntest = type=http-response,script-path=http://example.com/a.js\n")


if __name__ == "__main__":
    unittest.main()

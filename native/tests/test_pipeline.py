"""Offline configuration and pattern audits, without downloading any remote scripts."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "native" / "tools"))
from audit_pipeline import inventory, parse_config

MANIFEST = ROOT / "native" / "legacy-script-manifest.json"
CONFIG = ROOT / "build" / "khanh-rocket.conf"
LOCK = ROOT / "native" / "fixtures" / "working-directives.lock"


def active_lines(contents):
    return [s.strip() for s in contents.splitlines() if s.strip() and not s.lstrip().startswith("#")]


class NativeAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = CONFIG.read_text(encoding="utf-8")
        cls.manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
        cls.report = inventory(cls.source, cls.manifest)

    def test_production_is_locked_bit_for_bit_at_directive_level(self):
        self.assertEqual(active_lines(self.source), active_lines(LOCK.read_text(encoding="utf-8")))

    def test_legacy_inventory(self):
        self.assertEqual(self.report["script_declarations"], 17)
        self.assertEqual(self.report["distinct_source_urls"], 16)
        self.assertEqual(len(self.manifest["entries"]), 17)
        self.assertEqual(self.report["phases"], {"http-request": 6, "http-response": 10, "cron": 1})

    def test_sub_store_patterns_overlap_without_assuming_runtime_order(self):
        matches = self.report["matches_by_example"]["Sub-Store download"]
        self.assertEqual(matches, ["Sub-Store Core", "Sub-Store Simple"])

    def test_cam_scanner_unreachable_branch(self):
        self.assertIn("Camscanner", self.report["matches_by_example"]["CamScanner VIP"])
        self.assertNotIn("Camscanner", self.report["matches_by_example"]["CamScanner privilege"])

    def test_youtube_both_hooks_match_player(self):
        self.assertEqual(self.report["matches_by_example"]["YouTube player"],
                         ["youtube.request", "youtube.response"])

    def test_critical_script_urls_are_mutable(self):
        self.assertEqual(self.report["mutable_script_declarations"], 17)

    def test_synthetic_modified_url_fails_manifest_check(self):
        corrupted = self.source.replace("js/deleteHeader.js", "js/unknownReplacement.js")
        with self.assertRaises(ValueError):
            inventory(corrupted, self.manifest)

    def test_sections_guard(self):
        self.assertEqual(len(parse_config(self.source)), 6)


if __name__ == "__main__":
    unittest.main()

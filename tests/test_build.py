import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from build import build
from validate import validate

class TestBuilder(unittest.TestCase):
    def test_profiles(self):
        with tempfile.TemporaryDirectory() as td:
            for name in ("vn-split", "vn-full", "canada-direct"):
                target = Path(td) / (name + ".conf")
                build(name, output=target)
                self.assertEqual(validate(target), [])
                text = target.read_text(encoding="utf-8")
                self.assertNotIn("[MITM]", text)
                self.assertNotIn("[Script]", text)
            self.assertIn("FINAL,PROXY", (Path(td)/"vn-full.conf").read_text())
            self.assertIn("DOMAIN-SUFFIX,vn,PROXY", (Path(td)/"vn-split.conf").read_text())

    def test_opt_in(self):
        with tempfile.TemporaryDirectory() as td:
            path = build("vn-split", enabled=["ads-lite", "privacy-lite"], output=Path(td)/"test.conf")
            self.assertEqual(validate(path), [])
            self.assertIn("doubleclick.net,REJECT", path.read_text())

    def test_legacy_never_builds(self):
        with self.assertRaises(ValueError):
            build("vn-split", enabled=["legacy-premium-review"])

    def test_path_traversal_rejected(self):
        with self.assertRaises(ValueError):
            build("vn-split", enabled=["../secret"])

    def test_broken_config_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td)/"bad.conf"
            path.write_text("[Rule]\nFINAL,DIRECT\nDOMAIN-SUFFIX,vn,PROXY\n")
            self.assertTrue(validate(path))

if __name__ == "__main__":
    unittest.main()

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from build import build, modules_available, validate_module_rule
from validate import validate_text, validate


class TestPhase2(unittest.TestCase):
    def test_all_profiles_build_and_validate(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name in ('canada-direct', 'vn-split', 'vn-full', 'apps-privacy'):
                path = build(name, output=Path(tmp)/f'{name}.conf')
                self.assertEqual(validate(path), [])
                self.assertNotIn('[MITM]', path.read_text())
                self.assertNotIn('[Script]', path.read_text())

    def test_new_profile_defaults(self):
        with tempfile.TemporaryDirectory() as tmp:
            text = build('apps-privacy', output=Path(tmp)/'test.conf').read_text()
            self.assertIn('DOMAIN,events.redditmedia.com,REJECT', text)
            self.assertIn('FINAL,DIRECT', text)
            self.assertNotIn('FINAL,PROXY', text)

    def test_disable_selected_module(self):
        with tempfile.TemporaryDirectory() as tmp:
            text = build('apps-privacy', disabled=['app-reddit-telemetry'], output=Path(tmp)/'test.conf').read_text()
            self.assertNotIn('events.redditmedia.com', text)

    def test_reject_legacy_and_path_escape(self):
        for name in ('legacy-premium-review', '../evil', 'APP-TRACK', 'unknown'):
            with self.assertRaises(ValueError):
                build('vn-split', enabled=[name])

    def test_disallow_improper_rules(self):
        for bad in ('DOMAIN,api.example.com,PROXY', 'FINAL,PROXY', 'DOMAIN,example.com\n[MITM],REJECT', 'DOMAIN,foo bar,REJECT'):
            with self.assertRaises(ValueError):
                validate_module_rule(bad)

    def test_module_catalog_is_valid(self):
        d = modules_available()
        self.assertGreaterEqual(len(d), 12)
        for name, module in d.items():
            if module['kind'] == 'domain-rules':
                for rule in module['rules']:
                    self.assertEqual(validate_module_rule(rule), rule)

    def test_script_injection_rejected(self):
        self.assertTrue(validate_text('[Rule]\nFINAL,DIRECT\n[Script]\nanything'))
        self.assertTrue(validate_text('[Rule]\nFINAL,DIRECT\nDOMAIN,foo.com,REJECT'))
        self.assertTrue(validate_text('[Rule]\nIP-CIDR,8.8.8.0/24,DIRECT,no-resolve\nFINAL,DIRECT'))


if __name__ == '__main__':
    unittest.main()

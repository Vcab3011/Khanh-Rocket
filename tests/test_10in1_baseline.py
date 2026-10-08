"""Regression guard for the user-confirmed working 10in1 configuration.

This checks directive parity only. It does not execute external scripts or
claim that YouTube/Locket features work on any particular app version.
"""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "build" / "khanh-rocket.conf"
SNAPSHOT = ROOT / "tests" / "fixtures" / "10in1-active.conf"


def active_directives(text):
    """Ignore display metadata, blank lines and comments; retain directive order."""
    return [
        line.strip()
        for line in text.splitlines()
        if line.strip() and not line.lstrip().startswith("#")
    ]


class WorkingTenInOneBaselineTests(unittest.TestCase):
    def test_directives_match_confirmed_baseline(self):
        actual = active_directives(CONFIG.read_text(encoding="utf-8"))
        expected = active_directives(SNAPSHOT.read_text(encoding="utf-8"))
        self.assertEqual(
            actual,
            expected,
            "Working 10in1 directives changed. Review the diff and update "
            "the baseline snapshot only after testing on an actual device.",
        )

    def test_required_sections_are_present(self):
        actual = active_directives(CONFIG.read_text(encoding="utf-8"))
        self.assertEqual(
            [line for line in actual if line.startswith("[") and line.endswith("]")],
            ["[Rule]", "[Header Rewrite]", "[Url Rewrite]", "[Script]", "[Map Local]", "[MITM]"],
        )


if __name__ == "__main__":
    unittest.main()

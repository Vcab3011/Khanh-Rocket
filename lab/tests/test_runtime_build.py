"""Deterministic reset and exact protected-profile byte regression gates."""
import hashlib
import importlib.util
import io
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("lab_build", ROOT / "lab/tools/build_runtime.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class RuntimeBuildTest(unittest.TestCase):
    def test_reset_is_generated_and_stale_reset_fails_check(self):
        bundles = build.render()
        self.assertEqual(set(bundles), {"egern-observer", "egern-status", "egern-reset"})
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "build").mkdir()
            for name, source in bundles.items():
                (root / "build" / (name + ".js")).write_text(source, encoding="utf-8")
            with patch.object(build, "ROOT", root), patch("sys.argv", ["build_runtime.py", "--check"]):
                with redirect_stdout(io.StringIO()):
                    build.main()
                    (root / "build/egern-reset.js").write_text("stale", encoding="utf-8")
                    with self.assertRaisesRegex(SystemExit, "Stale Egern bundle.*egern-reset"):
                        build.main()

    def test_protected_profiles_match_exact_git_blobs(self):
        for file, expected in {
            "build/khanh-rocket.conf": "e1f1f71ef4e9c0fa88ef68ffafecb02c81153a29",
            "build/khanh-rocket-v3-test.conf": "4ca2337e4473785bbaa5439de343acddfa1059cd",
        }.items():
            with self.subTest(file=file):
                data = (ROOT / file).read_bytes()
                blob = hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()
                self.assertEqual(blob, expected)

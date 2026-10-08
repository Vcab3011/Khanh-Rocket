"""Immutable source verification must fail on hash, source or module drift."""
import importlib.util
import json
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("lab_pins", ROOT / "lab/tools/audit_pins.py")
pins = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pins)


class PinsTest(unittest.TestCase):
    def test_all_bundles_and_modules_match_git_sources(self):
        self.assertEqual(pins.audit(), {"reviewed_bundles": 3, "verified_modules": 5})

    def test_bundle_ref_hash_and_module_url_drift_are_rejected(self):
        for change in ("bundle", "ref", "hash", "source", "url", "inventory"):
            with self.subTest(change=change), tempfile.TemporaryDirectory() as td:
                lab = Path(td) / "lab"
                for name in ("build", "modules"):
                    shutil.copytree(ROOT / "lab" / name, lab / name)
                lock = json.loads((ROOT / "lab/supply-chain-lock.json").read_text())
                record = lock["script_blobs"]["lab/build/egern-observer.js"]
                if change == "bundle":
                    with (lab / "build/egern-observer.js").open("a") as f:
                        f.write("\n// synthetic drift\n")
                elif change == "ref":
                    record["ref"] = "main"
                elif change == "hash":
                    record["sha256"] = "0" * 64
                elif change == "source":
                    record["ref"] = "d735822182c8ea215739aa595f6cfff815ea8bac"
                elif change == "url":
                    module = lab / "modules/egern-locket-observe.yaml"
                    module.write_text(module.read_text().replace(record["ref"], "main"))
                else:
                    (lab / "modules/unreviewed.yaml").write_text("scriptings: []")
                (lab / "supply-chain-lock.json").write_text(json.dumps(lock))
                with self.assertRaises(ValueError):
                    pins.audit(lab, ROOT)

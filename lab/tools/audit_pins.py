#!/usr/bin/env python3
"""Offline verification of module URLs, local bundles and immutable Git sources."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
LAB = REPO / "lab"
MODULES = {
    "egern-locket-observe.yaml": ("http_response", "lab/build/egern-observer.js"),
    "egern-soundcloud-observe.yaml": ("http_response", "lab/build/egern-observer.js"),
    "egern-youtube-observe.yaml": ("http_response", "lab/build/egern-observer.js"),
    "egern-observe-status.yaml": ("generic", "lab/build/egern-status.js"),
    "egern-observe-reset.yaml": ("generic", "lab/build/egern-reset.js"),
}


def git_blob(data):
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()


def audit(lab=LAB, repo=REPO):
    lock = json.loads((lab / "supply-chain-lock.json").read_text(encoding="utf-8"))
    records = lock.get("script_blobs", {})
    if lock.get("schema") != 1 or set(records) != {path for _, path in MODULES.values()}:
        raise ValueError("unexpected lab script inventory")
    for path, record in records.items():
        ref = record.get("ref", "")
        if not re.fullmatch(r"[0-9a-f]{40}", ref):
            raise ValueError("non-immutable source ref: " + path)
        local = (lab / Path(path).relative_to("lab")).read_bytes()
        if git_blob(local) != record.get("git_blob_sha1") or hashlib.sha256(local).hexdigest() != record.get("sha256"):
            raise ValueError("local bundle differs from reviewed hash: " + path)
        # Full history is required in CI. No network requests or ref substitutions.
        result = subprocess.run(["git", "-C", str(repo), "show", f"{ref}:{path}"],
                                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
        if result.returncode:
            raise ValueError("pinned Git source unavailable (fetch history): " + path)
        if result.stdout != local:
            raise ValueError("pinned Git bytes differ from local bundle: " + path)
    if {file.name for file in (lab / "modules").glob("*.yaml")} != set(MODULES):
        raise ValueError("unexpected lab module inventory")
    for name, (kind, path) in MODULES.items():
        config = yaml.safe_load((lab / "modules" / name).read_text(encoding="utf-8"))
        hooks = config.get("scriptings", [])
        if len(hooks) != 1 or set(hooks[0]) != {kind}:
            raise ValueError("unexpected module hook: " + name)
        expected = f"https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/{records[path]['ref']}/{path}"
        if hooks[0][kind].get("script_url") != expected:
            raise ValueError("module URL differs from reviewed immutable pin: " + name)
    return {"reviewed_bundles": len(records), "verified_modules": len(MODULES)}


if __name__ == "__main__":
    print(json.dumps(audit(), indent=2))

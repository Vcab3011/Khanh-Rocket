#!/usr/bin/env python3
"""Offline attest source identities and unsafe capabilities in active V3 scriptlets.

Runs before a canary is considered for manual deployment. Does not fetch URLs.
It validates Git blob object IDs recorded from the pinned source commits.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
LOCK = ROOT / "native" / "v3" / "supply-chain-lock.json"
PROFILES = [
    ROOT / "native" / "v3" / "build" / "privacy-canary.conf",
    ROOT / "native" / "v3" / "build" / "compat-canary.conf",
]
SCRIPT_PATH = re.compile(r"\bscript-path=(https://[^,\s]+)")
UNSAFE = {
    "dynamic code": re.compile(r"\b(?:eval|Function|importScripts|require)\s*\("),
    "network client": re.compile(r"\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(|\$httpClient|\$task\.fetch"),
    "persistence": re.compile(r"\$persistentStore|\$prefs"),
    "device notifications": re.compile(r"\$notification|\$notify\s*\("),
    "undocumented stdout logging": re.compile(r"\bconsole\s*\."),
}


def git_blob_hash(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\x00" + data).hexdigest()


def executable_text(text: str) -> str:
    # Strip JS block comments and whole-line comments; source is intentionally simple.
    without_block = re.sub(r"/\*[\s\S]*?\*/", "", text)
    return re.sub(r"^\s*//[^\n]*", "", without_block, flags=re.MULTILINE)


def audit() -> dict:
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    recorded = lock["script_blobs"]
    for relpath, record in recorded.items():
        target = ROOT / relpath
        if not target.is_file() or target.suffix != ".js":
            raise ValueError("missing owned JS source: " + relpath)
        data = target.read_bytes()
        expected = record["git_blob_sha1"]
        found = git_blob_hash(data)
        if found != expected:
            raise ValueError(f"source differs from pinned reviewed blob: {relpath}")
        if record["ref"] not in {lock["v2_commit"], lock["v3_commit"]}:
            raise ValueError("unapproved ref: " + relpath)
        source = executable_text(data.decode("utf-8"))
        for label, pattern in UNSAFE.items():
            if pattern.search(source):
                raise ValueError(f"unexpected {label} primitive in {relpath}")

    active = set()
    counts = {}
    for filename in PROFILES:
        content = filename.read_text(encoding="utf-8")
        urls = SCRIPT_PATH.findall(content)
        if not urls:
            raise ValueError("no scripts in " + filename.name)
        counts[filename.name] = len(urls)
        for uri in urls:
            parsed = urlsplit(uri)
            if parsed.scheme != "https" or parsed.netloc != "raw.githubusercontent.com":
                raise ValueError("non-approved script host: " + uri)
            segments = parsed.path.lstrip("/").split("/")
            if segments[:2] != ["Vcab3011", "Khanh-Rocket"] or len(segments) != 7:
                raise ValueError("unexpected source path: " + uri)
            ref = segments[2]
            # canonical path: native/v2/scripts/foo.js
            relpath = "/".join(segments[3:])
            if relpath not in recorded or recorded[relpath]["ref"] != ref:
                raise ValueError("script not in reviewed hash lock: " + uri)
            active.add(relpath)
        mitm_lines = [line.strip() for line in content.splitlines()
                      if line.strip().startswith("hostname = ")]
        if len(mitm_lines) != 1 or "%APPEND%" in mitm_lines[0] or "sub.store" in content:
            raise ValueError("unbounded/third-party MITM configuration")

    if active != set(recorded):
        raise ValueError(f"stale script lock, missing active sources: {sorted(set(recorded) - active)}")
    return {"profiles": counts, "reviewed_owned_script_files": len(recorded),
            "raw_hosts": ["raw.githubusercontent.com"], "unreviewed_network_clients": 0}


if __name__ == "__main__":
    print(json.dumps(audit(), indent=2))

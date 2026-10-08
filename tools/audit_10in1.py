#!/usr/bin/env python3
"""Offline supply-chain inventory of the working 10in1 profile.

Read-only: never downloads or executes remote scripts, never rewrites config.
This reports risk indicators, not evidence of compromise or runtime correctness.
"""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "build" / "khanh-rocket.conf"


def audit(text):
    section = None
    scripts = []
    mitm = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            section = line[1:-1]
            continue
        if section == "MITM" and line.startswith("hostname = "):
            mitm.extend(host.strip() for host in line.partition("=")[2].split(",") if host.strip())
        if section != "Script":
            continue
        name, sep, attributes = line.partition("=")
        if not sep:
            raise ValueError("script entry missing '=': " + line)
        match = re.search(r"(?:^|,)script-path=(https://[^,\s]+)", attributes)
        if not match:
            raise ValueError("missing HTTPS script-path for " + name.strip())
        url = match.group(1)
        parsed = urlsplit(url)
        if not parsed.hostname:
            raise ValueError("invalid script URL for " + name.strip())
        mutable = (
            "/refs/heads/" in parsed.path
            or "/master/" in parsed.path
            or "/main/" in parsed.path
            or "/releases/latest/" in parsed.path
        )
        scripts.append({
            "name": name.strip(),
            "host": parsed.hostname,
            "url": url,
            "mutable_reference": mutable,
        })
    return {
        "script_declarations": len(scripts),
        "distinct_script_urls": len(set(s["url"] for s in scripts)),
        "mutable_script_declarations": sum(s["mutable_reference"] for s in scripts),
        "mitm_hostname_patterns": mitm,
        "scripts": scripts,
        "notes": [
            "Offline inventory only; external code was not fetched or executed.",
            "Mutable URLs can change independently of this configuration.",
            "MITM hostnames permit HTTPS interception when CA is trusted and decryption enabled.",
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    args = parser.parse_args()
    print(json.dumps(audit(args.config.read_text(encoding="utf-8")), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Validate the structure of the legacy compatibility profile without executing remote code."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "build" / "khanh-rocket.conf"
EXPECTED = {
    "Rule": 2,
    "Header Rewrite": 3,
    "Url Rewrite": 5,
    "Script": 17,
    "Map Local": 1,
    "MITM": 1,
}

def inspect(text):
    sections = {}
    current = None
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1]
            if current in sections:
                raise ValueError("duplicate section: " + current)
            sections[current] = []
        elif current and line and not line.startswith("#"):
            sections[current].append(line)
    if list(sections) != list(EXPECTED):
        raise ValueError("unexpected section order: " + str(list(sections)))
    for section, count in EXPECTED.items():
        if len(sections[section]) != count:
            raise ValueError(f"{section}: expected {count}, got {len(sections[section])}")
    if "#!author = Vcab3011" not in text or "docs/LEGACY_10IN1.md" not in text:
        raise ValueError("maintainer attribution and provenance documentation link required")
    if not all("script-path=https://" in line for line in sections["Script"] if "type=cron" not in line) or any("script-path=http://" in line for line in sections["Script"]):
        raise ValueError("remote script path missing or insecure")
    if not sections["MITM"][0].startswith("hostname = "):
        raise ValueError("missing MITM hosts")
    return sections

if __name__ == "__main__":
    inspect(CONFIG.read_text(encoding="utf-8"))
    print("PASS: 10in1 compatibility sections, counts and maintainer/provenance markers")

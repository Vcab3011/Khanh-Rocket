#!/usr/bin/env python3
"""Read-only structural and attack-surface audit of the user-confirmed 10in1.

Does not contact upstream websites, import JS, or modify any Shadowrocket config.
"""
import argparse
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "build" / "khanh-rocket.conf"
MANIFEST = Path(__file__).resolve().parents[1] / "legacy-script-manifest.json"
EXPECTED_SECTIONS = ["Rule", "Header Rewrite", "Url Rewrite", "Script", "Map Local", "MITM"]
EXPECTED_COUNTS = [2, 3, 5, 17, 1, 1]
PATTERN = re.compile(r"\bpattern=(.*?)(?=,(?:requires-body|max-size|binary-body-mode|engine|script-path|timeout|script-update-interval|argument|wake-system)=|$)")
SOURCE = re.compile(r"\bscript-path=(https://[^,\s]+)")
PHASE = re.compile(r"\btype=(http-request|http-response|cron)")
EXAMPLE_URLS = {
    "Sub-Store download": "https://sub.store/download/my-sub",
    "Sub-Store sync": "https://sub.store/api/sync/artifacts",
    "Sub-Store settings": "https://sub.store/api/settings",
    "YouTube player": "https://youtubei.googleapis.com/youtubei/v1/player",
    "YouTube stats": "https://s.youtube.com/api/stats/ads?x=1",
    "Spotify customization": "https://spclient.wg.spotify.com/user-customization-service/v1/customize",
    "Locket RevenueCat": "https://api.revenuecat.com/v1/subscribers/customer",
    "CamScanner VIP": "https://api.intsig.net/purchase/cs/query_property",
    "CamScanner privilege": "https://api.intsig.net/getPrivilegeItem",
}


def parse_config(text):
    groups = {}
    current = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            current = line[1:-1]
            if current in groups:
                raise ValueError(f"duplicate section: {current}")
            groups[current] = []
        elif current is not None:
            groups[current].append(line)
    return groups


def inventory(config_text, manifest):
    groups = parse_config(config_text)
    if list(groups) != EXPECTED_SECTIONS:
        raise ValueError(f"legacy section order changed: {list(groups)}")
    counts = list(map(len, groups.values()))
    if counts != EXPECTED_COUNTS:
        raise ValueError(f"legacy directive counts changed: {counts}")

    entries = []
    for raw in groups["Script"]:
        name, sep, _ = raw.partition(" = ")
        if not sep:
            raise ValueError("unparseable script line")
        phase = PHASE.search(raw)
        src = SOURCE.search(raw)
        if not phase or not src:
            raise ValueError(f"script missing phase/source: {name}")
        pattern = PATTERN.search(raw)
        entries.append({
            "id": name,
            "phase": phase.group(1),
            "url": src.group(1),
            "pattern": pattern.group(1) if pattern else None,
            "mutable_reference": any(x in src.group(1) for x in (
                "/refs/heads/", "/main/", "/master/", "/releases/latest/"
            )),
            "body_capture": bool(re.search(r"\brequires-body=(?:true|1)(?:,|$)", raw)),
            "unlimited_body": "max-size=-1" in raw,
        })

    expected = manifest["entries"]
    if len(entries) != len(expected) or [x["id"] for x in entries] != [x["id"] for x in expected]:
        raise ValueError("script inventory changed; review manifest")
    for actual, recorded in zip(entries, expected):
        if actual["url"] != recorded["url"] or actual["phase"] != recorded["phase"]:
            raise ValueError("script URL/phase changed; review manifest before updating")

    scenarios = {}
    for label, url in EXAMPLE_URLS.items():
        matched = []
        for entry in entries:
            if entry["pattern"] and re.search(entry["pattern"], url):
                matched.append(entry["id"])
        scenarios[label] = matched
    mitm = groups["MITM"][0]
    if not mitm.startswith("hostname = "):
        raise ValueError("invalid MITM hostname line")
    hosts = [x.strip() for x in mitm.partition("=")[2].split(",") if x.strip()]
    return {
        "section_counts": dict(zip(EXPECTED_SECTIONS, counts)),
        "script_declarations": len(entries),
        "distinct_source_urls": len({e["url"] for e in entries}),
        "mutable_script_declarations": sum(e["mutable_reference"] for e in entries),
        "phases": dict(Counter(e["phase"] for e in entries)),
        "body_capture_count": sum(e["body_capture"] for e in entries),
        "unlimited_body_count": sum(e["unlimited_body"] for e in entries),
        "mitm_patterns": hosts,
        "matches_by_example": scenarios,
        "scripts": entries,
        "notes": [
            "Overlaps only prove regexes match the same URL, not runtime invocation order.",
            "MITM URL matching and certificate trust are separate prerequisites.",
            "No external JavaScript or URLs were fetched or executed.",
        ],
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--config", type=Path, default=CONFIG)
    p.add_argument("--manifest", type=Path, default=MANIFEST)
    args = p.parse_args()
    report = inventory(
        args.config.read_text(encoding="utf-8"),
        json.loads(args.manifest.read_text(encoding="utf-8")),
    )
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

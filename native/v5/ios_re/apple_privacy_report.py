#!/usr/bin/env python3
"""Analyze Apple's App Privacy Report NDJSON with no proxy and no MITM.

Source: iOS Settings > Privacy & Security > App Privacy Report > Share.
The input can contain sensitive user activity. Process on the user's own
machine only; never commit or upload a raw App Privacy Report.
Output: app-scoped, allowlisted domain group counts, no literal domains,
bundle IDs, URLs, timestamps, contexts, user handles, or raw event data.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

MAX_BYTES = 12 * 1024 * 1024
MAX_LINES = 50000
SUFFIXES = {
    "instagram": ("instagram.com", "cdninstagram.com", "facebook.com", "fbcdn.net"),
    "snapchat": ("snapchat.com", "snap.com", "sc-cdn.net", "snapkit.com"),
}
INITIATORS = ("app", "user", "other")


def group_domain(domain: object, app: str) -> str:
    if not isinstance(domain, str) or len(domain) > 253:
        return "other"
    domain = domain.lower().strip().rstrip(".")
    if not domain or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-." for c in domain):
        return "other"
    for suffix in SUFFIXES[app]:
        if domain == suffix or domain.endswith("." + suffix):
            return "related"
    return "other"


def summarize_lines(lines, app: str, bundle_id: str) -> dict:
    if app not in SUFFIXES or not bundle_id or len(bundle_id) > 256:
        raise ValueError("Invalid app/bundle selector")
    rows = 0
    matched_records = 0
    counts = {f"{origin}|{group}": 0 for origin in INITIATORS for group in ("related", "other")}
    for raw in lines:
        rows += 1
        if rows > MAX_LINES:
            raise ValueError("Report exceeds allowed event count")
        if len(raw) > 100000:
            raise ValueError("Oversized event")
        try:
            record = json.loads(raw)
        except (UnicodeError, json.JSONDecodeError) as exc:
            raise ValueError("Malformed report") from None
        if not isinstance(record, dict) or record.get("type") != "networkActivity":
            continue
        if record.get("bundleID") != bundle_id:
            continue
        amount = record.get("hits", 1)
        if type(amount) is not int or amount < 0 or amount > 1000000:
            raise ValueError("Invalid aggregate hit count")
        matched_records += 1
        initiated = record.get("initiatedType")
        origin = "app" if initiated == "AppInitiated" else "user" if initiated == "NonAppInitiated" else "other"
        key = origin + "|" + group_domain(record.get("domain"), app)
        counts[key] += amount
    return {
        "schema": "khanh.v5.ios.apple-privacy-meta.v1",
        "app": app,
        "matchedRecordCount": matched_records,
        "activityCounts": [{"group": group, "hits": counts[group]} for group in sorted(counts)],
        "assertions": {
            "reportIsSevenDayAggregate": True,
            "requestOrResponseBodiesAvailable": False,
            "exactFeatureEndpointKnown": False,
            "subscriptionServerVerified": False,
            "appTransportVerified": False,
        },
    }


def load_and_summarize(path: str, app: str, bundle_id: str) -> dict:
    source = Path(path)
    if not source.is_file() or source.stat().st_size > MAX_BYTES:
        raise ValueError("File missing or too large")
    try:
        with source.open("r", encoding="utf-8") as stream:
            return summarize_lines(stream, app, bundle_id)
    except UnicodeError:
        raise ValueError("Report encoding invalid") from None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", help="Local NDJSON App Privacy Report (never commit it)")
    parser.add_argument("--app", choices=tuple(SUFFIXES), required=True)
    parser.add_argument("--bundle-id", required=True,
                        help="Exact app bundle ID shown in your local report; never included in output")
    a = parser.parse_args()
    try:
        report = load_and_summarize(a.input, a.app, a.bundle_id)
    except (ValueError, OSError, TypeError):
        parser.error("Unable to process privacy report safely")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Khanh Rocket iOS RE: offline, metadata-only, privacy-reducing HAR analyzer.

Input: a user-owned HAR obtained from an authorized, controlled test session.
Output: strictly allowlisted counters only. Never stores hosts, paths, queries,
headers, bodies, cookies, IDs, tokens, usernames, or URLs.

A proxy HAR may miss Snapchat QUIC/gRPC calls and Instagram background traffic.
Absence of traffic is NEVER proof that a feature has no server verification.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from urllib.parse import urlsplit

MAX_BYTES = 12 * 1024 * 1024
MAX_RECORDS = 10000
ALLOWED_STAGES = ("baseline", "paywall", "feature_open", "refresh", "restart")
FAMILIES = {
    "instagram": ("instagram.com", "cdninstagram.com", "facebook.com", "fbcdn.net"),
    "snapchat": ("snapchat.com", "snap.com", "sc-cdn.net", "snapkit.com"),
}
CONTENT_GROUPS = ("grpc", "protobuf", "json", "html", "media", "other", "unknown")
TRANSPORT_GROUPS = ("h3", "h2", "http1", "unknown")


def classify_host(url: object, app: str) -> str:
    """Return a group label, NEVER a subdomain or raw URL."""
    try:
        if not isinstance(url, str) or len(url) > 16384:
            return "other"
        parsed = urlsplit(url)
        if parsed.scheme != "https" or not parsed.hostname:
            return "other"
        host = parsed.hostname.lower().rstrip(".")
        if any(host == d or host.endswith("." + d) for d in FAMILIES[app]):
            return "related"
    except (ValueError, TypeError):
        pass
    return "other"


def content_group(response: object) -> str:
    if not isinstance(response, dict):
        return "unknown"
    content = response.get("content")
    mimetype = content.get("mimeType") if isinstance(content, dict) else None
    if not isinstance(mimetype, str):
        return "unknown"
    t = mimetype.split(";", 1)[0].strip().lower()[:100]
    if t in ("application/grpc", "application/grpc+proto", "application/grpc-web"):
        return "grpc"
    if "protobuf" in t or t in ("application/x-proto", "application/octet-stream+proto"):
        return "protobuf"
    if "json" in t:
        return "json"
    if t in ("text/html", "application/xhtml+xml"):
        return "html"
    if t.startswith(("image/", "audio/", "video/")):
        return "media"
    return "other"


def transport_group(request: object) -> str:
    if not isinstance(request, dict):
        return "unknown"
    version = request.get("httpVersion")
    if not isinstance(version, str):
        return "unknown"
    v = version.strip().upper()
    if v in ("H3", "HTTP/3", "HTTP/3.0", "QUIC"):
        return "h3"
    if v in ("H2", "HTTP/2", "HTTP/2.0"):
        return "h2"
    if v in ("HTTP/1.1", "HTTP/1.0", "HTTP/1"):
        return "http1"
    return "unknown"


def status_group(response: object) -> str:
    if not isinstance(response, dict):
        return "unknown"
    status = response.get("status")
    if type(status) is not int or not 100 <= status <= 599:
        return "unknown"
    return f"{status // 100}xx"


def method_group(request: object) -> str:
    if not isinstance(request, dict):
        return "other"
    method = request.get("method")
    return method if method in ("GET", "POST", "HEAD") else "other"


def duration_group(entry: dict) -> str:
    raw = entry.get("time")
    if type(raw) not in (float, int) or not math.isfinite(raw) or raw < 0:
        return "unknown"
    if raw < 100:
        return "lt100ms"
    if raw < 500:
        return "100to499ms"
    if raw < 2000:
        return "500to1999ms"
    return "ge2000ms"


def summarize(har: object, app: str, stage: str) -> dict:
    if app not in FAMILIES or stage not in ALLOWED_STAGES:
        raise ValueError("Invalid app or observation stage")
    log = har.get("log") if isinstance(har, dict) else None
    entries = log.get("entries") if isinstance(log, dict) else None
    if not isinstance(entries, list) or len(entries) > MAX_RECORDS:
        raise ValueError("Invalid or oversized HAR event list")

    grouped: dict[str, int] = {}
    transport = {x: 0 for x in TRANSPORT_GROUPS}
    related = 0
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("Invalid HAR entry")
        req, resp = entry.get("request"), entry.get("response")
        if not isinstance(req, dict) or not isinstance(resp, dict):
            raise ValueError("Invalid HAR request/response")
        family = classify_host(req.get("url"), app)
        if family == "related":
            related += 1
        tg = transport_group(req)
        transport[tg] += 1
        # Output only bounded, enum-based fields. No request data copied.
        key = "|".join((
            family, method_group(req), status_group(resp),
            content_group(resp), tg, duration_group(entry)
        ))
        grouped[key] = grouped.get(key, 0) + 1
    return {
        "schema": "khanh.v5.ios.passive-meta.v1",
        "app": app,
        "stage": stage,
        "entryCount": len(entries),
        "relatedDomainCount": related,
        "protocolHints": transport,
        "counts": [{"group": key, "count": grouped[key]} for key in sorted(grouped)],
        "assertions": {
            "capturedTrafficIsComplete": False,
            "subscriptionServerVerified": False,
            "appBinaryReverseEngineered": False,
            "bodyOrEndpointSchemaKnown": False,
        },
    }


def compare(baseline: dict, test: dict) -> dict:
    if baseline.get("schema") != "khanh.v5.ios.passive-meta.v1" or \
       test.get("schema") != "khanh.v5.ios.passive-meta.v1" or \
       baseline.get("app") != test.get("app"):
        raise ValueError("Incompatible summaries")
    a = {x["group"]: x["count"] for x in baseline["counts"]}
    b = {x["group"]: x["count"] for x in test["counts"]}
    return {
        "schema": "khanh.v5.ios.passive-diff.v1",
        "app": baseline["app"],
        "baselineStage": baseline["stage"],
        "testStage": test["stage"],
        "entryDelta": test["entryCount"] - baseline["entryCount"],
        "countChanges": [
            {"group": key, "before": a.get(key, 0), "after": b.get(key, 0)}
            for key in sorted(set(a) | set(b)) if a.get(key, 0) != b.get(key, 0)
        ],
        "caveat": "Traffic count deltas do not establish identity, entitlement, or a bypassable API.",
    }


def load_local_json(name: str) -> object:
    f = Path(name)
    if not f.is_file() or f.stat().st_size > MAX_BYTES:
        raise ValueError("File missing or exceeds the size limit")
    try:
        return json.loads(f.read_text(encoding="utf-8"))
    except (UnicodeError, json.JSONDecodeError):
        raise ValueError("Invalid JSON input") from None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    capture = sub.add_parser("summarize", help="Output sanitized HAR metadata (no URLs/tokens)")
    capture.add_argument("input")
    capture.add_argument("--app", choices=tuple(FAMILIES), required=True)
    capture.add_argument("--stage", choices=ALLOWED_STAGES, required=True)
    differ = sub.add_parser("compare", help="Compare only two sanitized summary files")
    differ.add_argument("baseline")
    differ.add_argument("test")
    options = parser.parse_args()
    try:
        if options.command == "summarize":
            report = summarize(load_local_json(options.input), options.app, options.stage)
        else:
            report = compare(load_local_json(options.baseline), load_local_json(options.test))
    except (OSError, ValueError, TypeError, KeyError):
        parser.error("Cannot process input safely; check the schema and limits")
    print(json.dumps(report, indent=2, ensure_ascii=True, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

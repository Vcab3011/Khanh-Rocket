#!/usr/bin/env python3
"""Instagram Plus offline research evidence classifier.

Input: optional manually created JSON observations of user's own/consenting
test accounts. Output: STRICTLY allowlisted field/enum summaries.
No HTTP request, endpoint probing, jailbreak, subscriber alteration, receipts,
cookies, Instagram credentials, raw private Stories or third-party viewers.

* An observed action ≠ verified paid entitlement.
* A presentation flag ≠ backend authorization.
* A server-effect hypothesis in catalog ≠ measured iOS implementation.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parent
MAX_DOC_BYTES = 256 * 1024
MAX_EVENTS = 128
STAGES = ("offer", "feature_screen", "attempt", "relaunch", "online_refresh", "external_confirmation")
UI = ("visible", "hidden", "unknown")
ACTION = ("worked", "blocked", "not_tested", "not_applicable")
EVIDENCE = ("self_ui", "consented_second_account", "apple_subscriptions_screen", "none")
ALLOWED_FIELDS = frozenset(("feature", "stage", "ui", "action", "evidence"))


def load_json(filename: str, limit: int = MAX_DOC_BYTES) -> Any:
    path = Path(filename)
    if not path.is_file() or path.stat().st_size > limit:
        raise ValueError("Missing file or input exceeds limit")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError("Invalid JSON document") from None


def catalog_index(catalog: object) -> dict[str, dict]:
    if not isinstance(catalog, dict) or catalog.get("version") != 1:
        raise ValueError("Unknown catalog")
    features = catalog.get("features")
    if not isinstance(features, list) or not 1 <= len(features) <= 64:
        raise ValueError("Malformed catalog features")
    items = {}
    for feature in features:
        if not isinstance(feature, dict):
            raise ValueError("Invalid feature")
        key, boundary = feature.get("key"), feature.get("boundary")
        if not isinstance(key, str) or not key.isidentifier() or key in items:
            raise ValueError("Invalid or duplicate feature")
        if boundary not in ("ui_account_gate", "server_mutation", "server_privacy",
                           "server_query", "server_notification", "server_ranking"):
            raise ValueError("Invalid boundary")
        items[key] = feature
    return items


def normalize(catalog: object, observations: object) -> list[dict]:
    index = catalog_index(catalog)
    if not isinstance(observations, dict) or observations.get("schema") != "khanh.igplus.observations.v1":
        raise ValueError("Unknown observation schema")
    items = observations.get("observations")
    if not isinstance(items, list) or len(items) > MAX_EVENTS:
        raise ValueError("Too many observations")
    output, seen = [], set()
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Invalid observation entry")
        key, stage, ui, action, evidence = (
            item.get("feature"), item.get("stage"), item.get("ui"),
            item.get("action"), item.get("evidence"),
        )
        if not isinstance(key, str) or key not in index or stage not in STAGES or ui not in UI or \
            action not in ACTION or evidence not in EVIDENCE:
            raise ValueError("Invalid feature or observation state")
        uniq = (key, stage)
        if uniq in seen:
            raise ValueError("Duplicate feature and stage")
        seen.add(uniq)
        if ui == "hidden" and action == "worked":
            raise ValueError("Contradictory hidden/working state")
        if stage in ("offer", "feature_screen") and action == "worked":
            raise ValueError("Feature action cannot be asserted from a listing screen")
        if evidence == "consented_second_account" and stage != "external_confirmation":
            raise ValueError("Second account requires an explicit confirmation stage")
        if evidence == "apple_subscriptions_screen" and stage != "external_confirmation":
            raise ValueError("Apple subscriptions screen requires explicit confirmation stage")
        if stage == "external_confirmation" and action == "worked" and evidence == "none":
            raise ValueError("Confirmation cannot be unsupported")
        # Never copy arbitrary keys, even if input contains PII or opaque payloads.
        output.append({"feature": key, "stage": stage, "ui": ui,
                       "action": action, "evidence": evidence})
    return output


def classify_feature(events: list[dict]) -> str:
    if not events:
        return "unobserved"
    if any(e["ui"] == "visible" and e["action"] == "blocked" for e in events):
        return "visible_but_blocked"
    if any(e["stage"] == "external_confirmation" and e["action"] == "worked" and
           e["evidence"] == "consented_second_account" for e in events):
        return "consented_cross_account_action_observed"
    if any(e["action"] == "worked" for e in events):
        return "single_device_action_observed"
    if any(e["ui"] == "visible" for e in events):
        return "ui_only_or_not_tested"
    if all(e["ui"] == "hidden" for e in events):
        return "not_visible"
    return "insufficient_evidence"


def assess(catalog: object, observations: object) -> dict:
    index = catalog_index(catalog)
    events = normalize(catalog, observations)
    grouped: dict[str, list[dict]] = {}
    for event in events:
        grouped.setdefault(event["feature"], []).append(event)
    summary = []
    counts = {}
    for key, feature in index.items():
        state = classify_feature(grouped.get(key, []))
        counts[state] = counts.get(state, 0) + 1
        summary.append({
            "feature": key,
            "hypothesizedBoundary": feature["boundary"],
            "state": state,
            "stageCount": len(grouped.get(key, [])),
        })
    return {
        "schema": "khanh.igplus.assessment.v1",
        "catalogFeatures": len(index),
        "observationCount": len(events),
        "counts": [{"state": s, "features": counts[s]} for s in sorted(counts)],
        "features": summary,
        "evidence": events,
        "verified": {
            "aPaidTransaction": False,
            "aPlusEntitlementOnMetaBackend": False,
            "aPrivateIOSAPIEndpoint": False,
            "aBypassableFeatureFlag": False,
            "oneShotVPNOffPersistence": False,
        },
        "caveats": [
            "Official capability, local UI, successful action, and paid server entitlement are distinct facts.",
            "Cross-account tests require two consenting test accounts and cannot establish a paid transaction.",
            "The catalog boundary is a hypothesis; no private app internals are inferred from UI alone.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("observations", help="Local JSON observation file (do not include PII)")
    parser.add_argument("--catalog", default=str(BASE / "FEATURE_CATALOG.json"))
    args = parser.parse_args()
    try:
        result = assess(load_json(args.catalog), load_json(args.observations))
    except (OSError, ValueError, TypeError):
        parser.error("Unable to safely assess observation data")
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

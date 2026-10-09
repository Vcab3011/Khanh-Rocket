#!/usr/bin/env python3
"""Offline Instagram *non-Plus* Story metrics feasibility audit.

Works only on numbers manually transcribed from YOUR OWN authorized Instagram
Story/Insights. Supports personal accounts with in-app viewer counts and
optional professional account Insights totals. Does not accept usernames,
timestamps, Story IDs, viewer lists, cookies, session details, or HAR.

Crucially, "views - reach" is NOT defined here as a verified Instagram Plus
rewatch metric. A difference can only be a conditional model illustration
when the counters refer to the same Story/period and known semantics.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

SCHEMA = "khanh.igplus.nonplus-observation.v1"
MAX_BYTES = 32768
MAX_STEPS = 30
MAX_COUNT = 10_000_000
ACCOUNT_TYPE = ("personal", "creator", "business", "unknown")
CONTEXT = ("native_story_viewer", "professional_story_insights", "unknown")
METRIC_STATUS = ("unknown", "same_story_same_window", "not_comparable")
STEP_TYPES = ("baseline", "new_view_by_consenter", "replay_by_consenter",
              "refresh_only", "control_wait", "relaunch")
RELATIONSHIP = ("unknown", "same_window", "different_window")


def maybe_count(value: object) -> int | None:
    if value is None:
        return None
    if type(value) is not int or value < 0 or value > MAX_COUNT:
        raise ValueError("Invalid count")
    return value


def validate(document: object) -> list[dict]:
    if not isinstance(document, dict) or document.get("schema") != SCHEMA:
        raise ValueError("Invalid observation schema")
    if document.get("accountType") not in ACCOUNT_TYPE or \
       document.get("measurementSource") not in CONTEXT or \
       document.get("metricComparability") not in METRIC_STATUS:
        raise ValueError("Invalid account/measurement context")
    steps = document.get("steps")
    if not isinstance(steps, list) or not 2 <= len(steps) <= MAX_STEPS:
        raise ValueError("Invalid step list")
    output = []
    for index, step in enumerate(steps):
        if not isinstance(step, dict) or step.get("stage") != index or \
           step.get("event") not in STEP_TYPES:
            raise ValueError("Invalid step")
        views = maybe_count(step.get("views"))
        reach = maybe_count(step.get("reach"))
        viewer_list_count = maybe_count(step.get("viewerListCount"))
        if all(x is None for x in (views, reach, viewer_list_count)):
            raise ValueError("No observable metric")
        if document["accountType"] == "personal" and \
           document["measurementSource"] == "professional_story_insights":
            raise ValueError("Professional insights not supported for personal account")
        if document["measurementSource"] == "native_story_viewer" and reach is not None:
            # Distinguish viewer list count from *Reach*, which is a distinct
            # Insights metric in the Meta Professional API.
            raise ValueError("Native viewer-list count cannot be labeled Reach")
        if document["measurementSource"] == "professional_story_insights" and \
           viewer_list_count is not None:
            raise ValueError("Professional Story Insights is not a viewer identity list")
        output.append({
            "stage": index, "event": step["event"],
            "views": views, "reach": reach, "viewerListCount": viewer_list_count,
        })
    return output


def evaluate(document: object) -> dict:
    steps = validate(document)
    same_window = document["metricComparability"] == "same_story_same_window"
    transition = []
    for before, after in zip(steps, steps[1:]):
        differences = {
            name: (after[name] - before[name]) if
                  after[name] is not None and before[name] is not None else None
            for name in ("views", "reach", "viewerListCount")
        }
        warnings = []
        if any(value is not None and value < 0 for value in differences.values()):
            warnings.append("counter_decrease_or_revision")
        transition.append({
            "fromStage": before["stage"],
            "toStage": after["stage"],
            "action": after["event"],
            "metricDeltas": differences,
            "warnings": warnings,
            "individualReplayAttribution": "not_available",
        })
    last = steps[-1]
    views, reach = last["views"], last["reach"]
    excess = views - reach if views is not None and reach is not None and same_window else None
    if excess is None:
        diagnostic = "not_computable_due_to_absent_or_noncomparable_metrics"
    elif excess < 0:
        diagnostic = "inconsistent_or_unsynchronized_views_reach"
    elif excess == 0:
        diagnostic = "equal_counts_do_not_exclude_unmeasured_replay"
    else:
        diagnostic = "excess_display_counts_not_confirmed_story_replays"
    return {
        "schema": "khanh.igplus.nonplus-report.v1",
        "accountType": document["accountType"],
        "measurementSource": document["measurementSource"],
        "metricComparability": document["metricComparability"],
        "observations": len(steps),
        "lastCounts": {
            "views": views,
            "reach": reach,
            "viewerListCount": last["viewerListCount"]
        },
        "arithmeticViewsMinusReach": excess,
        "arithmeticDiagnostic": diagnostic,
        "transitions": transition,
        "conclusions": {
            "publicOrNativeAggregateObserved": True,
            "instagramPlusRewatchCountVerified": False,
            "instagramPlusViewerTimestampVerified": False,
            "namedIndividualRewatchVerified": False,
            "subscriptionEntitlementVerified": False,
            "anyPrivateIOSAPIEndpointDiscovered": False,
        },
        "limitations": [
            "Story viewer list count is not necessarily the professional Insights reach metric.",
            "Different app surfaces, time windows or delayed metrics cannot be subtracted reliably.",
            "Even comparable views minus reach is not proof of Instagram Plus rewatch semantics.",
            "An aggregate count alone never identifies who replayed a Story.",
            "This research tool makes no network requests and accepts no account identifiers.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", help="Local sanitized manual observations (no usernames/tokens)")
    args = parser.parse_args()
    try:
        source = Path(args.file)
        if not source.is_file() or source.stat().st_size > MAX_BYTES:
            raise ValueError("Missing or too large")
        data = json.loads(source.read_text(encoding="utf-8"))
        report = evaluate(data)
    except (OSError, ValueError, TypeError, UnicodeError):
        parser.error("Invalid local non-Plus observations")
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

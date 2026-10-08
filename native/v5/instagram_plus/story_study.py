#!/usr/bin/env python3
"""Instagram Plus Story viewer research — OFFLINE, consented synthetic experiment.

This never contacts Instagram and never infers repeat-viewer identities.
Accepts only explicitly anonymized TEST PARTICIPANT IDs A/B/C/D and
relative session offsets (not real timestamps). No usernames, Story URL,
cookies, identifiers, private API requests or login credentials.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

SCHEMA = "khanh.igplus.story-study.v1"
MAX_BYTES = 32768
MAX_STAGES = 12
PARTICIPANTS = frozenset(("A", "B", "C", "D"))
EVENTS = frozenset(("baseline", "new_view", "replay_by_consenter",
                    "refresh_only", "relaunch", "control_wait"))
SEMANTICS = frozenset(("unknown", "replay_events", "unique_rewatchers"))
TIMESTAMP_SEMANTICS = frozenset(("unknown", "first_view", "last_view"))
MAX_OFFSET = 10080


def _int_or_none(value):
    if value is None:
        return None
    if type(value) is not int or not 0 <= value <= MAX_OFFSET:
        raise ValueError("Invalid relative offset/count")
    return value


def validate(study: object) -> tuple[list[dict], str, str]:
    if not isinstance(study, dict) or study.get("schema") != SCHEMA:
        raise ValueError("Invalid research schema")
    if study.get("countSemantics") not in SEMANTICS or \
       study.get("timestampSemantics") not in TIMESTAMP_SEMANTICS:
        raise ValueError("Invalid field meaning")
    stages = study.get("stages")
    if not isinstance(stages, list) or not 2 <= len(stages) <= MAX_STAGES:
        raise ValueError("Invalid stage list length")
    safe = []
    seen = set()
    previous_time = -1
    for index, stage in enumerate(stages):
        if not isinstance(stage, dict) or stage.get("event") not in EVENTS:
            raise ValueError("Invalid stage event")
        label = stage.get("label")
        if type(label) is not int or label != index:
            raise ValueError("Stage labels must be consecutive numeric indexes")
        observed_at = _int_or_none(stage.get("offsetMinutes"))
        if observed_at is None or observed_at < previous_time:
            raise ValueError("Stage offsets must be increasing or equal")
        previous_time = observed_at
        actor = stage.get("testActor")
        if actor is not None and actor not in PARTICIPANTS:
            raise ValueError("Not a consented test participant")
        if stage["event"] in ("new_view", "replay_by_consenter") and actor is None:
            raise ValueError("Controlled viewer actions need an explicit consenter")
        if stage["event"] not in ("new_view", "replay_by_consenter") and actor is not None:
            raise ValueError("Non-action events must not claim a viewer")
        replay = _int_or_none(stage.get("rewatchDisplay"))
        audience = stage.get("viewerTimeOffsets")
        if not isinstance(audience, dict) or len(audience) > 4:
            raise ValueError("Invalid viewer test set")
        viewer_times = {}
        for participant, raw in audience.items():
            if participant not in PARTICIPANTS:
                raise ValueError("Only anonymized, consenting A/B/C/D participants allowed")
            when = _int_or_none(raw)
            if when is not None and when > observed_at:
                raise ValueError("A displayed viewing offset cannot be in the future")
            viewer_times[participant] = when
        current = {
            "stage": index,
            "event": stage["event"],
            "offsetMinutes": observed_at,
            "testActor": actor,
            "rewatchDisplay": replay,
            "viewerTimeOffsets": viewer_times,
        }
        safe.append(current)
    return safe, study["countSemantics"], study["timestampSemantics"]


def ambiguity(eligible_viewers: int, rewatch_value: int | None,
              semantics: str) -> dict:
    """Combinatorics only; assumes all n participants independently eligible.

    This models how little an aggregate reveals, not account-specific behavior.
    """
    if rewatch_value is None or not eligible_viewers or semantics == "unknown":
        return {"assignmentCount": None, "interpretation": "not_identifiable_from_current_evidence"}
    if rewatch_value > 10000:
        raise ValueError("Count above research cap")
    if semantics == "unique_rewatchers":
        possibilities = math.comb(eligible_viewers, rewatch_value) \
            if rewatch_value <= eligible_viewers else 0
    elif semantics == "replay_events":
        possibilities = math.comb(rewatch_value + eligible_viewers - 1, eligible_viewers - 1)
    else:
        possibilities = None
    return {
        "assignmentCount": possibilities,
        "interpretation": "multiple_allocations" if possibilities > 1
                          else "one_allocation_only_under_assumptions",
    }


def evaluate(study: object) -> dict:
    stages, count_semantics, timestamp_semantics = validate(study)
    transitions = []
    candidates = set()
    for before, after in zip(stages, stages[1:]):
        left, right = before["viewerTimeOffsets"], after["viewerTimeOffsets"]
        changed = sorted(
            p for p in left.keys() & right.keys()
            if left[p] is not None and right[p] is not None and right[p] != left[p]
        )
        candidates.update(changed)
        old_count, new_count = before["rewatchDisplay"], after["rewatchDisplay"]
        delta = new_count - old_count if old_count is not None and new_count is not None else None
        # Timestamp change could mean replay, normalization, or a UI/cache refresh.
        # This does not establish viewer attribution.
        transitions.append({
            "fromStage": before["stage"],
            "toStage": after["stage"],
            "event": after["event"],
            "controlledTestActor": after["testActor"],
            "timestampChanges": changed,
            "rewatchCountDelta": delta,
            "interpretation": "correlation_only_not_identity",
        })

    last = stages[-1]
    viewers = len(set().union(*(set(s["viewerTimeOffsets"]) for s in stages)))
    ambiguous = ambiguity(viewers, last["rewatchDisplay"], count_semantics)
    return {
        "schema": "khanh.igplus.story-study-result.v1",
        "stages": len(stages),
        "controlledParticipantCount": viewers,
        "countSemantics": count_semantics,
        "timestampSemantics": timestamp_semantics,
        "transitions": transitions,
        "timestampChangeCandidates": sorted(candidates),
        "aggregateInference": ambiguous,
        "conclusions": {
            "totalRewatchCountObserved": last["rewatchDisplay"] is not None,
            "timestampsWereSeenChange": bool(candidates),
            "individualRewatchIdentityVerifiedByInstagram": False,
            "timestampUpdateCausesEstablished": False,
            "paidPlusEntitlementVerified": False,
            "privateAPIEndpointDiscovered": False,
        },
        "limitations": [
            "Aggregate replay statistics cannot generally assign replays to named people.",
            "The official meaning of rewatch count must be verified per app version.",
            "A timestamp change may follow cache refresh, polling, or other updates.",
            "Observed consenting test actors are known by experiment design, not by Instagram's rewatch data.",
            "Only participants A-D and session-relative time offsets are allowed; no actual account records.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("study", help="Local, anonymized, consenting test study JSON")
    args = parser.parse_args()
    try:
        p = Path(args.study)
        if not p.is_file() or p.stat().st_size > MAX_BYTES:
            raise ValueError("Input missing or too large")
        result = evaluate(json.loads(p.read_text(encoding="utf-8")))
    except (OSError, ValueError, TypeError, KeyError, UnicodeError):
        parser.error("Invalid private study; use anonymous A/B/C/D test participants only")
    print(json.dumps(result, sort_keys=True, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Consent-limited Instagram Plus Story metrics: no identity inference, offline."""
import importlib.util
import json
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("story_study", ROOT / "story_study.py")
STUDY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(STUDY)
EXAMPLE = json.loads((ROOT / "EXAMPLE_STORY_STUDY.json").read_text())


def make(**changes):
    obj = json.loads(json.dumps(EXAMPLE))
    obj.update(changes)
    return obj


class StoryResearchTest(unittest.TestCase):
    def test_example_reports_only_correlation_and_never_confirms_identity(self):
        r = STUDY.evaluate(EXAMPLE)
        self.assertEqual(r["stages"], 4)
        self.assertEqual(r["controlledParticipantCount"], 2)
        self.assertEqual(r["timestampChangeCandidates"], ["A"])
        self.assertEqual(r["transitions"][1]["rewatchCountDelta"], 1)
        self.assertEqual(r["transitions"][1]["timestampChanges"], ["A"])
        self.assertEqual(r["transitions"][1]["controlledTestActor"], "A")
        self.assertEqual(r["transitions"][1]["interpretation"], "correlation_only_not_identity")
        self.assertFalse(r["conclusions"]["individualRewatchIdentityVerifiedByInstagram"])
        self.assertFalse(r["conclusions"]["paidPlusEntitlementVerified"])
        self.assertFalse(r["conclusions"]["timestampUpdateCausesEstablished"])

    def test_unknown_count_semantics_prevents_overstating_assignment(self):
        r = STUDY.evaluate(EXAMPLE)
        self.assertIsNone(r["aggregateInference"]["assignmentCount"])
        self.assertEqual(r["aggregateInference"]["interpretation"],
                         "not_identifiable_from_current_evidence")

    def test_replay_event_ambiguity_from_aggregate_n3_r2(self):
        a = STUDY.ambiguity(3, 2, "replay_events")
        self.assertEqual(a["assignmentCount"], 6)
        self.assertEqual(a["interpretation"], "multiple_allocations")
        self.assertNotIn("identity", json.dumps(a))

    def test_unique_rewatchers_ambiguity_n3_u2(self):
        a = STUDY.ambiguity(3, 2, "unique_rewatchers")
        self.assertEqual(a["assignmentCount"], 3)
        self.assertEqual(a["interpretation"], "multiple_allocations")

    def test_single_possible_allocation_is_conditional_not_identity_proof(self):
        a = STUDY.ambiguity(1, 2, "replay_events")
        self.assertEqual(a["assignmentCount"], 1)
        self.assertIn("under_assumptions", a["interpretation"])

    def test_refresh_only_timestamp_change_not_classified_as_replay(self):
        x = make()
        x["stages"][-1]["viewerTimeOffsets"]["B"] = 11
        r = STUDY.evaluate(x)
        self.assertEqual(r["transitions"][-1]["event"], "refresh_only")
        self.assertEqual(r["transitions"][-1]["timestampChanges"], ["B"])
        self.assertEqual(r["transitions"][-1]["interpretation"], "correlation_only_not_identity")

    def test_no_timestamp_change_does_not_prove_no_replay(self):
        x = make()
        x["stages"][2]["viewerTimeOffsets"]["A"] = 0
        x["stages"][3]["viewerTimeOffsets"]["A"] = 0
        r = STUDY.evaluate(x)
        self.assertFalse(r["conclusions"]["timestampsWereSeenChange"])
        self.assertEqual(r["transitions"][1]["rewatchCountDelta"], 1)

    def test_count_may_be_none_without_fabricated_zero(self):
        x = make()
        x["stages"][2]["rewatchDisplay"] = None
        r = STUDY.evaluate(x)
        self.assertIsNone(r["transitions"][1]["rewatchCountDelta"])

    def test_reject_unconsented_username_and_app_user_ids(self):
        for viewer in ("alice", "user_1789912", "@someone", "A@instagram.com"):
            x = make()
            x["stages"][0]["viewerTimeOffsets"][viewer] = 1
            with self.subTest(viewer=viewer), self.assertRaises(ValueError):
                STUDY.evaluate(x)

    def test_reject_real_or_numerical_actor_identifiers(self):
        for actor in ("@someone", "abc", 123, None):
            x = make()
            x["stages"][2]["testActor"] = actor
            with self.subTest(actor=actor), self.assertRaises((ValueError, TypeError)):
                STUDY.evaluate(x)

    def test_reject_actor_on_passive_refresh(self):
        x = make()
        x["stages"][-1]["testActor"] = "A"
        with self.assertRaises(ValueError):
            STUDY.evaluate(x)

    def test_reject_past_timestamp_that_is_in_future_relative_to_measurement(self):
        x = make()
        x["stages"][1]["viewerTimeOffsets"]["B"] = 6
        with self.assertRaises(ValueError):
            STUDY.evaluate(x)

    def test_reject_negative_and_excessive_counts(self):
        for value in (-1, 10081, "12", True):
            x = make()
            x["stages"][2]["rewatchDisplay"] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                STUDY.evaluate(x)

    def test_reject_nonmonotonic_stage_offsets(self):
        x = make()
        x["stages"][3]["offsetMinutes"] = 2
        with self.assertRaises(ValueError):
            STUDY.evaluate(x)

    def test_reject_invalid_stage_tags_and_duplicate_stage_indexes(self):
        x = make()
        x["stages"][2]["event"] = "watch_someones_private_story"
        with self.assertRaises(ValueError):
            STUDY.evaluate(x)
        x = make()
        x["stages"][1]["label"] = 0
        with self.assertRaises(ValueError):
            STUDY.evaluate(x)

    def test_never_output_extra_input_fields_or_private_data(self):
        x = make(token="private_token_topsecret")
        x["stages"][1]["instagramUserId"] = "SENSITIVE_USER_ID_8292"
        x["stages"][2]["storyURL"] = "https://instagram.com/stories/person/sensitive"
        x["stages"][3]["cookie"] = "super-secret-cookie"
        x["stages"][0]["viewerTimeOffsets"] = {"A": 0, "B": None}
        r = json.dumps(STUDY.evaluate(x))
        for secret in ("private_token_topsecret", "SENSITIVE_USER_ID_8292",
                       "instagram.com", "super-secret-cookie", "storyURL"):
            self.assertNotIn(secret, r)

    def test_unknown_timestamp_semantics_is_explicitly_preserved(self):
        r = STUDY.evaluate(EXAMPLE)
        self.assertEqual(r["timestampSemantics"], "unknown")

    def test_bad_count_semantics_rejected(self):
        for value in ("rewatches_by_named_user", "identities", None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                STUDY.evaluate(make(countSemantics=value))

    def test_malformed_or_oversized_stage_list_rejected(self):
        for stages in ([], [None], [EXAMPLE["stages"][0]] * 13):
            with self.assertRaises(ValueError):
                STUDY.evaluate(make(stages=stages))

    def test_grouped_count_never_identifies_nonconsenting_users(self):
        r = STUDY.evaluate(EXAMPLE)
        txt = json.dumps(r)
        self.assertNotIn("username", txt)
        self.assertNotIn("real_account_id", txt)
        self.assertNotIn("anonymous_story_viewer", txt)

    def test_no_network_or_dynamic_eval_apis_in_analyzer(self):
        source = (ROOT / "story_study.py").read_text()
        for term in ("urllib.request", "requests.get(", "requests.post(",
                     "socket.", "subprocess.", "eval(", "exec(", "$httpClient",
                     "is_premium = true", "Authorization: Bearer"):
            self.assertNotIn(term, source)

    def test_file_example_is_valid_and_json_serializable(self):
        with tempfile.TemporaryDirectory() as t:
            p = pathlib.Path(t) / "test.json"
            p.write_text(json.dumps(EXAMPLE))
            out = STUDY.evaluate(json.loads(p.read_text()))
            self.assertEqual(out["schema"], "khanh.igplus.story-study-result.v1")


if __name__ == "__main__":
    unittest.main()

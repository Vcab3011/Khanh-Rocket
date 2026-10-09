"""Test non-Plus, no-account, offline story viewer/replay research semantics."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
FILE=ROOT / "nonplus_baseline.py"
SPEC=importlib.util.spec_from_file_location("nonplus_baseline",FILE)
MOD=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MOD)
FIXTURE_DIR=ROOT / "fixtures"
PERSONAL=json.loads((FIXTURE_DIR/"nonplus_native_synthetic.json").read_text())
CREATOR=json.loads((FIXTURE_DIR/"nonplus_professional_synthetic.json").read_text())

def make(doc, **updates):
    value=json.loads(json.dumps(doc))
    value.update(updates)
    return value

class NonPlusBaselineTest(unittest.TestCase):
    def test_personal_account_does_not_require_plus_or_professional_insights(self):
        r=MOD.evaluate(PERSONAL)
        self.assertEqual(r["accountType"],"personal")
        self.assertEqual(r["arithmeticViewsMinusReach"],None)
        self.assertEqual(r["arithmeticDiagnostic"],
                         "not_computable_due_to_absent_or_noncomparable_metrics")
        self.assertFalse(r["conclusions"]["instagramPlusViewerTimestampVerified"])

    def test_professional_insights_conditional_excess_not_real_replay(self):
        r=MOD.evaluate(CREATOR)
        self.assertEqual(r["arithmeticViewsMinusReach"],3)
        self.assertEqual(r["arithmeticDiagnostic"],
                         "excess_display_counts_not_confirmed_story_replays")
        self.assertFalse(r["conclusions"]["instagramPlusRewatchCountVerified"])
        self.assertFalse(r["conclusions"]["namedIndividualRewatchVerified"])

    def test_delta_preserves_replay_control_without_claiming_identity(self):
        r=MOD.evaluate(CREATOR)
        self.assertEqual(r["transitions"][0]["metricDeltas"]["views"],2)
        self.assertEqual(r["transitions"][0]["metricDeltas"]["reach"],0)
        self.assertEqual(r["transitions"][0]["individualReplayAttribution"],"not_available")
        self.assertEqual(r["transitions"][1]["metricDeltas"]["views"],0)

    def test_personal_viewer_list_count_is_not_reach(self):
        x=make(PERSONAL)
        x["steps"][1]["reach"]=1
        with self.assertRaises(ValueError):
            MOD.evaluate(x)

    def test_professional_insights_does_not_contain_named_viewer_count(self):
        x=make(CREATOR)
        x["steps"][1]["viewerListCount"]=15
        with self.assertRaises(ValueError):
            MOD.evaluate(x)

    def test_personal_account_cannot_claim_professional_api(self):
        x=make(CREATOR,accountType="personal")
        with self.assertRaises(ValueError):
            MOD.evaluate(x)

    def test_no_premium_account_or_subscription_is_claimed(self):
        for example in (CREATOR,PERSONAL):
            r=MOD.evaluate(example)
            self.assertTrue(all(val is False for key,val in r["conclusions"].items()
                                if "Verified" in key or "Discovered" in key))

    def test_unknown_metric_comparability_does_not_subtract(self):
        x=make(CREATOR,metricComparability="unknown")
        r=MOD.evaluate(x)
        self.assertIsNone(r["arithmeticViewsMinusReach"])

    def test_different_window_does_not_subtract(self):
        x=make(CREATOR,metricComparability="not_comparable")
        r=MOD.evaluate(x)
        self.assertIsNone(r["arithmeticViewsMinusReach"])

    def test_views_below_reach_flags_nonaligned_counts(self):
        x=make(CREATOR)
        x["steps"][-1]["views"]=7
        r=MOD.evaluate(x)
        self.assertEqual(r["arithmeticViewsMinusReach"],-2)
        self.assertEqual(r["arithmeticDiagnostic"],
                         "inconsistent_or_unsynchronized_views_reach")

    def test_equal_counts_do_not_prove_absence_of_replays(self):
        x=make(CREATOR)
        x["steps"][-1]["views"]=9
        r=MOD.evaluate(x)
        self.assertEqual(r["arithmeticViewsMinusReach"],0)
        self.assertEqual(r["arithmeticDiagnostic"],
                         "equal_counts_do_not_exclude_unmeasured_replay")

    def test_backward_counter_flags_revision_but_does_not_raise_false_replay(self):
        x=make(CREATOR)
        x["steps"][1]["views"]=8
        r=MOD.evaluate(x)
        self.assertIn("counter_decrease_or_revision",r["transitions"][0]["warnings"])

    def test_partial_metric_snapshot_keeps_null_not_fake_zero(self):
        x=make(CREATOR)
        x["steps"][-1]["views"]=None
        r=MOD.evaluate(x)
        self.assertIsNone(r["arithmeticViewsMinusReach"])
        self.assertIsNone(r["transitions"][-1]["metricDeltas"]["views"])

    def test_reject_missing_metrics_even_if_stage_present(self):
        x=make(PERSONAL)
        x["steps"][0]["viewerListCount"]=None
        with self.assertRaises(ValueError):
            MOD.evaluate(x)

    def test_reject_negative_huge_boolean_and_string_counts(self):
        for bad in (-1,10_000_001,True,"12",1.2):
            x=make(CREATOR)
            x["steps"][0]["views"]=bad
            with self.subTest(bad=bad),self.assertRaises(ValueError):
                MOD.evaluate(x)

    def test_reject_bad_stage_labels_and_events(self):
        for key,value in (("stage",9),("event","secret_profile_lookup")):
            x=make(PERSONAL)
            x["steps"][0][key]=value
            with self.assertRaises(ValueError):
                MOD.evaluate(x)

    def test_reject_invalid_account_types_and_source(self):
        for key,bad in (("accountType","plus_unlocked"),
                        ("measurementSource","undocumented_private_api"),
                        ("metricComparability","trust_me")):
            x=make(CREATOR,**{key:bad})
            with self.assertRaises(ValueError):
                MOD.evaluate(x)

    def test_reject_oversized_steps(self):
        x=make(CREATOR,steps=[CREATOR["steps"][0]]*31)
        with self.assertRaises(ValueError):
            MOD.evaluate(x)

    def test_no_original_metadata_or_sensitive_fields_in_output(self):
        x=make(CREATOR,authorization="Bearer TOP_SECRET",
               storyId="SECRET_STORY_123",username="@confidential")
        x["steps"][0]["viewerUrl"]="https://www.instagram.com/stories/user/SECRET"
        x["steps"][1]["rawBody"]={"viewer":"OTHER_PRIVATE"}
        serialized=json.dumps(MOD.evaluate(x))
        for secret in ("TOP_SECRET","SECRET_STORY","@confidential",
                       "viewerUrl","instagram.com","OTHER_PRIVATE"):
            self.assertNotIn(secret,serialized)

    def test_not_tricked_by_name_and_id_arrays_in_extra_keys(self):
        x=make(PERSONAL,viewers=[{"username":"VERY_PRIVATE","id":"PRIVATE_UID"}])
        r=json.dumps(MOD.evaluate(x))
        self.assertNotIn("VERY_PRIVATE",r)
        self.assertNotIn("PRIVATE_UID",r)

    def test_reject_non_dict_docs_and_non_list_steps(self):
        for x in ({},[],None,{"schema":MOD.SCHEMA,"steps":"not-an-array"}):
            with self.assertRaises((TypeError,ValueError)):
                MOD.evaluate(x)

    def test_source_contains_no_outbound_network_or_eval(self):
        code=FILE.read_text()
        for forbidden in ("requests.get(","requests.post(","urllib.request",
                          "socket.","subprocess.","eval(","exec(","$httpClient",
                          "api.instagram.com","graph.instagram.com",
                          "is_premium", "purchase_receipt"):
            self.assertNotIn(forbidden,code)

    def test_example_fixtures_are_synthetic_and_have_no_identifiers(self):
        for name in ("nonplus_native_synthetic.json","nonplus_professional_synthetic.json"):
            text=(FIXTURE_DIR/name).read_text()
            for forbidden in ("username","storyId","userId","instagram.com",
                              "cookie","access_token"):
                self.assertNotIn(forbidden,text)
            self.assertGreaterEqual(MOD.evaluate(json.loads(text))["observations"],2)

if __name__=="__main__":
    unittest.main()

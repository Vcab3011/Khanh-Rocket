"""Test lossless rejection of sensitive metadata in Apple App Privacy Reports."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

FILE = Path(__file__).resolve().parents[1] / "apple_privacy_report.py"
spec = importlib.util.spec_from_file_location("apple_privacy_report", FILE)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)

def record(bundle="com.sandbox.insta", domain="private.instagram.com", hits=3, initiated="AppInitiated"):
    return {
        "bundleID": bundle,
        "type": "networkActivity",
        "domain": domain,
        "context": "https://instagram.com/username/my-friend?token=secret-value",
        "domainOwner": "PRIVATE_PERSON",
        "firstTimeStamp": "2026-10-08T15:00:00Z",
        "timeStamp": "2026-10-08T15:01:00Z",
        "hits": hits,
        "initiatedType": initiated,
        "identifier": "secret-user-id-123",
    }

class ApplePrivacyReportTest(unittest.TestCase):
    def report(self, events, app="instagram", bundle="com.sandbox.insta"):
        lines = (json.dumps(event) for event in events)
        return reader.summarize_lines(lines, app, bundle)

    def test_scopes_to_explicit_bundle_and_aggregate_domain_groups(self):
        records = [record(), record(domain="unrelated.example",hits=4),
                   record(bundle="com.example.other",hits=999)]
        r = self.report(records)
        self.assertEqual(r["matchedRecordCount"],2)
        groups = {x["group"]: x["hits"] for x in r["activityCounts"]}
        self.assertEqual(groups["app|related"],3)
        self.assertEqual(groups["app|other"],4)
        self.assertFalse(r["assertions"]["subscriptionServerVerified"])
        self.assertFalse(r["assertions"]["exactFeatureEndpointKnown"])

    def test_snapchat_domains_without_exposing_literal_host(self):
        events = [record(bundle="com.sandbox.snap",domain="media.snapchat.com",hits=9),
                  record(bundle="com.sandbox.snap",domain="edge.sc-cdn.net",hits=5,
                         initiated="NonAppInitiated")]
        r = self.report(events, app="snapchat",bundle="com.sandbox.snap")
        groups = {x["group"]:x["hits"] for x in r["activityCounts"]}
        self.assertEqual(groups["app|related"],9)
        self.assertEqual(groups["user|related"],5)
        self.assertNotIn("snapchat.com",json.dumps(r))
        self.assertNotIn("sc-cdn.net",json.dumps(r))

    def test_no_pii_identifiers_url_path_domain_timestamps_or_bundle_id(self):
        r = self.report([record()])
        s = json.dumps(r)
        for secret in ("com.sandbox.insta","private.instagram.com","secret-value",
                       "PRIVATE_PERSON","2026-10-08T","secret-user-id-123",
                       "/username/","token="):
            self.assertNotIn(secret,s)

    def test_unrelated_user_app_traffic_is_excluded(self):
        r = self.report([record(bundle="com.victim.other",domain="instagram.com",hits=500)])
        self.assertEqual(r["matchedRecordCount"],0)
        self.assertTrue(all(x["hits"]==0 for x in r["activityCounts"]))

    def test_invalid_domain_or_similar_lookalike_is_unrelated(self):
        for domain in ("instagram.com.evil.example","http://instagram.com",
                       "hello@example.com","[::1]","../../../instagram.com"):
            self.assertEqual(reader.group_domain(domain,"instagram"),"other")

    def test_non_network_events_not_inspected(self):
        r = self.report([{"type":"access","bundleID":"com.sandbox.insta",
                           "domain":"instagram.com","hits":1000}])
        self.assertEqual(r["matchedRecordCount"],0)

    def test_bad_events_and_hit_count_are_rejected_safely(self):
        with self.assertRaises(ValueError):
            self.report([record(hits="JWT VERY_PRIVATE")])
        with self.assertRaises(ValueError):
            self.report(["not json"])
        with self.assertRaises(ValueError):
            reader.summarize_lines(["not-json"],"instagram","com.sandbox.insta")

    def test_real_ndjson_file_read_does_not_output_file_name(self):
        with tempfile.TemporaryDirectory() as temp:
            p=Path(temp)/"token_PASSWORD_PRIVATE.ndjson"
            p.write_text(json.dumps(record())+"\n",encoding="utf-8")
            summary=reader.load_and_summarize(str(p),"instagram","com.sandbox.insta")
            self.assertEqual(summary["matchedRecordCount"],1)
            self.assertNotIn("PASSWORD_PRIVATE",json.dumps(summary))

    def test_no_bundle_id_required_guessing(self):
        with self.assertRaises(ValueError):
            reader.summarize_lines([], "instagram","")
        with self.assertRaises(ValueError):
            reader.summarize_lines([], "other","bundle")

    def test_page_limit_for_record_large(self):
        with self.assertRaises(ValueError):
            reader.summarize_lines(["x"*100001], "instagram","com.sandbox.insta")

if __name__ == "__main__":
    unittest.main()

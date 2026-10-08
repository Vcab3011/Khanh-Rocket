"""Offline security regression tests for user-supplied HAR metadata reduction."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

FILE = Path(__file__).resolve().parents[1] / "har_metadata.py"
spec = importlib.util.spec_from_file_location("har_metadata", FILE)
har = importlib.util.module_from_spec(spec)
spec.loader.exec_module(har)


def entry(url="https://i.instagram.com/api/v1/private?token=SUPER_SECRET_TOKEN",
          method="POST", status=200, mime="application/json", ver="h2",
          time=230.0):
    return {
        "request": {
            "url": url, "method": method, "httpVersion": ver,
            "headers": [{"name": "Authorization", "value": "Bearer VERY_PRIVATE"}],
            "cookies": [{"name": "sessionid", "value": "COOKIE_PRIVATE"}],
            "postData": {"text": '{"password":"NOT_FOR_LOGGING"}'},
        },
        "response": {
            "status": status, "headers": [{"name": "Set-Cookie", "value": "COOKIE_PRIVATE"}],
            "content": {
                "mimeType": mime,
                "text": "PRIVATE_STORY_AND_SNAPCHAT_MESSAGES"
            },
        },
        "time": time,
        "serverIPAddress": "192.0.2.123",
        "comment": "ACCOUNT_ID_1234567",
    }


def make_har(*items):
    return {"log": {"version": "1.2", "entries": list(items)}}


class PassiveHarTest(unittest.TestCase):
    def test_instagram_graphql_json_candidate_is_only_content_type_hint(self):
        report = har.summarize(make_har(entry()), "instagram", "paywall")
        self.assertEqual(report["entryCount"], 1)
        self.assertEqual(report["relatedDomainCount"], 1)
        self.assertEqual(report["protocolHints"]["h2"], 1)
        self.assertEqual(report["counts"][0]["group"],
                         "related|POST|2xx|json|h2|100to499ms")
        self.assertFalse(report["assertions"]["bodyOrEndpointSchemaKnown"])
        self.assertFalse(report["assertions"]["subscriptionServerVerified"])

    def test_snapchat_grpc_h3_and_protobuf_format_distinction(self):
        a = entry("https://app.snapchat.com/private?jwt=SECRET",
                  mime="application/grpc+proto", ver="HTTP/3", time=50.0)
        b = entry("https://snapchat.com/another?uid=123",
                  mime="application/x-protobuf", ver="h2", time=900.0)
        r = har.summarize(make_har(a, b), "snapchat", "feature_open")
        self.assertEqual(r["relatedDomainCount"], 2)
        self.assertEqual(r["protocolHints"]["h3"], 1)
        self.assertEqual(r["protocolHints"]["h2"], 1)
        self.assertIn("related|POST|2xx|grpc|h3|lt100ms",
                      [x["group"] for x in r["counts"]])
        self.assertIn("related|POST|2xx|protobuf|h2|500to1999ms",
                      [x["group"] for x in r["counts"]])

    def test_no_urls_tokens_accounts_body_headers_or_timestamps_leak(self):
        example = entry()
        raw = json.dumps(example)
        assert "VERY_PRIVATE" in raw
        sanitized = json.dumps(har.summarize(make_har(example), "instagram", "baseline"))
        for secret in ("SUPER_SECRET_TOKEN", "Bearer", "VERY_PRIVATE", "COOKIE_PRIVATE",
                       "NOT_FOR_LOGGING", "PRIVATE_STORY", "ACCOUNT_ID_1234567",
                       "192.0.2.123", "sessionid", "i.instagram.com",
                       "/api/v1/private"):
            self.assertNotIn(secret, sanitized, secret)

    def test_cross_app_ownership_not_inferred_from_arbitrary_host(self):
        unrelated = entry("https://instagram.com.evil.example/account?foo=TOKEN")
        r = har.summarize(make_har(unrelated), "instagram", "baseline")
        self.assertEqual(r["relatedDomainCount"], 0)
        other_app = har.summarize(make_har(entry()), "snapchat", "baseline")
        self.assertEqual(other_app["relatedDomainCount"], 0)

    def test_related_domains_are_not_declared_purchase_endpoints(self):
        r = har.summarize(make_har(entry("https://www.instagram.com/?id=x")),
                          "instagram", "paywall")
        self.assertTrue(r["relatedDomainCount"])
        self.assertFalse(r["assertions"]["bodyOrEndpointSchemaKnown"])
        self.assertFalse(r["assertions"]["subscriptionServerVerified"])

    def test_strips_query_subdomain_http_errors_and_comment(self):
        a = entry("https://p.scdn.snapchat.com/secret?token=OHNO",
                  status=403, mime="text/html", time=1500)
        r = har.summarize(make_har(a), "snapchat", "refresh")
        self.assertEqual(r["counts"][0]["group"], "related|POST|4xx|html|h2|500to1999ms")
        self.assertNotIn("OHNO", json.dumps(r))

    def test_oversized_events_rejected(self):
        with self.assertRaisesRegex(ValueError, "oversized"):
            har.summarize(make_har(*([entry()] * 10001)), "instagram", "baseline")

    def test_invalid_entries_fail_closed(self):
        for item in (None, {}, {"request": {}, "response": None}, "broken"):
            with self.assertRaises(ValueError):
                har.summarize(make_har(item), "snapchat", "baseline")

    def test_invalid_http_code_and_mime_never_leak(self):
        bad = entry(status="JWT SECRET", mime="application/json;token=TOP_SECRET",
                    time=float("inf"))
        r = har.summarize(make_har(bad), "instagram", "paywall")
        self.assertEqual(r["counts"][0]["group"],
                         "related|POST|unknown|json|h2|unknown")
        self.assertNotIn("SECRET", json.dumps(r))

    def test_bad_url_schemes_and_malformed_url_are_other(self):
        for candidate in ("http://instagram.com/private", "not a url",
                          "https://[invalid-url/", None):
            self.assertEqual(har.classify_host(candidate, "instagram"), "other")

    def test_metadata_only_diff_retains_no_original_event(self):
        base = har.summarize(make_har(entry(time=34)), "instagram", "baseline")
        test = har.summarize(make_har(entry(time=650), entry(time=650)),
                             "instagram", "feature_open")
        diff = har.compare(base, test)
        self.assertEqual(diff["entryDelta"], 1)
        self.assertEqual(diff["app"], "instagram")
        self.assertEqual(len(diff["countChanges"]), 2)
        self.assertNotIn("SUPER_SECRET_TOKEN", json.dumps(diff))
        self.assertIn("do not establish", diff["caveat"])
        with self.assertRaises(ValueError):
            har.compare(base, har.summarize(make_har(), "snapchat", "feature_open"))

    def test_invalid_stage_and_app_rejected(self):
        with self.assertRaises(ValueError):
            har.summarize(make_har(), "all_apps", "baseline")
        with self.assertRaises(ValueError):
            har.summarize(make_har(), "instagram", "run_external_payload")

    def test_local_json_does_not_emit_filename_or_secrets(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "real_user_token_do_not_print.har"
            p.write_text(json.dumps(make_har(entry())), encoding="utf-8")
            r = har.summarize(har.load_local_json(str(p)), "instagram", "baseline")
            self.assertNotIn("real_user_token", json.dumps(r))
            p.write_text("not-json", encoding="utf-8")
            with self.assertRaises(ValueError):
                har.load_local_json(str(p))


if __name__ == "__main__":
    unittest.main()

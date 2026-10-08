"""Instagram Plus research classifier: deterministic, offline, privacy tests."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("igplus_assess", ROOT / "assess.py")
M = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(M)
CATALOG = json.loads((ROOT / "FEATURE_CATALOG.json").read_text(encoding="utf8"))


def obs(key="story_extend_48h", stage="attempt", ui="visible", action="not_tested",
        evidence="self_ui", **extra):
    return {"feature": key, "stage": stage, "ui": ui, "action": action,
            "evidence": evidence, **extra}


def assessment(*values):
    return M.assess(CATALOG, {"schema": "khanh.igplus.observations.v1",
                              "observations": list(values)})


def status(report, key):
    return next(f["state"] for f in report["features"] if f["feature"] == key)


class InstagramPlusStudyTest(unittest.TestCase):

    def test_catalog_is_source_grounded_and_bounded(self):
        idx = M.catalog_index(CATALOG)
        self.assertEqual(len(idx), 15)
        self.assertIn("story_extend_48h", idx)
        self.assertIn("story_rewatch_insights", idx)
        self.assertIn("story_viewer_search", idx)
        self.assertIn("custom_story_fonts", idx)
        self.assertIn("dm_previews", idx)
        self.assertEqual(idx["story_preview"]["boundary"], "server_privacy")
        for f in idx.values():
            self.assertTrue(f["source"].startswith("https://about.fb.com/"))
            self.assertIsNone(f["apiEndpoint"])
            self.assertFalse(f["backendAuthorizationVerified"])

    def test_user_screenshot_only_features_cannot_be_claimed_official(self):
        observed = CATALOG["observedOnly"]
        self.assertTrue(any(x["key"] == "story_view_timestamps" for x in observed))
        self.assertFalse(any(x["key"] == "story_view_timestamps" for x in CATALOG["features"]))
        self.assertTrue(all(x.get("doesNotProveEntitlement", True) for x in observed))

    def test_offer_only_never_qualifies_as_authorized_paid_state(self):
        r = assessment(obs("story_preview", stage="offer", action="not_tested"))
        self.assertEqual(status(r, "story_preview"), "ui_only_or_not_tested")
        self.assertFalse(r["verified"]["aPlusEntitlementOnMetaBackend"])
        self.assertFalse(r["verified"]["aPaidTransaction"])

    def test_synthetic_visible_but_blocked_is_flagged(self):
        r = assessment(obs("story_extend_48h", stage="attempt", action="blocked"))
        self.assertEqual(status(r, "story_extend_48h"), "visible_but_blocked")
        self.assertFalse(r["verified"]["aBypassableFeatureFlag"])

    def test_single_device_action_is_not_purchase_proof(self):
        r = assessment(obs("custom_app_icon", stage="attempt", action="worked"))
        self.assertEqual(status(r, "custom_app_icon"), "single_device_action_observed")
        self.assertFalse(r["verified"]["aPlusEntitlementOnMetaBackend"])

    def test_consented_secondary_account_verifies_action_not_apple_purchase(self):
        r = assessment(
            obs("profile_six_pins", stage="attempt", action="worked"),
            obs("profile_six_pins", stage="external_confirmation", action="worked",
                evidence="consented_second_account"))
        self.assertEqual(status(r, "profile_six_pins"),
                         "consented_cross_account_action_observed")
        self.assertFalse(r["verified"]["aPaidTransaction"])
        self.assertFalse(r["verified"]["aPlusEntitlementOnMetaBackend"])

    def test_story_preview_requires_two_consented_accounts_for_real_effect(self):
        r = assessment(
            obs("story_preview", stage="feature_screen", action="not_tested"),
            obs("story_preview", stage="external_confirmation",
                evidence="consented_second_account", action="worked"))
        self.assertEqual(status(r, "story_preview"),
                         "consented_cross_account_action_observed")
        self.assertFalse(r["verified"]["aPlusEntitlementOnMetaBackend"])

    def test_rewatch_analytics_do_not_claim_identity_of_rewatching_viewers(self):
        r = assessment(obs("story_rewatch_insights", stage="attempt", action="worked"))
        self.assertNotIn("who", json.dumps(r).lower())
        self.assertNotIn("viewers_rewatch_identity", json.dumps(r))

    def test_rejects_broken_and_oversize_observations(self):
        with self.assertRaises(ValueError):
            M.assess(CATALOG, None)
        with self.assertRaises(ValueError):
            M.assess(CATALOG, {"observations": []})
        with self.assertRaises(ValueError):
            M.assess(CATALOG, {"schema": "khanh.igplus.observations.v1",
                              "observations": [obs()] * 129})

    def test_rejects_duplicates_even_if_evidence_differs(self):
        with self.assertRaises(ValueError):
            assessment(obs(), obs(evidence="none"))

    def test_rejects_hidden_worked_and_offer_worked(self):
        with self.assertRaises(ValueError):
            assessment(obs(ui="hidden", action="worked"))
        with self.assertRaises(ValueError):
            assessment(obs(stage="offer", action="worked"))

    def test_rejects_other_app_feature_and_unknown_name(self):
        for name in ("snapchat_memories", "story_view_timestamps", "meta_verified_badge",
                     "unknown", "__proto__"):
            with self.subTest(feature=name):
                with self.assertRaises(ValueError):
                    assessment(obs(name))

    def test_rejects_unconsented_external_confirmation(self):
        with self.assertRaises(ValueError):
            assessment(obs(stage="attempt", evidence="consented_second_account"))
        with self.assertRaises(ValueError):
            assessment(obs(stage="external_confirmation",
                           evidence="none", action="worked"))

    def test_rejects_unvalidated_state_enum(self):
        for change in ({"ui": "subscribed"}, {"action": "premium"},
                       {"stage": "unsanctioned_traffic_replay"},
                       {"evidence": "raw_auth_token"}):
            with self.assertRaises(ValueError):
                assessment(obs(**change))

    def test_observation_evidence_does_not_copy_private_payloads_or_identifiers(self):
        r = assessment(obs("story_spotlight", stage="feature_screen",
                           account_id="ACCOUNT_X_827321", token="Bearer VERY_PRIVATE",
                           url="https://i.instagram.com/endpoint?receipt=private",
                           story_caption="PRIVATE_STORY_TEXT",
                           cookie="session-secret", viewer_list=["PRIVATE_FRIEND_A"]))
        text = json.dumps(r)
        for secret in ("ACCOUNT_X_", "VERY_PRIVATE", "i.instagram.com",
                       "PRIVATE_STORY_TEXT", "session-secret", "PRIVATE_FRIEND_A",
                       "receipt=", "viewer_list"):
            self.assertNotIn(secret, text)
        self.assertEqual(sorted(r["evidence"][0]),
                         ["action", "evidence", "feature", "stage", "ui"])

    def test_other_accounts_and_arbitrary_screenshots_do_not_prove_entitlement(self):
        r = assessment(obs("story_preview", stage="external_confirmation", ui="visible",
                           action="worked", evidence="consented_second_account"))
        self.assertEqual(r["verified"]["aPrivateIOSAPIEndpoint"], False)
        self.assertEqual(r["verified"]["oneShotVPNOffPersistence"], False)

    def test_tracked_features_not_used_to_construct_private_endpoints(self):
        text = (ROOT / "assess.py").read_text(encoding="utf-8")
        for forbidden in ("requests.get(", "urllib.request", "fetch(", "$httpClient",
                          "session.post(", "ctx.http", "eval(", "exec(", "subprocess.run(",
                          "premium=true", "purchase_receipt", "is_plus=true"):
            self.assertNotIn(forbidden, text)

    def test_fails_on_bad_catalog_feature_shape_and_duplicate(self):
        dup = json.loads(json.dumps(CATALOG))
        dup["features"].append(dup["features"][0])
        with self.assertRaises(ValueError):
            M.catalog_index(dup)
        dup = json.loads(json.dumps(CATALOG))
        dup["features"][0]["boundary"] = "purchase_forgery"
        with self.assertRaises(ValueError):
            M.catalog_index(dup)

    def test_loads_local_json_without_private_file_path_in_output(self):
        with tempfile.TemporaryDirectory() as tmp:
            file = Path(tmp) / "private_account_name_not_for_upload.json"
            file.write_text(json.dumps({"schema": "khanh.igplus.observations.v1",
                                        "observations": [obs()]}), encoding="utf-8")
            r = assessment(*M.load_json(str(file))["observations"])
            self.assertEqual(r["observationCount"], 1)
            self.assertNotIn("private_account_name", json.dumps(r))
            file.write_text("{bad", encoding="utf-8")
            with self.assertRaises(ValueError):
                M.load_json(str(file))

    def test_feature_outcome_counts_do_not_depend_on_history_order(self):
        a = obs("custom_bio_font", stage="attempt", action="worked")
        b = obs("story_preview", stage="offer")
        p, q = assessment(a, b), assessment(b, a)
        self.assertEqual(p["counts"], q["counts"])
        self.assertEqual(p["features"], q["features"])


if __name__ == "__main__":
    unittest.main()

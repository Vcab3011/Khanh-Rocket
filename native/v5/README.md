# Khanh Rocket V5 — Snapchat+ and Instagram Plus Research

**Status:** Controlled research / feature and entitlement-state assessment. No service-specific interception, purchase manipulation, or backend-subscription bypass. Not a working Snapchat+/Instagram Plus activation module.

**Branch:** `feature/v5-social-plus-research` from `feature/v5-development`. The accepted V4 commit `d86edfa5a70ed1f9055ad05effd71693ca4efabe` and `release/v4-stable-candidate-2026-10-08` remain unchanged. Preserve `main/build/khanh-rocket.conf`, `v3-test/build/khanh-rocket-v3-test.conf`, and `native/v4/build/caption-canary.conf`.

## Why two separate app modules?

Neither Snapchat+ nor Instagram Plus is the same as RevenueCat Locket. No public, authenticated and stable customer-info endpoint has been established that would justify matching or rewriting any requests from the two social media apps. **Do not add guessed hosts or wildcard MITM patterns.** Interface switches may be local; account limits, social-graph visibility, storage quotas and ranking are controlled by the real service. A client screenshot that says "Subscribed" does not establish a genuine paid entitlement.

Instagram Plus, launched in 2026, is a consumer feature subscription **distinct from Meta Verified** (identity badge, security and support). Product/feature details can change by region, date, platform, or experiment bucket.

### Mechanism matrix

| App / feature | Likely verification boundary | What a valid test could establish | False success to reject |
|---|---|---|---|
| Snapchat+ app icon, chat wallpapers, Bitmoji pet/car | UI configuration with an account eligibility gate | A specific customization is selectable and remains visible after app restart | A static badge says Snapchat+ |
| Snapchat+ 250 GB Memories | Server-side storage quota | Real account shows official quota and server accepts backup within entitlement | A modified storage counter that remains actually limited to 5 GB |
| Snapchat+ Story Boost, Story Rewatch, AI | Server account and social-graph events | Legitimate operation succeeds when supported by service | Synthetic client response describes a feature but action fails |
| Instagram Plus app icons, bio fonts | UI plus account eligibility | Legitimate customization works after app restart | A paywall banner is hidden |
| Instagram Plus Story Extend, Spotlight, audience lists, Rewatch | Server-side story lifecycle and social-graph rules | Another authorized test account sees the intended operation | Client displays 48 hours, server expires at 24 hours |
| Instagram Plus Story Preview / viewer anonymity | **Server privacy and viewer recording** | Verify only using two consented test accounts and the service's legitimate feature | Any claim of anonymity based only on local UI; do not silently hide viewer identity or spoof telemetry |

Sources:
- Snapchat subscription features: https://help.snapchat.com/hc/en-us/articles/7121577610900-What-is-Snapchat?enableDeviceSpecificMedia=rvhv2%27&lang=en-US
- Snapchat storage: https://help.snapchat.com/hc/en-us/articles/41291271694228-How-do-I-manage-my-Memories-storage
- Instagram Plus rollout (consumer product, distinct from Meta Verified): https://techcrunch.com/2026/05/27/meta-officially-launches-instagram-facebook-and-whatsapp-subscriptions-with-more-to-come-including-ai-plans/
- Instagram feature rollout: https://www.cbsnews.com/news/meta-instagram-plus-399-new-features/

## Files and API

- `native/v5/research/social-plus-feature-matrix.json`: only public, high-level feature labels and classification. No purchase receipt, token, account identifier or private endpoint.
- `native/v5/research/social-plus-audit.js`: dependency-free, **pure offline** observation evaluation. Never performs MITM, network access or persistent storage.
- `native/v5/tests/social-plus-audit.test.cjs`: synthetic observation tests, cross-app isolation, false-success detection and redaction.
- `.github/workflows/v5-social-plus.yml`: static CI; no real account requests.

Public API:

```javascript
const audit = require("./native/v5/research/social-plus-audit.js");
const matrix = require("./native/v5/research/social-plus-feature-matrix.json");
const report = audit.assess(matrix, [
  {app:"snapchat_plus", feature:"memories_250gb", ui:"visible", action:"not_tested"},
  {app:"instagram_plus", feature:"story_extend", ui:"visible", action:"blocked"}
]);
```

Allowed UI states: `visible`, `hidden`, `unknown`; allowed action states: `worked`, `blocked`, `not_tested`. **Only** `app, feature, control, ui, action` are preserved; all extra fields are intentionally dropped. No server entitlement is marked verified by the audit even when a local action appears to work. Maximum 32 observations per call.

The returned `visibleButBlocked` count explicitly tracks misleading UI-only successes.

## Device experiment, phase A: lawful and privacy-preserving

1. Use a spare phone/test accounts with consent; record iOS/app versions, available subscription offerings and selected app feature, **not** usernames, private friends' information or tokens.
2. With no HTTP manipulation, observe the actual screen and the specific user interaction; mark `visible/hidden` and `worked/blocked/not_tested`.
3. Repeat only ordinary UI interactions after a normal app restart and after app refresh to distinguish simple persistent UI state from subscription verification. Do not infer hidden backend protocols from UI alone.
4. For account-level features such as Memories quota or Story Extend, confirm with the supported, legitimate service workflows. Never upload private Memories, authentication data or social graph data to source control/chat.
5. For Story Preview/anonymous viewing, do not assert privacy without evidence from two consented test accounts using the **officially offered feature**. The experiment must never expose unsuspecting users.
6. Establish a sanitized request/response protocol description only if properly authorized and technically justified; avoid wildcard MITM. Separate endpoint observation from any behavioral modification.

## Future steps / P0–P3

- **P0:** Confirm user screenshot is genuinely a Snapchat+/Instagram Plus feature offer and product region, without capturing identities. Product research and feature/entitlement model complete; exact app API endpoints unknown.
- **P1:** iOS app feature matrix with legitimate UI checks, state transitions and expected server behavior. Add synthetic fixtures of non-sensitive, independently authored schemas only.
- **P2:** Add narrowly scoped, opt-in read-only endpoint observer **only if a known legitimate endpoint can be characterized safely**. No real request tokens stored. No assumption either app uses RevenueCat.
- **P3:** Confirm actual device behavior; quantify UI false positives and account authorization boundaries. Only promote a module that demonstrably behaves as described; V4 remains available unchanged.

## Explicit non-goals

- Manufacturing App Store receipts, paid entitlements, Snapchat Memories storage allocation, Story ranking, AI credits or Instagram subscription server privileges.
- Automatic Story viewer anonymity or third-party user data access.
- Instagram Plus ≠ Meta Verified. Meta Verified badges/account-security services are out of this module's scope.
- A universal premium response rewrite, indefinite "One-shot" promise, bypassed paywalls or data capture across all Instagram/Snapchat hosts.
- Shipping a user-facing Shadowrocket `.conf` before a safe, documented and demonstrably functional behavior exists.

**Release gate:** CI, privacy review, verified on-device behavior, explicit user acceptance. Do not merge PRs or touch previously accepted V4 without specific approval.

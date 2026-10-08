# Instagram Plus iOS — Deep Reverse-Engineering Research Dossier

**Date:** 2026-10-08  
**Repository:** `Vcab3011/Khanh-Rocket`  
**Branch:** `research/v5-instagram-plus-deep-dive`; based on `research/v5-ios-instagram-snapchat-architecture`.  
**Product studied:** **Instagram Plus** on official Instagram iOS, independently from Meta Verified; account's actual subscription state **unknown**.  
**Implementation state:** source-backed architecture analysis, official product feature contract, offline privacy-preserving observations classifier and synthetic tests. **No IPA was provided or disassembled, no logged-in Instagram traffic was captured, no private iOS Plus API schema was obtained, and no Plus entitlement bypass/activation is claimed.**

## Executive findings

**Six separate decision surfaces** are plausible in Instagram Plus; treating them as one "premium" Boolean is a design error:

1. **Product offers and StoreKit purchase:** display price, trial eligibility, payment and restoration. Apple's StoreKit supports signed transactions and server-side entitlement decisions; **the exact Instagram client or Meta server design has not been inspected**.
2. **Meta remotely managed app configuration:** Meta Engineering explicitly says **MobileConfig runs in Instagram**, enabling typed parameters, rollout gates, experiments and personalization without shipping a new app binary. Whether any specific Instagram Plus feature maps to a given MobileConfig parameter is **unknown**.
3. **Presentation and navigation:** Instagram has native iOS UI; an independent iOS-related Bloks reverse-engineering project documents server-driven layouts. The Instagram Plus paywall might use Bloks, but **that is a hypothesis**, not a discovered endpoint.
4. **Network access and data fetching:** Meta confirms Instagram's REST heritage and ongoing GraphQL adoption; its 2026 GraphQLConf describes a federated schema to migrate Stories/Reels/Threads. **No exact query ID, route or paid-plan payload is established.**
5. **Account-bound eligibility:** some paid features likely depend on authenticated account state, but the exact source-of-truth schema/verification is **unknown**. An available or visible feature is not a verified transaction.
6. **Server-side effects:** Story lifetime, ranking, audience filtering, viewer analytics, notifications, and privacy records logically require an authoritative service component. **The precise implementation and enforcement path is unverified**. A response rewrite might affect what the UI displays without making the action happen.

### Source confidence rules

- **[VENDOR-FACT]** vendor's own documented general architecture/product feature.
- **[APPLE-FACT]** Apple official SDK or StoreKit capability, not proof Instagram uses that particular integration.
- **[USER-SCREEN]** directly visible user offer, not a completed purchase.
- **[THIRD-PARTY]** independent public RE, not primary Meta documentation, not guaranteed current iOS version.
- **[HYPOTHESIS]** testable inference, cannot be promoted to fact until validated.
- **[NOT OBSERVED]** exact iOS endpoint/purchase/authorization/cache mechanism unavailable.

## 1. Official product release contract, June and September 2026

### June 4, 2026 — Meta officially launches Instagram Plus

Primary source: https://about.fb.com/ltam/news/2026/06/presentamos-instagram-plus/

Meta identified three benefit areas:

- **Closer connections:** Story Spotlight; animated Super Hearts; unlimited Story audience lists; Story Extend to **48 hours**.
- **Previews/insights:** Story Preview; Story Rewatch aggregate insights; Search Viewer List on your own Story.
- **Personalization:** Custom App Icon; Custom Bio Font; up to **6** pinned posts (versus normal 3); Post Directly to Profile/Highlights without standard follower feed distribution.

These are **product capabilities**. They do not expose a technical field name, GraphQL operation name, iOS class name or entitlement API.

### September 15, 2026 — Meta One confirms product expansion

Primary source: https://about.fb.com/news/2026/09/introducing-meta-one-subscription-service-more-features-ai/

Meta states:
- Instagram Plus added **custom DM and Story fonts**, **notifications when selected people view your Story**, **DM previews**.
- Single product **Instagram Plus** continues; it is distinct from Meta Verified. Meta One Core/Premium plans **bundle** individual-app features plus broader AI usage. Do **not** treat a Core/Premium bundle as the same catalog or in-app product identifier as an individual Instagram Plus plan.
- Meta advertises US $3.99 monthly as a reference market price; **account and country price vary**.

**User-provided Canadian screenshot (2026-10-08):** Plus paywall says a one-month free trial, **CA$4.49/month** or **CA$42.99/year**, and visibly lists **Preview Stories**, **Count Story Rewatches**, **See When Your Story Was Viewed**. This proves only what is offered on that user account/device. It does not show a successful subscription. The "See When..." timestamp line is **screenshot-only**, maintained as a separate unknown from September's "notifications when selected people view Story" until direct evidence ties them together.

**Privacy distinction:** Story Rewatch Insights is aggregate count; it should not be interpreted as a roster naming each person who rewatched. September 2026 Meta clarification: https://www.foxbusiness.com/media/meta-pushes-back-claims-instagram-plus-exposes-repeat-story-viewers

**Canonical machine-readable catalog:** `FEATURE_CATALOG.json`, 15 officially described feature IDs (June 11, September 4) plus 4 screenshot-only offer observations. `boundary` values in this catalog are **engineering hypotheses**, never claims of a discovered server API.

## 2. Verified Instagram mobile architecture

### Layer A — MobileConfig: rollout and experimentation

Source: https://engineering.fb.com/2024/06/11/core-infra/mobileconfig-meta-mixed-reality-mr/

**Vendor fact:** Meta's cross-platform MobileConfig supports typed remote config parameters and region/device/cohort gating; Meta names Instagram as a production consumer. It has been used in Meta apps since 2015. It can support feature rollout, A/B testing and personalization.

**What it does not prove:** that a particular Instagram Plus purchase gate is a writable or overrideable MobileConfig flag; that a local config is sufficient to make the server accept a paid action; that a single single-product "plus" Boolean exists.

**Research task:** carefully compare feature *availability* versus successful feature *operation* on the same own account, with legitimate rights and without untrusted proxy traffic. A mismatch between visible UI and failed server action suggests multiple decision surfaces, not a patch proposal.

### Layer B — REST and Mobile GraphQL

Meta sources:
- https://engineering.fb.com/2024/12/18/ios/how-we-think-about-threads-ios-performance/
- https://engineering.fb.com/2025/03/31/data-infrastructure/mobile-graphql-meta-2025/
- https://graphql.org/conf/2026/schedule/db3a6a6b83a936623e0ac45938bbb7ef/

**Vendor fact:** Instagram was built with REST-oriented networking; Instagram and Threads have been migrating to GraphQL. Meta Mobile GraphQL is used by Instagram. At GraphQLConf 2026, Meta described GraphQL federation for Instagram's monolith migration, affecting major Stories/Reels product flows.

**Boundary:** it is incorrect to say all Instagram APIs are GraphQL, or that a feature's paid verification necessarily uses GraphQL. No verified private endpoint, query ID or token scheme is available from these sources.

### Layer C — Bloks / server-driven UI

Independent research: https://github.com/novitae/igbloks

**Third-party fact:** Bloks is a dynamic structured UI technique observed in Instagram, with iOS-specific examples. Public project is experimental and untrusted; do not install/run on the user's account or copy third-party scripted login/credential handling.

**Hypothesis:** the Instagram Plus offer or eligibility UI *may* use a Bloks surface; no concrete paywall-to-Bloks evidence. Do not cite Bloks as a confirmed Plus endpoint.

### Layer D — StoreKit and account entitlements

Official Apple technical background:
- https://developer.apple.com/documentation/storekit/transaction/currententitlements
- https://developer.apple.com/documentation/StoreKit/determining-service-entitlement-on-the-server
- https://developer.apple.com/documentation/appstoreservernotifications/receiving-app-store-server-notifications

**Apple fact:** StoreKit exposes verified transactions, including current subscription entitlements; backend servers may use signed Apple transaction and renewal data to decide service access. Apple documents refunds/revocations and signed notification formats.

**Not verified for Instagram:** its exact choice among StoreKit 1/2, whether/how Meta backend maps App Store transactions to Instagram user IDs, cache lifetime, signed payload validation decisions and whether any particular UI feature is client-only. Never assert a RevenueCat integration just because a different app (Locket) uses it.

## 3. Specific app lifecycle — a research hypothesis, not traced packets

```text
             Offer screen visible in Instagram iOS
                         |
                 [Product availability?]
            MobileConfig rollout/cohort OR other
                 application-owned logic
                         |
                   [Paywall UI]
             Native layout OR Bloks? (unknown)
                         |
         [StoreKit offer / subscription ownership]
               Apple's signed transactions
                         |
                  [Meta account binding?]
                   SERVER INTERNALS UNKNOWN
                         |
               per-feature eligibility check
                  /                \
           UI and local cache     service authority
                  |                |
        icons/fonts/previews?    story 48h / audience /
                                viewer privacy / ranking
```

This is *not* a reversed call stack. No on-device app code or private HTTP response was obtained.

## 4. Priority-research experiments: proof criteria by feature

| ID | Feature and risk | Minimum meaningful evidence (legitimate use only) | What does NOT count |
|---|---|---|---|
| F01 | **Custom App Icon**; lower impact UI | Official feature selection works and survives force quit; record account entitlement separately | Paywall displays icon choices |
| F02 | **Custom Bio/Story/DM fonts**; UI+render | Text styling preserved after relaunch and displayed consistently on account’s own content | One-time preview changes |
| F03 | **6 Profile Pins**; backend profile state | Own profile accepts pin #4 and a second consenting viewer sees it after refresh | Client counter says 6 |
| F04 | **Post Directly to Profile**; distribution | Private/test post is visible only in the intended public/profile surface after normal server processing | Local composer shows selector |
| F05 | **Story Extend 48h**; server time | Consent-based Story stays available to its intended audience after **24h+**; test normal expiry separately | A UI badge says 48h |
| F06 | **Story Spotlight**; ranking | Official Plus feature used; repeatable priority evidence from explicitly consenting followers, accounting for ranking noise | One screenshot of Stories tray order |
| F07 | **Multiple Story Audiences**; privacy | Independently confirmed which consenting test viewers can/cannot see private test content | Local audience-list controls alone |
| F08 | **Super Hearts**; social action | Consent-based recipient observes the special reaction after backend sync | Animation plays locally |
| F09 | **Story Preview**; viewer privacy | Only with two consenting accounts, validate preview behavior and owner's viewer list; no covert third-party viewing | Button appears; UI claims anonymity |
| F10 | **Rewatch Insights**; analytics | Compare official aggregate numbers over a consenting test Story experiment | Inferring identities of repeat viewers |
| F11 | **Viewer List Search**; analytics | Search the creator's own Story viewers, only in the legit app UI | Search box present only |
| F12 | **Selected Viewer Notifications**; backend notifications | Owner receives an authorized alert for a consenting viewer as described | Local notification settings toggle |
| F13 | **DM Previews**; privacy | Preview own eligible conversation state, with consenting correspondents and standard product behavior | Workarounds to read others' messages |
| F14 | **Screenshot-only viewer timestamp wording** | Obtain official in-app entitlement description and a harmless creator-owned Story example | Conflating with June rewatch counts or Sep alerts |

### An explicit limitation

Even if a legitimate *action* succeeds in a test, this is not cryptographic proof a particular **purchase** occurred; actions may be free for a rollout cohort or allowed by a temporary promotion. Purchase evidence and action evidence are separate. The offline classifier never sets `aPaidTransaction=true` or `aPlusEntitlementOnMetaBackend=true`.

## 5. Passive evidence protocol for user's iPhone

**Baseline:** photo of Instagram Plus offer already supplied. Account showed one-month trial, CA$4.49 monthly, CA$42.99 annual. No payment occurred or is confirmed by that photo. **Do not click “Try for CA$0.00” just to capture traffic:** starting a free trial may create an auto-renewing subscription.

**Option A — no certificates, no network interception:**
- iOS `Settings → Privacy & Security → App Privacy Report` (if available/enabled).
- Instagram app normal open → Plus offer → ordinary, permitted UI navigation → app restart.
- Local-only NDJSON analysis with the existing `native/v5/ios_re/apple_privacy_report.py`. This produces only grouped domain counts over a rolling period; it **cannot identify Plus API** or isolate one action precisely.

**Option B — existing authorized HAR captured by user:**
- Process offline with `native/v5/ios_re/har_metadata.py`, once per controlled stage: `baseline`, `paywall`, `feature_open`, `refresh`, `restart`.
- It emits app/HTTP method/status/MIME/protocol/duration **buckets** only, no full hostname/path/body/auth.
- Compare sanitized summaries with `har_metadata.py compare`. Correlation of one content type with a feature action is **not causal proof**, because private/federated app requests run concurrently.

**Option C — manual feature-state classifier (new):**
- Prepare a small local JSON file containing *only* allowlisted `feature` IDs, `stage`, `ui`, `action`, and `evidence`. No account handles, receipts, URLs, screenshots of private stories or headers.
- Run `native/v5/instagram_plus/assess.py`. It strips unexpected fields and labels `visible_but_blocked`, `ui_only_or_not_tested`, `single_device_action_observed`, and `consented_cross_account_action_observed`.
- Run consented external-confirmation experiments only for appropriate features and only when official product access exists. Do not attempt fake purchase restoration.

### Why *not* install a Shadowrocket rule yet?

No verified hostname/path for Plus eligibility is known, and Instagram domains transport login, private messages, media and social-graph information. A broad `[MITM]` configuration would expose unrelated private data and still may not show the server's signed authorization decision. Bloks, MobileConfig, GraphQL and Apple StoreKit are distinct layers. Adding a fabricated field like `"is_plus":true` without an observed contract has no evidentiary basis.

## 6. Source audit — tempting shortcuts to reject

- "Instagram uses RevenueCat": **not established**. Do not reuse Locket's JSON response.
- "Instagram Plus is just Meta Verified": **false**; Meta distinguishes consumer and identity/creator products.
- "The UI contains a Plus label, therefore subscribed": **false inference**.
- "Rewrite MobileConfig -> unlock paid Story backend": **not established**; rollout ≠ purchase authorization.
- "GraphQL + Bloks => one JSON body enables everything": **unsupported**. They describe fetching/rendering protocols, not paid rights.
- "Story Preview is just suppressing a read receipt on the phone": **unproven** and privacy-sensitive. Product's intended semantics must be honored by the service.
- "One-shot will persist if we cache a synthetic response": **not established**, particularly for story server effects.
- "Instagram app use means StoreKit 2": **not established** for this version. Apple describes available techniques, not Meta's chosen integration.
- "A third-party Android API clone gives the iOS endpoint": **not established**; version/platform and security controls differ.
- "Unit tests prove all Plus features work": **false**. No device entitlement trials were run.

## 7. Next high-value research gates (prioritized)

**R0 (done):** vendor source acquisition for June 2026 official launch, Sep 2026 Meta One update, Meta MobileConfig, Instagram GraphQL/iOS heritage and StoreKit vendor semantics; catalog 15 features and screenshot-only exceptions.

**R1 (done):** implement typed, privacy-preserving evidence model that cannot accidentally label UI-only display as a verified purchase. Unit-test false successes, malformed events and redaction.

**R2 (next):** have user provide **app version/build and iOS version**, and manually mark two or three feature observations (Plus offer, Custom Icon, Viewer List Search). Do not require a purchase, full iCloud backup or user auth information.

**R3:** obtain *only user-consented, locally sanitized* passive metadata if available; do not change TLS trust or patch Instagram app. Record MobileConfig/GraphQL/Bloks as **hypotheses**, not discovered calls.

**R4:** if the user *legitimately* has an Instagram Plus trial/subscription and chooses to test, compare successful UI-only customization with one backend-backed feature on **consenting** test accounts. Record account/state transitions and cache lifespan without exposing identity.

**R5:** only when a concrete, authorized interface is understood, develop an opt-in **read-only** app adapter with exact host/path/method, body caps, no authentication capture, error pass-through and device gate. No universal rewrite or fabricated StoreKit transaction.

**Release gate:** independent security review, tests and explicit user authorization. Accepted V4 config at `d86edfa5a70ed1f9055ad05effd71693ca4efabe` stays untouched. Draft research PR remains unmerged.

## 8. Files and tests

- `native/v5/instagram_plus/FEATURE_CATALOG.json`: 15 official feature descriptions, time-qualified sources, hypothesized enforcement class, unknown API/authorization fields, 4 screenshot-only observations.
- `native/v5/instagram_plus/assess.py`: deterministic stdlib-only offline validator/classifier; maximum 128 entries; strict enum normalization; zero network, login, MITM, receipts, storage or telemetry.
- `native/v5/instagram_plus/tests/test_assess.py`: invalid state, consent, false-positive, cache/unknown, redaction and source-grounding scenarios.
- Existing `native/v5/ios_re/RESEARCH.md` and `IPHONE_PLAYBOOK.md`: app-level transport/background and Apple Privacy Report entry points, including Snapchat (different project).
- `.github/workflows/v5-instagram-plus.yml`: offline unit tests and protected-profile blob checks.

### Example sanitized local observations

```json
{
  "schema": "khanh.igplus.observations.v1",
  "observations": [
    {
      "feature": "story_preview",
      "stage": "offer",
      "ui": "visible",
      "action": "not_tested",
      "evidence": "self_ui"
    },
    {
      "feature": "custom_app_icon",
      "stage": "feature_screen",
      "ui": "unknown",
      "action": "not_tested",
      "evidence": "none"
    }
  ]
}
```

```bash
python native/v5/instagram_plus/assess.py local-observations.json
python -m unittest discover -s native/v5/instagram_plus/tests -p 'test_*.py' -v
python -m unittest discover -s native/v5/ios_re/tests -p 'test_*.py' -v
node --test native/v5/tests/social-plus-audit.test.cjs
```

**Do not commit real observations without scrubbing, and do not upload raw HAR files or App Privacy Reports to the public repository.** Filename references above are examples only. No actual iPhone trace is present.

## References (source priority)

1. **Meta official (June 4, 2026):** https://about.fb.com/ltam/news/2026/06/presentamos-instagram-plus/
2. **Meta official (September 15, 2026):** https://about.fb.com/news/2026/09/introducing-meta-one-subscription-service-more-features-ai/
3. **Meta Engineering MobileConfig:** https://engineering.fb.com/2024/06/11/core-infra/mobileconfig-meta-mixed-reality-mr/
4. **Meta Engineering Mobile GraphQL:** https://engineering.fb.com/2025/03/31/data-infrastructure/mobile-graphql-meta-2025/
5. **Meta Engineering iOS REST→GraphQL:** https://engineering.fb.com/2024/12/18/ios/how-we-think-about-threads-ios-performance/
6. **GraphQLConf 2026 Meta Instagram federated schema talk:** https://graphql.org/conf/2026/schedule/db3a6a6b83a936623e0ac45938bbb7ef/
7. **Apple StoreKit currentEntitlements:** https://developer.apple.com/documentation/storekit/transaction/currententitlements
8. **Apple official entitlement on server:** https://developer.apple.com/documentation/StoreKit/determining-service-entitlement-on-the-server
9. **Bloks research, independent/unstable:** https://github.com/novitae/igbloks
10. **Meta clarification on Story Rewatch insights:** https://www.foxbusiness.com/media/meta-pushes-back-claims-instagram-plus-exposes-repeat-story-viewers

**Final answer of this phase:** A serious RE foundation is feasible and now sourced. Exact Instagram Plus iOS paid-state API, StoreKit implementation, cache behavior and complete backend enforcement are **not yet reverse engineered** from a screenshot and general vendor architecture. Prioritize concrete consented evidence, rather than inventing a premium payload.

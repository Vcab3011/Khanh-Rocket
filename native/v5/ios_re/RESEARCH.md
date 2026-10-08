# V5 iOS Reverse Engineering — Instagram Plus & Snapchat+ Architecture Evidence

**Date:** 2026-10-08.  
**Status:** Public-source architecture research + offline HAR metadata tooling; **not** private iOS binary disassembly, decrypted packet capture, discovered Plus entitlement endpoint or working premium activation.  
**Research branch:** `research/v5-ios-instagram-snapchat-architecture`, forked from `feature/v5-social-plus-research`.  
**Existing user-accepted baseline:** `release/v4-stable-candidate-2026-10-08` at commit `d86edfa5a70ed1f9055ad05effd71693ca4efabe`. Never edit or merge into `main/build/khanh-rocket.conf`, `v3-test/build/khanh-rocket-v3-test.conf` or accepted `native/v4/build/caption-canary.conf`.

## 1. Purpose: real reverse engineering rather than "premium label" modification

Characterize the transport, serialization, configuration and account-authorization boundaries of the **iOS** versions of Instagram and Snapchat. Create a reproducible evidence trail from vendor engineering material, public reverse-engineering projects and user-consented local observation.

Desired answer **for each paid feature**:

1. Is its UI presented client-side, remotely configured, or both?
2. Does an authenticated backend authorize its *operation*? What would independently establish success versus a badge-only false positive?
3. What request/response transport (HTTP/1.1, HTTP/2, HTTP/3/QUIC, gRPC) and data format (JSON, GraphQL, server-driven UI, protobuf) can be evidenced?
4. Which part of the state survives app restart, normal connection change or cache refresh? Distinguish UI, cached eligibility and actual backend rights.
5. Is any officially supported API able to test this behavior lawfully without using private endpoints?
6. What is **not known** until controlled iOS binary analysis or sanitized capture is available?

No generalized RevenueCat payload, no guessed premium header, no forged receipts, no account impersonation, no request replay against other accounts. Snapchat/Instagram are not assumed to share Locket's SDK.

## 2. Evidence ledger — explicit source confidence

| ID | Source / evidence | Directly supported finding | Limit of inference | Confidence |
|---|---|---|---|---|
| E1 | Snap Engineering: [Cross-Platform Mobile Messaging](https://eng.snap.com/cross_platform_messaging_experience) | Snap developed shared C++ client messaging code for iOS/Android; uses gRPC with Cronet+QUIC transport; uses SQLite for messaging structured state | This **does not prove** the separate Snapchat+ purchase/eligibility endpoint is gRPC, uses the same schema or is stored in SQLite | Official, strong for messaging stack |
| E2 | Snap Engineering: [QUIC at Snapchat](https://eng.snap.com/quic-at-snap) | Snapchat has used Cronet and QUIC as core transport technologies | Not a guarantee every present-day request uses QUIC or that all HTTPS interception is impossible | Official, strong for transport family |
| E3 | Snap Support: [Available Snapchat+ plans](https://help.snapchat.com/hc/en-us/articles/45845487406740-What-Snapchat-plans-are-available) | Apple/App Store subscription flow on iOS; plans can differ by region, Platinum/Family/Lens+ | No private account entitlement endpoint exposed | Official, strong for billing UX |
| E4 | Snap Support: [Restore Purchases](https://help.snapchat.com/hc/en-gb/articles/17985577624340-I-m-having-trouble-restoring-my-Snapchat-purchase) | Restore applies to purchases made for the same Snapchat account; transfer to a different Snapchat account is unsupported | Specific device cache layout and backend validation chain not disclosed | Official, strong for account binding |
| E5 | Snap Support: [Memories storage](https://help.snapchat.com/hc/en-gb/articles/41291271694228-How-do-I-manage-my-Memories-storage) | Free 5 GB; Snapchat+ typically 250 GB; Platinum 5 TB; Memories plan separate; policy can vary | Merely displaying 250 GB does not increase actual stored quota | Official, strong for product rights |
| E6 | Meta Engineering: [Mobile GraphQL at Meta](https://engineering.fb.com/2025/03/31/data-infrastructure/mobile-graphql-meta-2025/) | Instagram uses Meta Mobile GraphQL data-fetching infrastructure | Does not specify Instagram Plus eligibility schema or GraphQL query IDs | Official, strong for architecture |
| E7 | Meta Engineering: [Threads iOS REST/GraphQL adoption](https://engineering.fb.com/2024/12/18/ios/how-we-think-about-threads-ios-performance/) | Instagram has a REST heritage and had been adopting GraphQL alongside Threads | Different product/feature migrations can retain different transports | Official, strong for migration |
| E8 | [GraphQLConf 2025: Instagram REST→GraphQL](https://graphql.org/conf/2025/schedule/5488aa89d9612e06d58e66cc521bcc38/) | Meta engineers described gradual migration, with 95%+ of **new** APIs developed in GraphQL | 95% of new APIs does **not** mean 95% of *all* Instagram requests are GraphQL | Primary conference description, strong |
| E9 | [igbloks research](https://github.com/novitae/igbloks) | Researchers demonstrate Instagram Bloks as a server-driven UI representation; iOS-origin Bloks observations documented | Unofficial, may be outdated or differ in current premium screens | Third-party, medium |
| E10 | [SCInsta internal names wiki](https://github.com/SoCuul/SCInsta/wiki/Internal-Instagram-Names) | Community terminology includes Bloks, IGDS, NUX, etc. | Incomplete community glossary, **not** verified current binary mapping or plus entitlement proof | Third-party, low–medium |
| E11 | [Meta Instagram Plus rollout](https://techcrunch.com/2026/05/27/meta-officially-launches-instagram-facebook-and-whatsapp-subscriptions-with-more-to-come-including-ai-plans/) | Instagram Plus is a distinct consumer subscription from Meta Verified; Story Preview, rewatch metrics, audience lists, custom app icon and other features described | Product rollout may vary by country/cohort and current app version | Reporter quoting Meta, medium–high for product |
| E12 | User-provided Instagram Plus screenshot (2026-10-08) | **On this device/account offering**: "1 month free", CA$4.49/month or CA$42.99/year; Preview stories, Count Story Rewatches, See When Story Viewed | UI screenshot does not prove purchase, active Plus privileges or platform API identity | User observation, strong for displayed offer |
| E13 | User-provided Snapchat+ screenshot (2026-10-08) | **On this device/account offering**: Snapchat+ feature list, Memories "4.5 GB of 5 GB", app icons, animated stickers, Bitmoji Pet/Car | Does not prove an actual subscription or 250 GB quota | User observation, strong for displayed offer |
| E14 | [Official Instagram Graph API collection](https://www.postman.com/meta/instagram/collection/6yqw8pt/instagram-api) | There is an authorized Instagram API for certain Professional account workflows | Official Graph API **is not** the private iOS client API and does not expose consumer Instagram Plus entitlement by assumption | Official Meta Postman resource, strong for scope |

**Missing evidence, as of this commit:** decrypted iOS app binaries, verified target app version/build/region identifiers, private API schemas for paid-feature eligibility, any sanitized real app request metadata or protocol traces, actual premium account on-device comparison, vendor purchase verification response shape. Therefore no factual app-specific paid-plan interception endpoints may be asserted.

## 3. Working architectural hypotheses

### Instagram iOS

```text
User taps Instagram Plus paywall / eligible feature
                   |
          Native UI or Bloks-backed view?           [HYPOTHESIS]
                   |
         Rest and/or Mobile GraphQL client          [Architecture verified,
                   |                                 per-feature path unknown]
         Account experiments / entitlement?        [UNKNOWN]
                   |
     Backend validates story/viewer/visibility      [Inferred for social actions;
                   |                                 not observed in iOS trace]
         Client caches UI/config/response?          [UNKNOWN]
```

Prioritize **three separable experiments**: (I1) paywall presentation and offer refresh; (I2) simple UI customization menu; (I3) state of Story Extend/Spotlight/Preview on an authorized test account. The screenshot's Preview Story anonymity description is a product claim: the server-side privacy property requires two consenting accounts to verify. **Never make stealth viewing claims from a changed UI label alone.**

Static analysis interest, once user legally provides app-inspection artifacts: Mach-O load commands, embedded framework list, Objective-C class/symbol names when available, Info.plist URL schemes, privacy manifest, entitlements *of the app binary* (not paid subscription entitlements), UI-related string clusters. The app may be encrypted/stripped and may not expose these. **Do not bypass DRM or anti-tamper** to manufacture a package. A public **Android** SDK or APK decompile is evidence about Android only until cross-platform parity is shown.

### Snapchat iOS

```text
User opens Snapchat+ eligibility screen / feature
                   |
       iOS UI + shared C++ components?              [Messaging C++ confirmed,
                   |                                 Plus feature linkage unknown]
    gRPC + Cronet/QUIC for many app workflows        [Officially confirmed as
                   |                                 an existing network stack]
       Account-linked subscription status?         [Account binding verified,
                   |                                 exact API unknown]
    Backend social/storage/AI quotas                [Inferred, validate feature]
                   |
      Local persistence and refresh                 [UNKNOWN for Plus]
```

Paywall features to distinguish:
- UI-facing: custom app icon, chat wallpapers, Bitmoji car/pet;
- social state: friend engagement/replays/story boosts;
- server quota: official Memories storage 5 GB baseline, 250 GB with standard Plus;
- tier-specific: Platinum ad benefits, 5 TB, AI or Lens+.

A HAR captured by an HTTP proxy may miss QUIC traffic entirely or omit opaque gRPC message fields. **Zero captured Plus requests is not proof of local-only eligibility or the absence of a server check.**

## 4. Why Shadowrocket/Egern should not start with rewrite rules

Existing Khanh Rocket Locket module hooks into a known RevenueCat response JSON. Neither vendor has been shown to use that API for its premium plan. Rewriting arbitrary URLs on Snapchat/Instagram would risk account integrity, authenticated data and private social interactions. The first output of this research is a **read-only passive metadata analyzer**, not a guessed request/response injector.

Risk classes:
- Cross-service interception of login, messages, media or private viewers.
- Non-HTTP/2 transports (QUIC), app-enforced authentication, TLS validation or attestation; no assumption MITM succeeds.
- StoreKit/App Store transactions versus server-synchronized entitlement; display state alone is not a purchase.
- Invalid request replay, account flags, rate limits, user suspension, privacy violations.
- Machine-readable HAR may include raw credentials, cookies, media URLs and social graph; must **not** upload the original HAR, IPA, decrypted app data or keys to GitHub.

## 5. Implemented local-only evidence tooling

`native/v5/ios_re/har_metadata.py` — pure Python standard library.

It consumes an **authorized, locally exported HAR** entirely offline and emits **only enum-based metadata counts**:

- Explicit target family `instagram` or `snapchat`, selected by researcher; not guessed from arbitrary URL.
- Analysis stage selected from `baseline` / `paywall` / `feature_open` / `refresh` / `restart`.
- Counts of HTTPS host-family relationship to broad parent domains (no hostname/subdomain/path/query retention).
- HTTP method class, status bucket, content MIME *class* (JSON, gRPC, protobuf, HTML, media, unknown/other), HAR-reported HTTP protocol *hint*, and duration bucket.
- Restricted 12 MiB input and 10,000-entry limits.
- No headers, cookies, request/response body, account IDs, video/Story URLs, timestamp precision, original hostname, auth tokens or private API path in the output. No outbound requests or storage. Treat original HAR as sensitive even though the output is minimized.
- Local summaries can be compared only for **the same app**; results quantify observable traffic-class deltas, **not** premium entitlement verification.
- HAR metadata reports are incomplete if QUIC is outside the proxy or sessions are cached; status groups are not purchase-proof.

### Usage (on your own local machine; avoid raw HAR in repo/chat)

```sh
python native/v5/ios_re/har_metadata.py summarize safe-ig-session.har \
  --app instagram --stage baseline > ig-baseline-summary.json
python native/v5/ios_re/har_metadata.py summarize safe-ig-feature.har \
  --app instagram --stage feature_open > ig-feature-summary.json
python native/v5/ios_re/har_metadata.py compare \
  ig-baseline-summary.json ig-feature-summary.json > ig-diff.json

python native/v5/ios_re/har_metadata.py summarize safe-snap-session.har \
  --app snapchat --stage paywall > snap-paywall-summary.json

python -m unittest discover -s native/v5/ios_re/tests -p 'test_*.py' -v
```

*The filenames in these commands are illustrative, **not** actual captures of the user's device.* Input is never transferred to our server by the script. Redirect outputs locally for your inspection, then share only the sanitized summary if you choose to. Do **not** collect unconsented users' media/messages or use instruments to bypass account/device attestation.

## 6. Controlled iPhone test matrix (target app versions unknown)

| Experiment | Consent & setup | Manual action | Evidence expected | Boundary and stop rule |
|---|---|---|---|---|
| I-1 | Own Instagram account, no purchase needed | Open Plus paywall; close; reopen | Offer text, displayed price, flags availability, app version | No assumption UI response equals subscription |
| I-2 | Same own Instagram account | Open available UI-only feature, change normal setting if legitimately permitted | UI visible vs action accepted vs persistence after restart | No private Story or follower information |
| I-3 | Two owned/consenting Instagram accounts, only if Plus trial/legitimate purchase exists | Use legitimate Story Preview feature, verify from owner account | Independent confirmation from both views | Never assert anonymity without authorization |
| I-4 | Own account, ordinary Story controls | Measure Story Extend/Spotlight availability and server state | Test action server success vs UI animation | Do not artificially boost or interfere with others' Stories |
| S-1 | Own Snapchat account | Open Snapchat+ offer and Memories storage card | 5 GB/250 GB offered, app version, state | No Memories uploaded to third-party tools |
| S-2 | Own account, legitimate subscription only | Change app icon or chat wallpaper normally | UI action and state after restart/online refresh | Cannot infer server authorization from icon only |
| S-3 | Own account, supported trial or purchase only | Check Memories quota inside Settings (read-only) | Storage allocation actual value in native app | Never alter displayed quota or upload fake receipts |
| Both | Proxy only with user consent, no certificate bypass | Capture short, scoped, **authorized** metadata around UI action | Aggregate sanitized protocol families and relative count deltas | Stop if login breaks, certificate rejected, account warnings, or private data surfaces |

**Device test fields to record manually:** app version/build, iOS version, region, feature key, screen/step label, whether action completed, whether it persists after force-quit/relaunch, whether it requires online service. No account handles, private Story contents or purchase tokens.

## 7. Next engineering gates for Codex

**G0 — Verify research provenance:** Validate sources E1–E14, distinguish primary vendor docs from reverse-engineering community claims; do not infer paid endpoint existence from public Android clients.

**G1 — Static iOS artifact inventory:** If the user provides legally accessible Info.plist / unencrypted binary metadata from their device, analyze framework load commands, symbols, app entitlements, UI strings, protocol library imports and security interfaces. Create a version-stamped evidence ledger. Do not ask user for a full iCloud backup, Apple ID, login password or unredacted IPA. No DRM bypass.

**G2 — Passive transport matrix:** Obtain short, consented HAR *only when user can generate one without bypassing device protections*. Run local sanitizer, compare baseline vs feature stage, count missing/opaque flows, and assign a confidence score. Without HAR, continue static research only.

**G3 — Schema attribution:** Only after concrete, reproducible evidence shows a specific app-owned endpoint or body format, create strict read-only fixture parsers. Never send the original token, receipt or private message. Maintain different adapters for REST/GraphQL/Bloks vs gRPC/protobuf. No wildcard MITM.

**G4 — Account-boundary acceptance:** Test UI visibility separately from real server-enforced action. Example: feature icon versus server-side Story expiration; displayed storage number versus actual allocated quota. Stop on integrity/privacy risk.

**G5 — Safe feature scope:** User consent, clean room implementation, validated test fixtures, strong input guards, no anti-account-enforcement modifications. No new V4 release until explicitly authorized.

## 8. Repository and production discipline

- PR #17 remains a **read-only V5 app feature-state model**, not Snapchat+/Instagram+ entitlement spoofing.
- This branch adds architectural evidence and an offline HAR metadata reducer; does not create a Shadowrocket/Egern Plus config or rewrite subscription response.
- Old accepted V4 user-confirmed profile remains pinned to `d86edfa5a70ed1f9055ad05effd71693ca4efabe`.
- The complete original 10in1 profile and V3 Test profile are protected and unchanged.
- Any future branch/PR must provide a source confidence ledger, exact changed file set, synthetic tests, explicit absence-of-credentials checks and a spare-iPhone verification path.

**No iOS binary or private network capture was furnished for this research phase. Every specific Snapchat+/Instagram Plus entitlement endpoint remains UNKNOWN.**

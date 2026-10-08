# Khanh Rocket Native — system architecture and independently controlled roadmap

Reviewed: 2026-10-08. Source of truth: the user-supplied **All In One Pro Max Ultimate** config and the matching 35 active directives in Khanh Rocket's `build/khanh-rocket.conf`, baseline commit `88dbcb4751cc649592f292811b65acb4bed8837b`.

## 0. Assurance boundary

The user reports the 10in1 profile working after re-importing it and enabling HTTPS Decryption. That confirms a device-observed result, **not** that every script actually runs or every paid entitlement is genuinely granted. This document is **static reverse engineering** based on upstream source reviewed at the commit IDs below, not a full live traffic capture or a security certification.

**Immutable production policy:** NEVER overwrite, regenerate, or edit `build/khanh-rocket.conf` during this phase. Use a separate canary profile and explicit review before touching MITM/scripts.

## 1. Mental model: Shadowrocket is the runtime, not the VPN provider

```
iOS application
    |
    v
Shadowrocket's tunnel / routing policy [Rule]  <-- routing nodes live in the app
    |
    +-- UDP googlevideo / youtubei -> REJECT: force TCP fallback where supported
    |
    +-- URL filtering/rewrite/Map Local: local HTTP response or redirect
    |
    +-- HTTPS interception only for enabled MITM hostname + trusted local CA
          |
          +-- request hook: inspect/edit request OR generate synthetic HTTP response
          +-- upstream HTTPS server (unless intercepted/synthetic)
          +-- response hook: inspect/alter decoded JSON or protobuf bytes
          +-- $done(...) sends back a result
    |
    +-- scheduled cron scripts run separately from individual requests
```

HTTPS Decryption + trusted Shadowrocket CA are **necessary for those encrypted requests that need body rewriting**; neither is an independent proxy service nor sufficient to ensure every app will accept altered responses. Certificate pinning, QUIC/UDP, non-matching URL patterns, app-specific validation and upstream changes may bypass or break interception.

### Section-by-section

- **[Rule] (2):** reject UDP on `googlevideo.com` and `youtubei.googleapis.com`. Likely discourages QUIC/HTTP3 on matched hosts to make TCP/TLS interception practical. It does not itself remove adverts.
- **[Header Rewrite] (3):** two case variants of RevenueCat ETag deletion (likely redundant), and Spotify `if-none-match` removal. This suppresses conditional caching and can increase full response retrieval.
- **[Url Rewrite] (5):** reject ad/tracking-like YouTube URL patterns, and issue one 302 rewrite for a `ctier` URL pattern. Rewrite matching does not parse protobuf.
- **[Script] (17 declarations / 16 distinct URLs):** three Sub-Store entries, two hooks for the same YouTube script, two Spotify entries, and ten more app-specific entries. `type=http-request` can modify a request or synthesize a response; `type=http-response` processes a response; `type=cron` runs on a schedule.
- **[Map Local] (1):** answers a matched `initplayback...&oad` URL with a local empty response.
- **[MITM] (one line / many hosts):** defines which HTTPS hosts are eligible for interception, not which endpoints each script will actually modify. `%APPEND%` preserves an existing MITM hostname list.

A typical response pass goes: match hostname -> decrypt -> match script's regex -> expose response body -> script parses/decodes -> modifies -> `$done` -> app sees the result. Shadowrocket's exact ordering when multiple scripts match needs device observation; do NOT assume both Sub-Store handlers execute in a particular order.

## 2. Per-entrypoint map: 17 hooks

| No. | Hook | Trigger or role | Observed implementation | Native rewrite strategy |
| --- | --- | --- | --- | --- |
| 01 | Sub-Store Core | `sub.store/download`, `api/preview`, `api/sync`, `api/utils/node-info` | Route dispatcher in `sub-store-1.js`; subscription processing & preview | Keep as isolated external dependency initially; avoid implementing parser compatibility from scratch in v0 |
| 02 | Sub-Store Simple | all `sub.store` traffic | `sub-store-0.js` handles subscriptions, collections, settings, tokens, artifacts etc. | Own local API only after defining auth/storage/routing/security contracts |
| 03 | Sub-Store Sync | daily cron | Checks stored artifacts and sync policies; can produce/upload using configured credentials | No implicit network; opt-in scheduler with scoped export destinations and explicit credentials |
| 04 | youtube.request | `youtubei.googleapis.com/youtubei/v1/{browse,next,player,reel/reel_watch_sequence,get_watch}` | **Same script filename as response hook**; examined entrypoint reads `w.response.bodyBytes`; request-phase behavior is uncertain and may be no-op or error | Separate request and response engines; prove necessary request modifications with non-sensitive captures before implementing |
| 05 | youtube.response | `browse,next,player,search,reel...,guide,account/get_setting,get_watch` | protobuf types, field traversal, ad placements removal, background playback flags, caption/lyrics enhancement; persistent ad classifications | Independent protobuf schema + decode/transform/encode pipeline, deterministic fixtures, isolated optional translation |
| 06 | spotify-json | artistview / album entity requests | URL string normalization (iPhone -> iPad) | Pure URL transformer scoped to request host/path/query |
| 07 | spotify-proto | bootstrap and customization responses | protobuf decode + account-attributes mutations + encode | Independent protocol adapter; guard missing nested fields and unknown schema; never assert genuine subscription state |
| 08 | SoundCloudGo+ | `api-mobile.soundcloud.com/configuration/ios` | overwrites plan/features array | Preserve unmodified fields and fail open on invalid JSON; no fake purchase data in native privacy layer |
| 09 | AlightMotion | `getAccountStatusAndLicenses` | throws away parsed input and substitutes whole license response | Schema-aware observer/transformer with typed test fixtures |
| 10 | PicsArt | `/gw-v2/shop/subscription/apple/purchases` | **http-request** intercept; returns synthetic `response` object; not necessarily wrong for Shadowrocket | A request hook may synthesize a response. Test actual runtime semantics separately |
| 11 | Wink | `api-sub.meitu.com/...vip_info_by_group.json` | replaces VIP object, then post-`$done` popup/console notice code | No post-done side effects, schema guards, remove unreviewed obfuscation |
| 12 | Truecaller | premium host subscription/products endpoints | complete synthetic response selected by URL | Guarantee unmatched URL returns unchanged response, verify the regex |
| 13 | Kinemaster | subscribe endpoint | replaces JSON with static subscription properties | Avoid whole-response overwrite; preserve errors |
| 14 | Camscanner | `/purchase/cs/query_prop...` on intsig | JSON parsing and nested property writes for several URL variants | Only **first URL branch** can be triggered by present pattern; other script branches unreachable with current config |
| 15 | BeautyPlus | unlock/balance endpoints | static JSON overwrite including large balance | Scope by exact endpoint, no invented point balances |
| 16 | revenuecat | generic `api.revenuecat.com` receipts/subscribers | reads User-Agent; assigns RevenueCat subscriptions/entitlements; fallback also writes `pro` for unrecognized clients | **Highest blast radius among short scripts:** avoid modifying unrelated RevenueCat clients; separate app identity checks and request privacy guard |
| 17 | deleteHeader | RevenueCat request | clears `X-RevenueCat-ETag` | Already duplicates header rewrite rules; one idempotent strategy is sufficient |

**Important:** synthetic purchase/subscription values shown above modify the response perceived by a client; they do not represent legitimate account purchases. A first-party Khanh Rocket implementation should prioritize consented privacy filtering and standards-compliant response handling rather than issuing fraudulent receipts.

## 3. Deep source traces

### YouTube binary/protobuf engine

Source: `duyvinh09/Module_IOS/js/youtube.response.js`, blob SHA `1c52e039cdba6ebdcc5cec0404814c4aa09a1a33`; ~227 KB source, includes protobuf-ts-derived code.

Execution path inspected:

1. `qr()` chooses type by request URL `or(w.request.url)` from a map including Browse, Next, Player, Search, Shorts, Guide, Setting and Watch.
2. It calls `l.fromBinary(w.response.bodyBytes)`. **This is a response-oriented entrypoint even though the config also runs it as an http-request hook.** Do not assert a working request transformation without a runtime trace.
3. Player handler clears `message.adPlacements` and `message.adSlots`, removes ad tracking field, sets mini-player/background-player fields, augments caption tracks.
4. Browse/Next scan nested protobuf renderer items and unknown fields, classify adverts (e.g. `pagead` marker and `inline_injection_entrypoint_layout.eml`) and store lists under `YouTubeAdvertiseInfo`; false positives/negatives are possible.
5. Lyrics translation calls `w.fetch({method:'GET', url: 'https://translate.google.com/...q='+encodeURIComponent(text)})` **only** when Browse ID starts with `MPLYt`, `lyricLang` is not `off`, and text is available. Current config sets `lyricLang=vi`. Lyrics content can be sent to Google's translation endpoint when this branch runs. This is not evidence that account credentials are sent there.
6. The script writes re-encoded protobuf bytes back to the intercepted response.

Security/correctness: dynamic ad classification may persist stale rules; unbounded `max-size=-1` can increase memory use; binary schema changes can break decoding; large requests can stall. Need fixtures for browse/next/player/search/guide and request-phase traces. Keep translation opt-in and independently tested.

### Spotify protobuf + URL normalization

Sources: `app2smile/rules/js/spotify-json.js` (~365 chars, SHA `61f874...`) and `spotify-proto.js` (~72 KB, SHA `1815250...`).

- URL hook modifies matching request query `platform=iphone` to `platform=ipad`; logs a status message.
- Protobuf hook decodes `bootstrap/v1/bootstrap` or `user-customization-service/v1/customize` when response status is 200 **and request method is POST**.
- Rewrites many account attribute map entries such as `type`, `ads`, `on-demand`, `offline`, `high-bitrate`, `product-expiry`, and display name; re-encodes binary response. This affects apparent client capability, not a server-side subscription.
- `eval("require")` and `Function` exist in bundled protobuf library internals. No proof they execute in Shadowrocket from simple text search; runtime path inspection is still needed.
- **Concrete defect:** unsupported method/path branch notifies but does not assign `body`, then proceeds to `body.buffer` in QuanX branch; this can throw rather than safely return unchanged.
- Another fragility: nested protobuf map paths have no evident guards for API error/schema changes.

Native goal: separate protobuf codec (dependency + license review), strict endpoint/method dispatcher and pure opt-in transforms, with try/catch and unchanged fallback.

### Sub-Store real architecture: more than three random JS files

Version observed: `sub-store-org/Sub-Store` tag `2.42.3` -> commit `a3e61061e50b40e5c5938969aab915d05d8d7069`. Source tree inspected; distributed JS asset bytes were **not** independently obtained and hashed. GitHub-reported release digests are not locally revalidated.

- `backend/src/products/sub-store-1.js` registers download/preview/sync/node-info routes.
- `backend/src/products/sub-store-0.js` registers collections, subscriptions, artifacts, settings, tokens, archives, files, log and other routes.
- `backend/src/products/cron-sync-artifacts.js` reads stored subscriptions, collections, artifacts and settings, checks sync policy, and may generate/upload artifacts.
- `backend/src/restful/artifacts.js` demands `gistToken` before a Gist upload; `backend/src/utils/gist.js` uses the GitHub API (or GitLab API with configured target/token).
- `backend/src/utils/cors.js` defines browser origin allowlists; default documented origins include `https://sub-store.vercel.app`, `http://substore.stash`, `https://substore.stash`. Browser CORS is not an authentication mechanism.
- `Sub-Store Core` and `Simple` URL patterns **overlap** for download/sync paths. Shadowrocket precedence and side effects require device tests.
- **Critical domain warning from upstream:** `sub.store` is NOT owned by the Sub-Store team. If the local rewrite fails, HTTP(S) requests may be delivered to a different public service. Upstream suggests mapping the domain locally; behavior should be verified without breaking legitimate local interception.

Do not assume the cron sends every user's data off-device. Policy has guards: `shouldRun` depends on configured sync artifacts and credentials / upload behavior. Potential exposure exists **if** sync is enabled, credentials configured, or rewrite fails.

## 4. Threat model

| Asset | Attack surface | Mitigation |
| --- | --- | --- |
| Sensitive decrypted HTTPS content | Broad MITM hostname list and dynamically fetched scripts | Narrow hostnames, avoid request-body access unless required, transparent consent |
| Scripts loaded from GitHub `main/master/latest` | Supply chain substitution without config change | Pinned reviewed commits/releases with hashes; release provenance check |
| Local Sub-Store API and settings | Generic `sub.store` fake domain, overlapping routes, CORS and token management | Local DNS sink + interception verification, origin policy, authentication for management endpoints |
| Saved subscriptions, proxy credentials, GitHub/GitLab tokens | Persistent storage and optional remote sync | Scoped token, encrypted storage where supported, never log secrets, explicit sync opt-in |
| Large protobuf messages | CPU/memory cost, malformed wire data, schema drift | Max sizes, timeouts, controlled codec errors, unchanged fallback |
| Third-party app accounts | Synthetic JSON and account/entitlement changes | App-specific guards, keep real account server state distinct from local display state |

### Confidence labels

- **Verified statically:** actual source text, endpoint patterns, code branches, GitHub release metadata and script dependencies.
- **Requires runtime test:** precise Shadowrocket ordering, MITM fallthrough, YouTube request hook behavior, certificate pinning, actual device CPU/memory and cross-version compatibility.
- **Not established:** malware, blanket personal-data exfiltration, genuine purchase entitlements, comprehensive binary supply-chain integrity.

## 5. Khanh Rocket Native target architecture

```text
khanh-native/
  manifest.json           # separate module registry, dependencies, risk and authorizing hosts
  core/
    dispatcher.js          # event normalization: phase, URL, status, content type
    guard.js               # host/path/method/type checks, redaction, size limit
    codec/
      json.js              # schema-validating JSON round-trip
      protobuf.js          # independent typed binary codec + fixtures (later)
    policy/
      router.js            # deterministic policy & conflict detection
      privacy.js           # consented tracking/telemetry controls
    runtime/
      shadowrocket.js      # $request/$response/$done adapter
  modules/
    youtube/               # privacy ad-placement transformer with fixtures (later)
    spotify/               # metadata/URL parser; no claims of entitlement (later)
    substore/              # isolated upstream or independently written adapter (later)
  tests/                   # pure offline unit tests, malformed data, host isolation
  canary/                  # test-only config, never the stable URL
```

Architecture contract:

1. Modules declare exact `phase`, hostname, pathname pattern, body format, maximum bytes, optional capabilities and allowlisted outbound destinations.
2. Dispatcher matches one deterministic handler or rejects ambiguous overlap. No arbitrary remote code in a running configuration.
3. Handlers are pure functions over a copy of event data; no network/persistent storage unless explicitly granted.
4. On decode failure, HTTP error, unknown schema or exception, `$done({})` retains original behavior; alert only with non-sensitive metadata.
5. Independent test fixtures cover JSON error responses, binary malformed protobuf, size boundary, unknown URL, method mismatch and account isolation.
6. Opt-in canary releases only, then compatibility regression tests on device. Keep commit-based rollback.
7. Do not ship vendored third-party code without confirming redistribution license; Sub-Store is AGPL-3.0, subject to its requirements.

## 6. Roadmap: from architecture to self-owned functional software

- **Stage A (this branch):** executable inventory/regex audit + original config snapshot gate + new owned runtime skeleton, no production mutation.
- **Stage B:** defensive JSON and URL modules with host isolation and mocked Shadowrocket harness; no simulated purchases.
- **Stage C:** original YouTube protobuf codec and ad-placement transform driven by anonymized fixtures with explicit opt-in translation. Verify playback, false positives and size/CPU.
- **Stage D:** isolate Sub-Store as optional third-party with pinned source and local-domain safety, or create a smaller first-party subscription processor with explicit user requirements.
- **Stage E:** real-device canary matrix, controlled release, rollback and automated hash/supply-chain monitoring.

No stage may silently overwrite or replace `build/khanh-rocket.conf`.

## 7. Sources and provenance

- Working original source: supplied All In One Pro Max Ultimate and `https://github.com/Vcab3011/Khanh-Rocket/blob/88dbcb4751cc649592f292811b65acb4bed8837b/build/khanh-rocket.conf`.
- YouTube + app scripts: `https://github.com/duyvinh09/Module_IOS/tree/5502a6febe84b7db635d3bd31749731aed5c057b/js`.
- Spotify: `https://github.com/app2smile/rules/tree/df6366a7024e0b3f0aa3510c5b791eea6f3cba89/js`.
- Sub-Store source at reviewed tag: `https://github.com/sub-store-org/Sub-Store/tree/2.42.3/backend/src`.
- Sub-Store upstream domain warning: `https://github.com/sub-store-org/Sub-Store`.
- Previous narrower audits: `reports/SECURITY_AUDIT.md` and draft PR #3.

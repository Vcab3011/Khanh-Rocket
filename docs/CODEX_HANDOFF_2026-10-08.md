# CODEX HANDOFF — Khanh Rocket: Native Shadowrocket V3 + Egern One-shot / Multi-App Lab

**Snapshot date:** 2026-10-08  
**Repository:** https://github.com/Vcab3011/Khanh-Rocket  
**Working handoff branch:** `docs/codex-handoff-2026-10-08` (forked from `feature/multiapp-observability-v1`; this document is the only intentional new change)  
**Audience:** Codex, subsequent AI engineers, maintainers, reviewers.  
**Status:** Functional software prototypes and green offline CI. Production is intentionally frozen. **Not** a guaranteed full 10in1 replacement, full YouTube ad blocker, genuine app subscription service, or permanently VPN-free premium unlock.

> **Codex: read this document before making changes. Do not make unrequested changes to production, do not merge any PR, do not perform real-network interception with user credentials, and do not claim on-device behavior from offline unit tests.** The user communicates primarily in Vietnamese; answer user in Vietnamese unless they request otherwise. Keep engineering artifacts appropriately in English.

---

## 0. NON-NEGOTIABLE CONTRACT — USER-DEFINED GUARDRAILS

1. **Never edit, overwrite, regenerate, replace, commit to, or merge into `main/build/khanh-rocket.conf` without the user's specific, explicit approval.** A general request to "continue", "optimize", or "make V3 work" is NOT such approval.
2. Stable production `main` HEAD: `88dbcb4751cc649592f292811b65acb4bed8837b`. Production rollback:  
   `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/88dbcb4751cc649592f292811b65acb4bed8837b/build/khanh-rocket.conf`  
   This older profile uses externally hosted, mutable script URLs; it is a compatibility rollback, **not** a security-guaranteed immutable-supply-chain solution.
3. Preserve user-tested Shadowrocket `v3-test/build/khanh-rocket-v3-test.conf` exactly unless user *explicitly* asks to modify that URL. Stable test URL:  
   `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/v3-test/build/khanh-rocket-v3-test.conf`.
4. The YouTube **Banner Test** is a **separate** experimental profile, not an authorized replacement for the user-tested V3 Test:  
   `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/v3-youtube-banner-test/build/khanh-rocket-v3-banner-test.conf`.
5. Develop on dedicated feature branches with Draft PRs, peer review, hash-pinned first-party code, CI and spare-device tests. **No automatic merges, no direct production edits, no repointing working profile URLs.**
6. Do not depend on external authors' remotely mutable JavaScript at runtime. Shadowrocket and Egern runtime/platform, GitHub hosting, and actual external application APIs remain unavoidable dependencies.
7. Do not bundle or reuse a shared HTTPS root certificate (historical `egern.p12`). Each testing device must generate and explicitly trust **its own** CA. MITM hostname scope must be minimal. Do not capture tokens, receipts, subscriber IDs or private traffic in logs, fixtures or user-facing screenshots.
8. A locally synthesized entitlement is **not** a genuine App Store purchase, a verified RevenueCat entitlement, a backend authorization, or a permanent subscription. State clearly what is client UI/cache vs legitimate server-side state. Never promise permanent Gold/Premium or full feature parity.
9. If tests are red, investigate and fix test/code defects before suggesting deployment. Synthetic CI passes do not confirm Egern iOS runtime syntax, certificate state, streaming/body handling or service behavior.
10. Historical third-party `locket.yaml` is credited in its source discussion to **lea_qun**; do not claim that source as first-party code. The pasted historical JS has unverified byte-for-byte provenance and unknown reuse/licensing terms. Analyze clean-room; do not casually redistribute it.

---

## 1. USER GOALS / PROJECT SCOPE

The overarching project is **Khanh Rocket**, a self-hosted, independent, inspectable, controlled implementation of iOS network-traffic modules. The original goal was to preserve as much of the user's working multi-app "10in1" configuration as possible without executing unknown third-party code.

Subsequently the user discovered a **historical Egern + Locket One-shot pattern**: Egern was run temporarily, Locket was opened/Restore Purchase performed, then Egern VPN was stopped, yet the displayed or usable Locket state apparently persisted on subsequent app launches. The user wants the mechanism understood and a superior, scalable multi-app system rather than a fragile copy of someone else's YAML/JS.

**The system is explicitly divided into two independently deployed products:**

- **Shadowrocket Native V3:** working compatibility and interception engine for YouTube/Spotify/other app hooks; programmable binary/JSON responses; production 10in1 remains untouched. Primary short-term bug: YouTube feed/banner filtering.
- **Egern One-shot / Multi-App Research Lab:** native YAML modules and ES-module JavaScript for *controlled observation* of client state/cache and endpoint behavior. No assertion that one-shot works for all apps or that a valid server-side purchase can be manufactured. A new adapter can be added per application.

A **shared pure-JS protocol model** plus deterministic builds, test fixtures, data minimization, policy checks, isolated profiles, CI, and explicit on-device gates links the two. Shared pure code does **not** mean Egern's `ctx` and Shadowrocket's `$request/$response/$done` runtimes are interchangeable.

### In scope

- Reverse engineering of **user-provided config** and **user-provided historical JS listing**, with source-confidence levels.
- Strict host/path/app-scoped routing, JSON/Protobuf parsing and metadata-only instrumentation.
- First-party source pinning, baseline preservation, versioned builds/lockfiles, supply-chain risk management and tests.
- Opt-in narrow HTTPS interception on authorized test devices using locally generated CA, with rollback instructions.
- An evidence-based **VPN-off persistence matrix** for app-visible states (immediate, offline, online after cache TTL, restart/reboot/24h).
- Supporting existing first-party Shadowrocket scripts, fixing independently characterized regressions, and expanding one well-specified app adapter at a time.

### Out of scope / do not silently promise

- Actual App Store purchases, official paid account provisioning, or bypassing upstream server-side verification.
- A guarantee that user-facing synthetic Gold/Go+/Premium persists permanently without a VPN.
- Universal YouTube ad-free operation after stopping interception: each new Player/Browse/Search request can return different ad data.
- Claiming automatic app-specific VPN activation or One-shot scheduler exists; the lab currently observes data and requires **manual** off-VPN observations.
- Unbounded MITM of every RevenueCat application; broad entitlement rewriting; shared CA/private key distribution; uploading personal authentication tokens to outside endpoints.
- An independent full Sub-Store equivalent (not implemented), YouTube caption/lyric translation or full 10in1 feature parity.
- Deployment to user's primary phone without a controlled pilot and explicit approval.

---

## 2. GIT / BRANCH / DRAFT PR INVENTORY (VERIFIED 2026-10-08)

| Item | Target / role | State / important facts |
|---|---|---|
| `main` `88dbcb4751cc649592f292811b65acb4bed8837b` | **Protected** original stable profile | `build/khanh-rocket.conf`; third-party runtime scripts; untouched |
| Draft [PR #3](https://github.com/Vcab3011/Khanh-Rocket/pull/3) | Baseline security/deep audit | Head `feature/lock-working-10in1-baseline`; base `main`; open, draft, NOT merged |
| Draft [PR #4](https://github.com/Vcab3011/Khanh-Rocket/pull/4) | Native V2 clean-room reverse-engineered scripts | Head `feature/native-reverse-engineered-v2`; base `main`; open, draft |
| Draft [PR #5](https://github.com/Vcab3011/Khanh-Rocket/pull/5) | V3 first-party control plane, supply-chain audit and canaries | Head `feature/native-v3-security-control-plane`; **base is V2 feature branch**, not main; open, draft |
| `v3-test` `39bb2d467844535cd1945b45193f0d161ca742ba` | Working user-test Shadowrocket URL | Contains `build/khanh-rocket-v3-test.conf`, 15 first-party hook URLs pinned to script commits; preserve |
| Draft [PR #6](https://github.com/Vcab3011/Khanh-Rocket/pull/6) | Experimental YouTube feed/banner patch | Head `feature/v3-youtube-banner-test`; base `v3-test`; only a separate banner profile and patch; user has **not** confirmed banner test success |
| `feature/egern-locket-one-shot` | Earlier separate Egern read-only cache prototype | Files under `egern/`; unverified on device; older/simpler than multi-app lab; don't confuse with AQVPN |
| Draft [PR #7](https://github.com/Vcab3011/Khanh-Rocket/pull/7) | Historical Egern YAML/JS RE and clean-room roadmap | Head `docs/egern-one-shot-cleanroom-design`; base `v3-test`; open, draft; current extended docs |
| Draft [PR #8](https://github.com/Vcab3011/Khanh-Rocket/pull/8) | **Current Multi-App Lab v1 implementation** | Head `feature/multiapp-observability-v1` `ab046e6a3e7715a31b943642f54d100c406c77db`; base `v3-test`; open, draft |
| `docs/codex-handoff-2026-10-08` | This handoff; based on PR #8 code | Documentation-only branch; no production writes |

**Important git topology:** V2, V3, `v3-test`, PR #6, PR #7, and PR #8 are not all merged into one linear `main` history. The draft PRs have different bases. **Codex must inspect history and compare refs before rebasing/cherry-picking/merging; do not assume anything has reached production.** Feature branches may be mutable; pinned 40-char Git commit identifiers for source URLs protect against unreviewed runtime updates.

### Stable link registry

- Main baseline: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/88dbcb4751cc649592f292811b65acb4bed8837b/build/khanh-rocket.conf`
- User-tested V3 Compat: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/v3-test/build/khanh-rocket-v3-test.conf`
- Experimental banner fix: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/v3-youtube-banner-test/build/khanh-rocket-v3-banner-test.conf`
- V3 Privacy canary: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/native-v3-security-control-plane/native/v3/build/privacy-canary.conf`
- V3 Compatibility canary: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/native-v3-security-control-plane/native/v3/build/compat-canary.conf`

These are **test configuration URLs**, not production update authorization.

---

## 3. EXECUTED WORK, CHRONOLOGICAL AND TECHNICAL

### 3.1 Original 10in1 baseline

- `main/build/khanh-rocket.conf`: **17 script hooks**, with **16 distinct third-party runtime JS URLs** noted during comparison; includes YouTube UDP/QUIC deny rules, URL rewrites, map-local rules, MITM, Spotify, RevenueCat/Locket, SoundCloud and assorted application hooks, as well as Sub-Store components.
- 10in1 has some mutable URLs on `main/master/latest`. This creates supply-chain uncertainty and unexpected breakage when maintainers change code.
- Production stable state was user-confirmed historically; *do not* change or regenerate while trying to improve V3.
- The PR #3 baseline audit explored safer isolation and audit tooling. No production merge.

### 3.2 Native V2 — PR #4

- Reversed engineering of original YouTube, Spotify, Sub-Store and small app JSON scripts from accessible upstream sources; documented schema-level findings rather than copying substantial unlicensed third-party bundles into runtime.
- **13 independently written first-party JavaScript files** under `native/v2/scripts/` covering selected existing 10in1 functions; owned protobuf reader/writer preserves unknown fields where feasible, enforces size limits, fails open on unexpected/malformed payloads.
- Important examples:
  - `native/v2/scripts/youtube-player-protobuf.js`: selected `player`, `get_watch` and Shorts processing; adPlacement/adSlots fields and player background/mini-player updates. NOT full Guide/Settings, captions/lyrics, app-version schema parity.
  - `native/v2/scripts/spotify-protobuf.js` and `spotify-json.js`: synthetic data tests for Bootstrap/Customize and artist/album routes.
  - `native/v2/scripts/locket-revenuecat.js`: Locket-only User-Agent check, modifies synthetic `subscriptions` and `entitlements.Gold` in RevenueCat JSON. **No legitimate subscription is created.** Rejects unrelated RevenueCat app requests.
  - `native/v2/scripts/soundcloud-go.js`: edits `plan` and `features` on `https://api-mobile.soundcloud.com/configuration/ios`, including `offline_sync`, `no_audio_ads` and `hq_audio` flags. Displayed feature flags are not proof of server-enforced rights.
  - Other scripts: Alight Motion, PicsArt, Wink, Truecaller, KineMaster, CamScanner, BeautyPlus, request-header scripts.
- Two independent canaries: `native/v2/build/hybrid-canary.conf` (more feature overlap, still some upstream scripts) and `native/v2/build/native-only-canary.conf` (owned-only but incomplete).
- Historical V2 tests: **13 Node + 4 Python** passed in prior CI.
- See `reports/KHANH_V2_REVERSE_ENGINEERING_DEEP_DIVE.md` and `native/v2/README.md` in PR #4.

### 3.3 Native V3 — PR #5

- V3 extends V2 with first-party script control and a deterministic profile generator `native/v3/build_canary.py`.
- `native/v3/build/privacy-canary.conf`: 4 script hooks; narrow MITM, YouTube/Spotify URL/local node helper, not full app compatibility.
- `native/v3/build/compat-canary.conf`: **15 owned first-party JS hook sources**, every JS path pinned to a known immutable SHA. The original working 10in1 source is *read*, never modified by the generator.
- JS commits pinned by current V3 canaries:
  - **V2 JS source**: `d7d43523dd973c0184a70a3398935c15eef96648`
  - **V3 JS source**: `05f8ae6a3b96eae528b0c786d3de8ccbd0a978b0`
- `native/v3/supply-chain-lock.json` plus `native/v3/audit_supply_chain.py` audit all 15 owned source blob hashes, check scripts' first-party URLs/refs, disallow selected suspect networking/storage/dynamic-code primitives, verify MITM/profile safety. This is a **static heuristic**, not formal proof and not a device download integrity guarantee.
- `native/v3/scripts/youtube-browse.js`: typed protobuf traversal for Browse/Next/Search, selective ad removal; conservative, incomplete for banner variants.
- `native/v3/scripts/offline-subscriptions.js`: limited stateless local node normalizer on reserved `khanh.invalid` endpoints. **Not** Sub-Store Core/Simple/Cron replacement, remote fetching, Gist/GitLab sync, real subscription manager. Interception of reserved `.invalid` HTTPS in Egern/Shadowrocket **unverified on device**.
- CI verified in earlier PR #5 run: **8 V3 Python + 11 V3 Node tests**, plus inherited V2 and baseline checks. Example successful run `https://github.com/Vcab3011/Khanh-Rocket/actions/runs/37788769874`.
- `main` baseline was not modified; PR #5 remained Draft.

### 3.4 Separate V3 test URL, real user observations

- Dedicated `v3-test` branch was created with `build/khanh-rocket-v3-test.conf`, based on the 15-hook compatibility canary.
- **Actual user-reported iPhone result:** V3 connects, YouTube **background playback works** and **in-video advertisements are suppressed**. Feed/home/search **banner advertisements remain**.
- **The user also reported iPad vs iPhone differences** earlier; differences may involve HTTPS certificate trust, MITM setup, platform/app versions and cache. Do not claim cause without a request-level trace.
- User confirmation of no in-video ads is real-world evidence for the combined profile, **NOT differential proof which specific rule or script suppressed them**.
- YouTube Banner Test in draft PR #6:
  - `native/v3/scripts/youtube-banner-filter.js` explicitly inspects typed layout EML ad markers; handles `Search.onResponseReceivedCommand` (field 7) and additional continuation paths.
  - Separate `build/khanh-rocket-v3-banner-test.conf` changes only `youtube.native.browse` JS path, keeping 14 other hooks and the video script unchanged.
  - A successful offline CI run on PR #6 existed, with 22 V3 JavaScript tests; **the user has not confirmed success on actual iPhone**. Keep it separate.
- Not-yet-complete: YouTube Guide/Settings, captions/lyrics, some Browse/Next/Search and search continuation schema changes, exact Shorts banner coverage, fixture-derived device parity.
- Original YouTube player/browse code uses protobuf; do not treat it as plain JSON or generic URL blocklists.

### 3.5 Egern historical AQVPN artifact — provided directly by user

**Source:** uploaded local file `locket 2.yaml`, 27 lines; conversation has images of an *old iPhone* with Egern `Locket_Gold_AQVPN` installed, Remote script URL and status "updated 2 years ago". This establishes a historical Egern script config was present; **it is not an extracted cryptographically hashed cached JS file**.

Exact YAML facts:
- `mitm.enabled: true`
- `mitm.ca_p12: egern.p12`; `mitm.ca_passphrase: egern`; `mitm.hostnames: [api.revenuecat.com]`. **Historical only, do not reuse shared CA.**
- Two `header_rewrites` delete `X-RevenueCat-ETag` and lowercase variant on RevenueCat `receipts/subscribers` requests.
- One `scriptings.http_response` hook named `Locket_Gold_AQVPN` matching RevenueCat receipts/subscribers endpoints; `body_required: true`, `update_interval: 5` (script asset update interval, NOT purchase refresh).
- External URL: `https://download.aqvpn.eu.org/script/apptesters/Locket_Gold.js`.
- Social-source user attribution: `lea_qun`, shared in VOZ post `https://voz.vn/t/cach-lam-locket-gold-bang-egern.968037/`. The historical YAML was also associated with `https://aqvpn.me/scripts/locket.yaml`; upstream URL was not readily accessible during the earlier analysis.
- The external source could not be fetched previously. **Later, user pasted JavaScript they associate with the historical script.** A literal file/hash match to old Egern cache is still unverified.

**STATIC ALGORITHM OF USER-PASTED JAVASCRIPT (what the text proves):**

1. Captures `$request`.
2. Calls `GET https://api.revenuecat.com/v1/product_entitlement_mapping` via `$httpClient.get`, forwarding intercepted request's `Authorization` and `User-Agent` headers and `X-Platform: iOS`.
3. Immediately parses mapping JSON without checking callback error/status.
4. Builds an *entirely new subscriber response object*, with hardcoded original user ID, dates and empty other-purchase fields.
5. For each discovered product and entitlement in `product_entitlement_mapping`, creates synthetic subscription and entitlement records with `PURCHASED` / `app_store` and expiration in year **9692**.
6. Calls `$done({body})` replacing the entire matched HTTP response. **No storage API, no permanent server-side entitlement grant is present in this listing.**
7. The code has no evident app-specific User-Agent gate inside the snippet; YAML matches a common RevenueCat host; does not validate JSON schema or HTTP errors; may unintentionally target other apps. Raw subscriber data is thrown away; invalid/fixed IDs and dates may conflict with real account state. It forwards sensitive authorization to a RevenueCat-hosted endpoint (not per se unrelated exfiltration) but the external updater was mutable.
8. Exact provenance of this pasted JS remains unverified. Do **not** simply integrate it as first-party production code; third-party licensing and API changes are unknown.

Why observed **One-shot** might work:
- RevenueCat `CustomerInfo` is cached between application launches. Sources: `https://www.revenuecat.com/docs/test-and-launch/debugging/caching`; restore purchase refresh: `https://www.revenuecat.com/docs/getting-started/restoring-purchases`.
- Approximately **5 minutes** foreground / **25 hours** background are *documented general SDK cache refresh thresholds* rather than guarantees for this particular Locket build.
- A prior post describes turning off Egern after running **Restore Purchase**; the user remembers reopening Locket after disconnect while some state persisted.
- Alternative hypotheses: SDK cache; application-specific local state; backend-recognized account state; tunnel never truly stopped. Historical code alone **does not distinguish these**.
- Do NOT claim permanent activation: valid App Store transaction and server-verified entitlements are separate concepts.

Extended source-backed historical analysis: `docs/EGERN-LOCKET-ONE-SHOT-CLEANROOM-PLAN.md` on PR #7. **Do not lose provenance/confidence caveat.**

### 3.6 Earlier Egern narrow prototype

- Separate branch `feature/egern-locket-one-shot` contains `egern/scripts/locket-cache-probe.js`, `egern/scripts/locket-cache-widget.js` and `egern/modules/locket-observe.yaml` / `cache-status.yaml`.
- Uses native Egern `export default async function(ctx)` and reads only limited metadata. **Does not simulate purchases or grant Gold**.
- Prototype status: native module and device behavior not independently confirmed.
- The multi-app lab in PR #8 should be preferred as the current base for new work; earlier Egern branch is useful for history, not an authoritative merged dependency.

### 3.7 Multi-App Observability Lab V1 — PR #8 (latest executed engineering)

Branch `feature/multiapp-observability-v1`, head `ab046e6a3e7715a31b943642f54d100c406c77db`, draft PR #8 against `v3-test`. **18 new/changed files, no modification to 10in1 production or V3 Test.**

Key files:
- `lab/core/observer-core.js` — pure JS route classifier, JSON schema-specific inspectors, safe event normalizer/allowlist, 32-record/24h TTL bound, local summary. **No direct network, persistence or logging** from the core.
- `lab/runtime/egern-observer.template.js` — Egern native `export default async function(ctx)` adapter; narrowly checks request URL/User-Agent/status/content-type, inspects JSON on Locket/SoundCloud, observes YouTube protobuf endpoint **without consuming it**. Reads Egern response's one-shot `arrayBuffer()`, analyzes a limited UTF-8 body, and returns the original `Uint8Array` as `{body}` when consumed. This exact return/body/header/compression behavior still needs **on-device** validation.
- `lab/runtime/egern-status.template.js` — read-only aggregated local status widget.
- `lab/tools/build_runtime.py` — deterministic offline bundler replacing one `__KHANH_CORE__` placeholder in each template; generates:
  - `lab/build/egern-observer.js`
  - `lab/build/egern-status.js`
  - `lab/build/egern-reset.js` (manual local deletion; authored standalone).
- Five separately installable Egern YAML modules:
  - `lab/modules/egern-locket-observe.yaml` — MITM `api.revenuecat.com`, Locket `CustomerInfo`.
  - `lab/modules/egern-soundcloud-observe.yaml` — MITM `api-mobile.soundcloud.com`, feature config.
  - `lab/modules/egern-youtube-observe.yaml` — MITM `youtubei.googleapis.com`, **metadata-only**, no protobuf body read.
  - `lab/modules/egern-observe-status.yaml` — local status, no MITM.
  - `lab/modules/egern-observe-reset.yaml` — local observation clear, no MITM.
- `lab/tests/observer.test.cjs`, `lab/tests/egern-runtime.test.cjs`, `lab/tests/reset.test.cjs` — synthetic endpoint isolation, malformed JSON/status/oversize, no account IDs in logs, TTL, one-shot observation timeline, single-use response stream fidelity on fake runtime, manual reset.
- `lab/tests/test_modules.py` — YAML parser, host scope, pinned JS, no shared CA/overbroad rewrite, local status/reset validation.
- `.github/workflows/multiapp-lab.yml` — dedicated pipeline; `lab/README.md` — on-device test protocol, data governance, mechanism comparison.
- User-facing lab is **read-only diagnostics**, intentionally **not** a new Gold/Go+/YouTube-unlock script.

**Pinned first-party Egern JS** on PR #8:
- Observer: `d735822182c8ea215739aa595f6cfff815ea8bac` / `lab/build/egern-observer.js`
- Status: `64e4a8ff606a329ca6bedc750f8bed58c590feb6` / `lab/build/egern-status.js`
- Reset: `3f9f748ca90e7cf2c68aef1f039014d7c8b6c7f6` / `lab/build/egern-reset.js`
- These fixed script SHA refs are **not** the mutable lab branch URL; module YAML itself currently uses branch-ref URL for convenient test import.

**Latest CI verification, head `ab046e6a...`:**
- [Multi-App Lab validation run 37800149134](https://github.com/Vcab3011/Khanh-Rocket/actions/runs/37800149134) — **success**.
- [Shadowrocket baseline validation run 37800149163](https://github.com/Vcab3011/Khanh-Rocket/actions/runs/37800149163) — **success**.
- Prior lab logs at run 37800049016: **25/25 Node** + **4/4 Python**, deterministic JS build, supply-chain and baseline checks passed. Later tiny change added a Python check for reset module; latest CI is green. **These are synthetic/local CI checks, not on-device Egern validation.**

Verified lab module URLs:
- Locket: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/multiapp-observability-v1/lab/modules/egern-locket-observe.yaml`
- SoundCloud: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/multiapp-observability-v1/lab/modules/egern-soundcloud-observe.yaml`
- YouTube observer: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/multiapp-observability-v1/lab/modules/egern-youtube-observe.yaml`
- Local widget: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/multiapp-observability-v1/lab/modules/egern-observe-status.yaml`
- Local history reset: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/multiapp-observability-v1/lab/modules/egern-observe-reset.yaml`

**Privacy model:** only event schema version, app family, endpoint class, HTTP status, time, signal/parse outcome, selected boolean presence flags and aggregate feature/entitlement counts. **Never store** URL path, subscriber/account ID, raw UA, JWT, bearer, App Store receipt, full payload, video title, song info. At most 32 events, 24h TTL, manual clear. Static tests reject leakage of representative fake identifiers.

---

## 4. MECHANISM MATRIX — DO NOT BUILD A UNIVERSAL "PREMIUM SWITCH"

| App / family | Observed protocol and endpoints | Present first-party behavior | One-shot prospect | Real unknowns |
|---|---|---|---|---|
| **Locket** | RevenueCat REST JSON; `/v1/subscribers/{id}`, `receipts`, `/v1/product_entitlement_mapping` | V3 compat separately performs client-side JSON changes; Egern lab *observes only*. Historical AQVPN uses dynamic mapping and whole-response synthetic overwrite | Plausible **client cache/UI state** persistence across app relaunch | iOS SDK version, actual response/schema, signed/verified entitlements, backend checks, how long state persists after refresh |
| **SoundCloud** | `https://api-mobile.soundcloud.com/configuration/ios` JSON | V3 compat sets `plan` and `features` in response; Egern lab observes counts | May retain feature-config state in memory/cache, likely variable; **not guaranteed** | Playback/ads/quality/offline may be enforced elsewhere; current app version/response schema |
| **YouTube** | `youtubei.googleapis.com/youtubei/v1/{player,get_watch,browse,next,search,reel/reel_watch_sequence}` protobuf, URL rewrites and UDP rejects | User-confirmed V3 background playback + video ad suppression, banners remain; separate PR #6 banner experiment | One-shot generally **not viable for ongoing ad blocking** on newly fetched videos/feeds | Typed schema changes, direct EML ad variations, captions/Guide/Shorts, actual request traces, exact binary body semantics |
| **Spotify** | `spclient.wg.spotify.com` and `*spclient.spotify.com` Bootstrap/Customize protobuf, artist/album request routes | V2 first-party JSON/protobuf compatibility scripts in V3; **not confirmed on device** | UI and metadata caching possible; real playback/selection rights potentially server-bound | Live account state, API changes, sign-in, playback, offline entitlement |
| **Alight Motion / PicsArt / Wink / Truecaller / KineMaster / CamScanner / BeautyPlus** | Multiple app-specific JSON request or response API routes | V2 first-party scripts reused in V3 compat | Varies; cannot infer durability from one response | Each version/endpoint, app's own server verification, proof of no cross-app effects |
| **Other RevenueCat consumer** | Shared `api.revenuecat.com` domain | **Not** authorized to assume Locket rules apply; V2 filters User-Agent | Unknown | Actual app identity, legitimate features, authorization and signed data |

The key architectural insight is **an app-specific state machine**: transient response/content filtering (YouTube), feature configuration caching (SoundCloud), subscription metadata caching (Locket/RevenueCat), or server-enforced rights (some Spotify/app actions). Different correctness criteria and device verification for each. There is **no single safe cross-app Gold payload**.

---

## 5. DESIGN OF NEXT ITERATION (V1.1 → V2), ARCHITECTURE

```text
       Repository / trusted release inventory
          first-party source, SHA, policy, tests
                       |
              App Registry + Schema Contracts
                       |
         Pure Parsing / Event Classification
                  /                 \
     Shadowrocket adapter       Egern native adapter
        $done / bodyBytes      ctx / stream / storage
                  \                 /
               Local-only Observations
                 32 records, 24h TTL
                       |
              Explicit Device Test Gate
     capture-on -> VPN truly off -> reopen/offline/
      online >5m -> reboot -> 24h -> reset
```

For each new app define:
- `appId`, exact allowlisted host & anchored route patterns, method constraints, ownership/verification confidence, permitted observation data.
- Wire format: JSON, protobuf, GraphQL etc. Narrow schema parser and capped response size/depth.
- Semantics: ad/content suppression vs locally cached feature flags vs genuine server-authorized rights. A UI label alone is insufficient.
- Separate **observer adapter** vs **behavior-changing compatibility script**. Default **read-only** and fail-open.
- Synthetic fixtures for normal/absent/malformed/oversized/non-200/unknown schema/other app/false-positive URL/encoding.
- On-device behavior matrix; no claim of app functionality before matching user-observed evidence.
- Security threat review, source pin, per-app opt-in module and rollback profile.

**Do not directly combine Egern observer with existing Shadowrocket response-modifying hooks** on the same traffic path: two VPN tunnels or rewriting chains confound test results.

---

## 6. REPRODUCTION / LOCAL COMMANDS FOR CODEX

Clone/open `https://github.com/Vcab3011/Khanh-Rocket`. For current code:
```sh
git fetch --all --prune
git switch docs/codex-handoff-2026-10-08
git status --short
# OR check out feature/multiapp-observability-v1 for existing PR #8.
```

Offline toolchain expected: Node.js 22+ (native `node --test`), Python 3.12+, PyYAML 6.0.2 for lab module schema tests. No secrets, external service credentials or local app data required.

```sh
python -m pip install PyYAML==6.0.2
python lab/tools/build_runtime.py --check
node --test lab/tests/*.test.cjs
python -m unittest discover -s lab/tests -p 'test_*.py' -v
python tools/validate_legacy.py
python native/v3/audit_supply_chain.py
# Additional existing verification:
node --test native/v2/tests/*.test.cjs
node --test native/v3/tests/*.test.cjs
python -m unittest discover -s native/v3/tests -p 'test_*.py' -v
python native/v3/build_canary.py --profile compat --check
python native/v3/build_canary.py --profile privacy --check
```

**Security caveat on tooling:** `lab/tools/build_runtime.py` writes **lab/build JS artifacts** (not production) when run *without* `--check`. `native/v3/build_canary.py` writes into `native/v3/build` when run without `--check`. Never blindly run build scripts that might regenerate protected profiles; review output paths. No `npm install`/dependency fetch should be needed for core tests.

GitHub Actions:
- `.github/workflows/validate.yml`: baseline/V2/V3 checks; currently watches `main`, `feature/**` and PRs.
- `.github/workflows/multiapp-lab.yml`: Node/Python Egern lab pipeline.
- Do not rewrite baseline-lock snapshots simply to get CI green. Treat baseline changes as regressions unless expressly authorized.

**A known subtlety:** custom test VMs may produce cross-realm arrays, so normalize before using Node `assert.deepStrictEqual` across realms. A previous early lab CI failure was a test assertion artifact, corrected before green CI.

---

## 7. CRITICAL RISKS / KNOWN TECHNICAL DEBT

### 7.1 Egern runtime and data preservation

- Egern native scripts use `export default async function(ctx)`; Shadowrocket JS uses `$request`, `$response`, `$done` and specific binary body flags. The historical `$httpClient` code is NOT proof it will execute identically in modern native Egern.
- `ctx.response` is a one-shot body stream. Current lab consumes `arrayBuffer()` for JSON, then returns original `Uint8Array`. Mock tests confirm fidelity under fake Egern runtime; **real Egern device tests must verify** returned body type, Content-Encoding, Content-Length, status, headers, correct decompression and no app failures. Do not claim byte fidelity at the *wire* level just because JS returned the same buffer.
- Egern module YAML structural parse tests do **not** guarantee all keys/`scriptings.generic`/widget formats are supported in the user's exact Egern version. Test import and execution; fix separately.
- The proposed `mitm.enabled` and hostname do not include a reusable CA cert; this is intentional. User must create local trusted CA. Restrict scope.
- User wanted independent data on multiple devices before; do not conflate app VPN tunnel with cellular plan details.
- The lab stores presence of `Gold` field **only**, not proof it is active, verified, currently valid, or server-backed. A new metric must be rigorously named and scoped.

### 7.2 Locket One-shot

- The user-provided historic script **overwrites entire subscriber JSON**, has insecure hard-coded original user ID/dates, far-future expiry, ignores network and parse errors, and lacks an app-specific filter in the snippet. These patterns should **not** be replicated as the default architecture.
- Dynamic product/entitlement mapping should be modeled as **read-only metadata discovery** without exfiltrating tokens, forging receipts or overwriting client account state.
- Verification of One-shot persistence must record actual VPN-off status, app termination, offline/online behavior, cache TTL, reboot and 24-hour checks. The lab **cannot directly observe network while VPN is off**; use an explicit user log and compare statuses. Avoid hidden background work claims.
- Egern may cache script updates and show "last updated 2 years ago"; the old device screenshots do not prove possession of the exact historical code bytes. Extract local cache only with user authorization, protect phone backup and CA/private data.

### 7.3 YouTube / Spotify and other apps

- User-confirmed V3 YouTube video suppression/background playback is valuable. Never regress it when changing Browse/Next/Search. Banner PR #6 is isolated; its positive CI is **not** user confirmation.
- YouTube proprietary protobuf fields and ad layouts drift. Never "delete everything containing pagead" over entire responses. Preserve unknown fields and ordinary recommendations; fail open on malformed content.
- SoundCloud feature-config rewriting is client display behavior, not a promise that downloads/playback/high-quality operations work without actual server authorization.
- Spotify, Locket and other V2 application hooks have mostly synthetic tests; do not claim complete compatibility, reliable Premium unlock or offline access.
- Sub-Store Core/Simple/Sync from the original 10in1 is not replaced by V3 limited local normalizer. Original third-party Sub-Store is AGPL-3.0; code reuse carries license obligations.
- Egern and Shadowrocket should have separate profiles/URLs; **never** install a Shadowrocket `.conf` as an Egern `.yaml` and expect equivalent semantics.

### 7.4 Supply chain

- Pin JS to **commit SHA**, build from local audited bytes, avoid runtime third-party authors' URLs, record source file blob IDs/SHA256; inspect any changed script before re-pinning.
- Egern module YAML is currently fetched using a mutable *feature branch* URL for canary convenience; the script URLs inside the YAML are pinned commits. Release may pin module YAML itself to an approved commit after on-device validation.
- No remote request logs, auth headers, real receipts or personal identifiers in fixtures.
- Static API literal scanning catches only selected unsafe patterns; Code review and device behavior matter.

---

## 8. IMMEDIATE NEXT TASKS FOR CODEX (ORDERED BACKLOG)

### P0 — Audit current branch and preserve invariants (must do first)

1. `git status`; verify protected `main` HEAD `88dbcb4...` and git blob of `main/build/khanh-rocket.conf` (last observed blob `e1f1f71ef4e9c0fa88ef68ffafecb02c81153a29`). Compare `v3-test/build/khanh-rocket-v3-test.conf` (last observed blob `4ca2337e4473785bbaa5439de343acddfa1059cd`).
2. Review PR #8 changed files and newest CI runs; run the lab and baseline test suites **without writing any production file**.
3. Check script pins really identify the same audited bytes in GitHub history and which branch PRs contain optional features. Stop on any mismatch.
4. Deliver a concise "files changed / tests run / production untouched" report.

**Gate:** zero protected-profile modifications, green current CI, no leaked data.

### P1 — Strengthen the multi-app core safely

1. Review API contract with official Egern JS runtime documentation. Add integration test fixtures for `Response.arrayBuffer` / `Headers` / available `ctx.storage` calls; ensure fail-open byte restoration.
2. Add controlled cases: Content-Encoding gzip vs decompressed body, invalid UTF-8, response 204/304, URL/query variation, HEAD/non-GET/POST methods, 256 KiB cap and 32-event retention; verify status/content type preserved.
3. Add explicit `bodyUnavailable`/schema-drift counters and a device-visible "last capture" plus manual experiment checkpoints, not arbitrary raw JSON storage.
4. Extend deterministic build checks to reset script and expected immutable pins, without rewriting branch's baseline.
5. Add a static test that disallows account identifiers, auth, receipt body, or entire URLs in event store and all debug logs; ensure wrapper adapter exceptions preserve app behavior.

**Gate:** all synthetic tests + module schema tests pass; still no device-parity claim.

### P2 — Egern spare-device acceptance

1. On **old/spare iPhone**, install **only Locket Observer + Status** from current feature branch. Local Egern CA only, no shared P12.
2. Test import and script execution with VPN ON; verify captured Locket endpoint count and no unrelated app modification. Use **synthetic local logs** where possible; do not send private account traffic to Codex/ChatGPT.
3. Close Egern and verify VPN is truly OFF; Locket reopened offline, online immediately, >5 minutes, after force close, reboot, ~24/25 hours later. Record separately UI label / local functionality / actual server-requiring action. **Do not assume a legitimate Restore Purchase creates a paid subscription if no purchase exists**.
4. Re-enable observer to see whether refreshed response differs from cached state. Purge lab metadata by reset module and repeat.
5. Separately test SoundCloud observer then YouTube endpoint observer; verify no app connectivity failures or timing spikes.

**Gate:** measured, reproducible per-app results, screenshots without personal information, explicit limitations.

### P3 — Shadowrocket V3 functional audit and banner branch

1. Keep stable player script and its pinned URL intact. Compare isolated PR #6 Browse-only changes with user screenshots and sanitized synthetic wire fixtures.
2. Identify banner layout and endpoint explicitly; add narrowly targeted test before changing regex/codec. Preserve ordinary video tiles and unknown protobuf fields.
3. Test user-confirmed background playback + video ad suppression after change; on-device video/Shorts/feed/search; no production promotion automatically.
4. Independently measure Spotify, SoundCloud, Locket, and other modules; distinguish client display from server-enforced entitlements.

**Gate:** no regression in confirmed V3 behavior, benchmarked device result, safe rollback.

### P4 — New app extensibility protocol

1. Add a registry entry for one user-requested fourth app only after endpoint/schema evidence.
2. Define separate per-app module URL, least-privilege hostname, JSON/protobuf schema, observer event allowlist, synthetic fixture set, version compatibility and "One-shot potential" class.
3. Reject any generic entitlement fabrication or universal RevenueCat wildcard. Maintain explicit authorized test device scope and privacy handling.
4. Produce an app matrix marking **verified in code**, **verified by CI**, **verified on device**, **server-verified entitlement**, independently.

**Gate:** onboarding one app adds files/tests, not modifications to unrelated apps' classifiers.

### P5 — Release review, not automatic release

- Version tag/manifest, CHANGELOG, doc of CA handling, bill of behavior by app, pinned script hashes and exact rollback.
- CI green and user acceptance for each independently deployed profile.
- Manual, explicit user authorization **before modifying production**; do not merge any draft PR or rebase/change stable links by default.

---

## 9. REQUIRED REPORTING FORMAT FOR CODEX

For every substantive task, report in Vietnamese:

1. **Đã xác minh (verified):** exact branch, commit, files, source evidence and on-device observation if any.
2. **Đã thay đổi:** precise code/docs/config paths; link Draft PR; protected files untouched check.
3. **Kiểm thử:** commands, count, CI link, pass/fail; separate offline/mock from iPhone/iPad results.
4. **Chưa xác minh / rủi ro:** iOS runtime, signing/verification, network body semantics, proprietary schema drift, server-side rights.
5. **Bước tiếp theo / rollback:** specific test on spare device, existing stable profile links, any user input needed.

Avoid statements such as "100% owned infrastructure" without acknowledging GitHub/Shadowrocket/Egern/API dependencies; "Full premium without VPN"; or "Tested on iPhone" based solely on Node mocks.

---

## 10. CODEx STARTER PROMPT (COPY INTO LOCAL CODEX IF NEEDED)

> You are the engineer responsible for Khanh Rocket. First read `docs/CODEX_HANDOFF_2026-10-08.md` (this file), then `lab/README.md`, `native/v3/README.md`, `reports/KHANH_V2_REVERSE_ENGINEERING_DEEP_DIVE.md`, and the PR #7 Egern reverse-engineering document on its separate branch. Inspect existing branch topology and CI. **Treat main/build/khanh-rocket.conf and v3-test/build/khanh-rocket-v3-test.conf as strictly protected. No merges and no modifications to those paths unless I explicitly authorize them.** Start with P0/P1: run lab and baseline tests without touching production, audit Egern response-body preservation and runtime API contracts, and propose the smallest safe PR with synthetic fixtures. Keep Locket/RevenueCat, SoundCloud feature-config and YouTube protobuf mechanisms separate. Do not claim permanent premium entitlement from client state or cache. Respond in Vietnamese with precise evidence, branch/PR links, tests, remaining uncertainty and rollback.

---

## 11. PRIMARY REFERENCE INDEX

Repository / code:
- [Main protected baseline](https://github.com/Vcab3011/Khanh-Rocket/blob/main/build/khanh-rocket.conf)
- [V3 independent code/control plane PR #5](https://github.com/Vcab3011/Khanh-Rocket/pull/5)
- [Working V3 test profile](https://github.com/Vcab3011/Khanh-Rocket/blob/v3-test/build/khanh-rocket-v3-test.conf)
- [YouTube Banner isolated PR #6](https://github.com/Vcab3011/Khanh-Rocket/pull/6)
- [Historical Egern RE plan PR #7](https://github.com/Vcab3011/Khanh-Rocket/pull/7)
- [Current Multi-App Lab PR #8](https://github.com/Vcab3011/Khanh-Rocket/pull/8)
- [Multi-App Lab code and README](https://github.com/Vcab3011/Khanh-Rocket/blob/feature/multiapp-observability-v1/lab/README.md)
- [V2 RE report](https://github.com/Vcab3011/Khanh-Rocket/blob/feature/native-reverse-engineered-v2/reports/KHANH_V2_REVERSE_ENGINEERING_DEEP_DIVE.md)
- [Egern historical RE and limitations](https://github.com/Vcab3011/Khanh-Rocket/blob/docs/egern-one-shot-cleanroom-design/docs/EGERN-LOCKET-ONE-SHOT-CLEANROOM-PLAN.md)

Official behavior/context to re-verify when making new claims:
- [RevenueCat CustomerInfo caching](https://www.revenuecat.com/docs/test-and-launch/debugging/caching)
- [RevenueCat Restore Purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases)
- [Egern JavaScript API](https://egernapp.com/docs/javascript-api/)
- [Egern Scriptings configuration](https://egernapp.com/docs/configuration/scriptings/)
- [Egern YAML modules](https://egernapp.com/docs/configuration/modules/)

Source-confidence key: **[G]** git code/config confirmed; **[U]** user-provided artifact or on-device observation; **[D]** official API documentation; **[I]** inference/hypothesis requiring tests; **[T]** synthetic test result. Always label ambiguous conclusions appropriately.

**End of handoff.**
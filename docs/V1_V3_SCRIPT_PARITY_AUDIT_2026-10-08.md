# Khanh Rocket V1 vs V3 r3 — source/script behavioral parity audit

**Audit date:** 2026-10-08  
**Audited exact profiles:**
- V1 production: `main@88dbcb4751cc649592f292811b65acb4bed8837b:build/khanh-rocket.conf`; Git blob `e1f1f71ef4e9c0fa88ef68ffafecb02c81153a29`.
- V3 actual published test branch: `v3-test@ba5812d913bc26eb13485f91b1593295a0921e76:build/khanh-rocket-v3-test.conf`; Git blob `05c6202ed4da8964fe8407ea54a5297f454933ef`; profile header `Khanh Rocket V3 r3 COMPAT CANARY`.
- V3 YouTube live source pin: `34aa571c69654590302b5dde757924ecd06c6372/native/v3/scripts/youtube-response-r3.js` (not the earlier two-script `compat-canary.conf`).
- Other V3 V2-derived JS source pin: `d7d43523dd973c0184a70a3398935c15eef96648/native/v2/scripts/*.js`; local node helper pin: `05f8ae6a3b96eae528b0c786d3de8ccbd0a978b0/native/v3/scripts/offline-subscriptions.js`.

**Source methodology:** Inspect the two actual config files, the exact pinned V3 JavaScript files, and **currently fetched** upstream JavaScript from `duyvinh09/Module_IOS@main`, `app2smile/rules@master`; inspect repository's R2/R3 comparison tests and docs. Upstream master/main refs are mutable: **current** upstream code cannot prove the precise third-party script bytes the user's phone ran in 2024/2025 or even at every earlier V1 invocation. Findings distinguish exact code/config deltas from conjectured real-world outcomes. No real credentials, receipts, payloads or device traces used.

**Scope:** Behavioral equivalence and loss of features, not an instruction to synthesize a genuine paid purchase. An HTTP response that displays a premium badge is not proof of server-side authorization.

**VERY IMPORTANT:** This is a docs-only audit. Do NOT edit `main/build/khanh-rocket.conf` or `v3-test/build/khanh-rocket-v3-test.conf`, rewrite production URLs, merge a PR, or claim phone validation from source inspection.

## Executive summary

**V1 = 17 script hooks + full third-party Sub-Store; V3 r3 = 14 hooks, exclusively owned/pinned JS, not feature-equivalent.** The reduction is not solely dead-code elimination:
- Three Sub-Store Core/Simple/Cron hooks entirely missing; replaced by one limited stateless `khanh.invalid` normalizer, **not comparable** functionality.
- A V1 YouTube `http-request` hook is absent; actual benefit of the source's request-phase call is not established because the upstream script is principally a response-body processor.
- V1 YouTube `http-response` hook replaced by a single consolidated `youtube-response-r3.js` handler on V3. V3 r3 supersedes prior V3's separate `youtube-player-protobuf.js` and `youtube-browse.js` in the **published v3-test URL**.
- Many JSON response scripts (notably **SoundCloud**, Alight Motion, Wink, KineMaster, BeautyPlus, PicsArt, Truecaller and CamScanner) output largely the **same recognizable JSON** under valid matching inputs; added schema/status guards can deliberately pass through where V1 would run, error, or target unrelated traffic.
- V1's RevenueCat ETag header-del pair is gone in V3; V3 retains a request hook that **sets one matching ETag header to empty string**, which is not necessarily wire-equivalent to *deleting* headers.
- The V1 MITM list uses `%APPEND%` and excludes `-redirector*.googlevideo.com`; V3 uses an explicit list, drops `sub.store`, includes `khanh.invalid` and lacks the original redirector exclusion.
- The principal outstanding **YouTube feature omissions** are Guide menu filters, captions/lyrics translations, wider dynamic ad classification and some original Settings additions. This explains *possible* but not proven feed-banner differences; the only definitive device result available is a user-reported failure on an earlier R2. R3 needs a new device acceptance test.

## Priority classification

| Risk | V1 behavior | V3 r3 behavior | Evidence / significance |
|---|---|---|---|
| **P0** Sub-Store | 3 upstream scripts `Core`, `Simple`, `Cron Sync`, `sub.store` hostname; remote subscriptions, management, conversion and scheduled sync | One `Native Offline Subscriptions` stateless parser / local normalizer on reserved `khanh.invalid`; no remote fetch, persistent CRUD, authentication or sync | **Confirmed lost functionality**. If user relied on V1 Sub-Store, V3 cannot be called a drop-in 10in1 replacement. |
| **P0/P1** YouTube source behavior | Upstream dynamic ad classifier with cached field-number and EML allow/deny lists; Player/Watch/Browse/Next/Search/Shorts/Guide/Setting plus optional translations | `youtube-response-r3.js` conservative typed EML and canonical ad tracker detection; Player/Watch/Next/Settings partial; no persistent ad classifier, caption/lyric/Guide parity | **Confirmed algorithm/feature gap**; feed ad miss plausible. Device logs and anonymized synthetic fixture parity are required to attribute a specific visible banner. |
| **P1** YouTube request hook | V1 `youtube.request` matches `browse,next,player,reel/get_watch`, calls same upstream JS at request phase | V3 r3 has **no** `http-request` YouTube script; only response | **Confirmed config gap**, but **runtime benefit unverified**. Do not assume deleting this was a regression without request-fixture evidence. |
| **P1** Config/body size | V1 YouTube `max-size=-1`; binary-body-mode 1; broad response routes include `guide` | V3 `max-size=5242880` and internal 5 MiB guard; does not hook `guide` | Large valid response >5 MiB will not be rewritten by V3 script; **confirmed cap**, but frequency of such responses on device unknown. |
| **P1** YouTube Options | V1 has `argument={"lyricLang":"vi","captionLang":"vi","blockUpload":true,"blockImmersive":true,...}` | V3 r3 has **no** analogous user arguments/caption translation/lyric translation/Guide removal | **Confirmed omissions**; V3 preserves background setting only, does not fabricate V1 download/quality/smart-download settings. |
| **P2** RevenueCat header behavior | `[Header Rewrite]` deletes mixed-case ETags and separate `deleteHeader.js` blanks header | No RevenueCat `header-del` rules, only custom `revenuecat-header.js` blank matching existing key | **Semantically nonidentical**, exact consequence depends on Shadowrocket hook order, HTTP validator behavior and app. |
| **P2** Locket/cross-app scope | V1 upstream `Locket_DuyVinh09.js` maps UA `Locket` to `Gold`, and has fallback `pro` for other UAs (also another mapping case) | V3 filters `/Locket/i` and valid subscriber shape, updates only Locket's `Gold`; no fallback for other apps | **Intentionally narrower/safer**, but not identical to V1 for other RevenueCat consumers; synthetic client status is not a real purchase. |
| **P2** MITM scope | `%APPEND%`, negative Googlevideo redirector exception, `sub.store` | Explicit hostname list, `khanh.invalid`, no `%APPEND%` and no explicit redirector exclusion | **Confirmed config semantics differ**; effect on inherited MITM rules and SSL failures needs device validation. |
| **P2** Spotify response size/runtime | V1 `spotify-proto` uses bundled protobufjs and supports two specific endpoints; `max-size=0` in original profile | V3 independent wire editor, same bootstrap/customize paths, internal 5 MiB cap and POST/status requirement, no third-party runtime library | Most account attribute **keys/values appear aligned** from static inspection, but codecs/unknown fields, body/status contracts and >5 MiB differ; full playback/server permission parity unproven. |
| **P3** SoundCloud config | `SoundCloudGoPlus.js` assigns `plan` and **nine** feature entries | `soundcloud-go.js` generates same plan and nine feature values on valid JSON | **Near-equivalent under synthetic success case**. No verified missing field explaining user reports of ads; endpoint interception, content eligibility, app refresh and server-side ad enforcement remain possible. |
| **P3** Other small JSON apps | Mostly simple static JSON replacement or field edits in upstream JS | Independently written same payload shapes with input checks/fail-open | **High structural similarity** for Alight Motion, PicsArt, Wink, Truecaller, KineMaster, CamScanner, BeautyPlus. Some guards/edge paths deliberately differ; account/server rights not established. |

## Detailed behavioral audit

### A. YouTube — major non-parity, even after R3

**V1 paths:**
- request hook: `/youtubei/v1/(browse|next|player|reel/reel_watch_sequence|get_watch)`
- response hook: `/youtubei/v1/(browse|next|player|search|reel/reel_watch_sequence|guide|account/get_setting|get_watch)`
- same large provider JS script both phases, arguments for Vietnamese captions/lyrics, upload/immersive menu filtering.
- Source at `duyvinh09/Module_IOS/js/youtube.response.js` (currently seen as ~227,066 characters; current Git blob `1c52e039cdba6ebdcc5cec0404814c4aa09a1a33`). Its `Browse` class maintains persisted `whiteNo/blackNo/whiteEml/blackEml` classification, inspects unknown 1KB+ fields for `pagead`, and can call Google Translate for lyrics. `Player` handles ad placements/slots, background and translated captions. `Guide` removes selected upload/immersive/Shorts items. `Setting` adds background/download/quality preferences.

**Actual published V3 r3:**
- ONE response hook: `(player|get_watch|browse|next|search|reel/reel_watch_sequence|account/get_setting)`. `guide` absent and no request hook.
- Source: `native/v3/scripts/youtube-response-r3.js` @ `34aa571c69654590302b5dde757924ecd06c6372`; **do not compare just old `native/v3/build/compat-canary.conf` or `native/v3/scripts/youtube-browse.js`**.
- V3 R3 separately implements typed EML layout marker detection, canonical tracker URL in opaque renderer, selected response status normalization and setting client toggle 151. No persisted ad black/whitelists or dynamic historical classification and no lyric/caption translation. Conservative false-negative preference minimizes ordinary-card deletion at the cost of banners.
- R3 source logs only fixed route/result information when available; not user payloads.
- The R3 wrapper's `input.body=bytes; delete input.bodyBytes` bridges each nested transformer to a `body:Uint8Array` return; **device application of modified binary bytes needs verification**. Do not claim a binary callback bug merely from presence of `bodyBytes` in the original response; wrapper explicitly normalizes it.
- `docs/YOUTUBE_V3_SOURCE_R3.md` explains direct **synthetic differential tests against an immutable upstream oracle** at `34865755c1aee7ba770c1afa364254d8924cfd85`, SHA-256 `5762e310cd546084f172828d827e16b1db36d1677a692c5de4f1a476c3bd89e6`. R2 was reported by user as still showing Home/below-video banners and stopping background audio when locked; R3 addresses several related source-level omissions but **the document expressly says no R3 on-iPhone validation had yet been performed by Codex**.
- Valid traffic skipped by strict max bytes, mismatched response method/status or unknown schema can remain unmodified. Need sanitized diagnostics to distinguish no hook, no body, no matching schema, no recognized ad and edited-but-not-displayed.

**Next test matrix:** V1-vs-R3 same fixtures for Player/Watch/Next/Search, Home typed/opaque banner, Guide, Settings, captions and timed lyrics; invalid/missing method/status; 5MB boundary, compressed/non-arraybuffer body; regular content preserved. Device test active profile and logs using only `KR-YT response-r3` / `KR-YT feed-r3` coarse summary lines, never raw user traffic. Test real on-device audio after lock and Home/recommendation/search independently.

### B. Spotify — high intended parity, independent codec needs verification

V1 upstream `app2smile/rules/js/spotify-json.js` removes explicit `:443` and changes `platform=iphone` to `platform=ipad` on artist/album requests. V3 `native/v2/scripts/spotify-json.js` implements the same rewrites with stricter host/path guard; omits provider's console output.

V1 `spotify-proto.js` contains an embedded protobufjs runtime and JSON schema; it decodes Bootstrap UCS and Customize UCS, then writes a list of Premium-oriented accountAttributes (e.g. `type`, `catalogue`, `ads`, `on-demand`, `offline`, `audio-quality`, `subscription-enddate`, `financial-product`). V3 `spotify-protobuf.js` independently encodes protobuf fields using the observed schema, preserves unknown wire fields and intentionally includes roughly the same attribute map. It refuses non-POST/unknown statuses/oversize/bad binary. **Input validity and wire serialization differ** from the upstream, even if semantic attributes align in successful synthetic cases.

Neither version proves Spotify grants actual Premium playback or offline listening server-side. Compare *decoded semantic values and untouched unknown fields*, not raw bytes alone.

### C. Locket/RevenueCat — deliberate narrowing and cache behavior

V1 `Locket_DuyVinh09.js` contains a `mapping` table with `Locket → Gold` and a second unrelated UA mapping. When UA doesn't match it still synthesizes `pro` for other RevenueCat app traffic. V3 `locket-revenuecat.js` checks UA for Locket, response JSON status/schema, then adds `Gold` only. Thus V3 may be perceived as missing an unrelated RevenueCat app "working in V1", **by design**; its blast radius and risk of cross-app corruption are much smaller.

V1 removes `X-RevenueCat-ETag` in `Header Rewrite` (two case variants) and also blanks it through an upstream request script. V3 only blanks a single first matching key; this is a **different request-header mutation** which can influence cache-validator behavior. Test with safe synthetic request headers and verify actual outgoing wire traffic with consent, not user authentication values.

Do NOT equate either script with the separate *historical AQVPN/Egern one-shot JS*. User-pasted AQVPN code queried `/v1/product_entitlement_mapping` and replaced the entire customer response with dynamic synthetic entitlements; Shadowrocket V1 DuyVinh09 mapping was hard-coded. These are different historical source mechanisms.

### D. SoundCloud — no demonstrated source-field gap

Compared live V1 `js/SoundCloudGoPlus.js` (current blob `a83989e3d0c6925e994a14c09ad34fef4862b046`) to pinned V3 `native/v2/scripts/soundcloud-go.js`:
- Same `plan`: `vendor=apple`, `id=high_tier`, `plan_id=go-plus`, etc.
- Same **nine** `features` and booleans including `offline_sync=true`, `no_audio_ads=true`, `hq_audio=true`, `ads_krux=false`.
- Both JSON-serialize modified parsed object while retaining unrelated top-level keys on success.
- V3 additionally checks HTTP status and valid object shape and fails open rather than throwing.

**Conclusion:** current source comparison reveals no missing SoundCloud feature field that would, by itself, explain ads. Check whether the endpoint is still requested by current SoundCloud app, HTTPS interception works on device, script runs, response is JSON and actual audio ad insertion is server-driven. Do not fabricate a "fix" by randomly rewriting unrelated hosts.

### E. Other seven apps

| App | Upstream V1 reference | Pinned V3 code | Parity finding |
|---|---|---|---|
| Alight Motion | `js/AlightMotion.js` | `native/v2/scripts/alight-motion.js` | Same high-level license JSON and benefits; V3 requires valid parse/status and fails open. |
| PicsArt | `js/PicsArt.js` | `native/v2/scripts/picsart.js` | Similar synthetic response and status 200, HTTP request hook. Requires device check for script response object semantics. |
| Wink | `js/WinkVipCrack.js` | `native/v2/scripts/wink.js` | Same VIP-like `data` payload; V3 **removes obfuscated third-party console/alert behavior**, intentional security/UX improvement. |
| Truecaller | `js/TrueCaller.js` | `native/v2/scripts/truecaller.js` | Same core `subscriptions/status` and `products/apple` and feature inventory. V3 anchors host and returns pass-through for unmatched paths; V1 could serialize undefined on unknown route. |
| KineMaster | `js/Kinemaster.js` | `native/v2/scripts/kinemaster.js` | Same static subscription JSON on valid body; V3 guard means malformed/non-JSON pass-through. |
| CamScanner | `js/camScanner.js` | `native/v2/scripts/camscanner.js` | Same main `psnl_vip_property` and counters, multiple account/feature path handlers in JS; effective V1/V3 *config* regex primarily matches `/purchase/cs/query_prop...`, so source capability on other routes is not proof those routes execute. V3 checks nested schema before editing. |
| BeautyPlus | `js/BeautyPlus.js` | `native/v2/scripts/beautyplus.js` | Same static VIP expiry/points/balance structure on valid JSON; V3 guard/fail-open. |

All are **static/synthetic structural** comparisons; no assertion that current app servers honor the flags, store credits or subscriptions.

### F. Sub-Store — no genuine feature parity

V1 original hooks:
`Sub-Store Core` `sub-store-1.min.js`, `Sub-Store Simple` `sub-store-0.min.js` and `Sub-Store Sync` `cron-sync-artifacts.min.js` from `sub-store-org/Sub-Store/releases/latest`.

V3 replaces these with one static parser/normalizer `native/v3/scripts/offline-subscriptions.js` with no external subscription fetch, persistence, remote backup, sync or cron. Cannot just rename this "Sub-Store" or claim equivalent "10in1". If actual V1 Sub-Store functionality is required, specify a separate project with network/auth/storage/scheduling, isolated security review and careful AGPL license analysis before code reuse. `khanh.invalid` interception and response injection are not yet device-validated.

## What caused the **observed** differences versus what is only inferred?

| Observation | Supported conclusion | Unsupported shortcut |
|---|---|---|
| User earlier saw V3 in-video ads suppressed, background playback functional | At least one earlier V3 config combination worked for those cases | This does not establish R3 is working or which script caused it. |
| User subsequently reported R2 still showing feed banners and audio stopping after lock | R2 failed device acceptance in those scenarios; see `docs/YOUTUBE_V3_RUNTIME_R2.md` | R3 being green in mocks does not prove that iPhone behavior is fixed. |
| V3 SoundCloud ads may continue | Source outputs are nearly equivalent on sample JSON; likely investigate invocation/network/server path | It is not justified to say the first-party JSON payload omitted a known V1 ad flag. |
| Unrelated RevenueCat app may differ | V3 intentionally omits V1 unsafe `pro` fallback | Do not widen mutation to all apps as a default. |
| V1 Sub-Store behaviors missing | Confirmed absence of remote sync/management in V3 | Current local normalizer is NOT a functional replacement. |

## Recommended implementation order for Codex

1. **Freeze branch/ref facts** and check `v3-test` is now R3 (the historical initial V3 canary is no longer the same published URL). Read `docs/YOUTUBE_V3_SOURCE_R3.md` and `docs/YOUTUBE_V3_RUNTIME_R2.md`. Do NOT change production or the test URL under this audit.
2. **P0 Sub-Store scope decision:** ask whether the user actually uses remote Sub-Store management/sync; if yes, isolate as a separately funded/implemented bounded project rather than implying V3 10in1 parity.
3. **P1 YouTube functional triage:** on spare iPhone, refresh pinned R3 config, verify source SHA is downloaded and logs show `KR-YT` lines. Test Home, below-video, Search, Shorts, locked-screen audio and captions. Prioritize runtime body/status/trust and exact typed schema, not broad regex deletion. Add minimal *synthetic* fixture for every observed deviation.
4. **P1 Header/MITM isolation tests:** ascertain whether blanking RevenueCat ETag differs from removing it, and restore external negative MITM exceptions when needed; check overlapping proxy host rules and HTTPS behavior. Never log auth.
5. **P2 Spotify wire semantic test:** compare current V1 upstream to V3 codec on deterministic synthetic Bootstrap/Customize protobuf samples, including unknown fields, status/size variants. Device-check legitimate playback separately.
6. **P2 Locket scopes:** verify intended Locket-only behavior and distinguish historical Egern AQVPN dynamic mapping from V1 Shadowrocket hard-coded mapping; never claim genuine subscriptions.
7. **P3 Regression fixture matrix:** automate JSON semantic parity for SoundCloud and seven small apps; allow documented safety differences. An offline JSON diff does not equate to app-version/device compatibility.
8. Keep CI, pinned first-party JS, optional device diagnostics and rollback. **No merge or repointing production until explicit user authorization and on-device acceptance.**

## Reproduction and links

```sh
git fetch --all
git switch v3-test
python native/v3/build_youtube_r3.py --check
python -m unittest discover -s native/v3/tests -p 'test_*.py' -v
node --test native/v3/tests/*.test.cjs
python native/v3/audit_supply_chain.py
python tools/validate_legacy.py
```

Note: differential tests against the exact third-party YouTube reference may require fetching a **hash-checked** oracle to `/tmp/khanh-youtube-reference.js` (not committing or deploying third-party code). A missing oracle is not a confirmed successful parity check. Review GitHub Actions workflow and current test logs as evidence.

Original current upstream refs:
- `https://github.com/duyvinh09/Module_IOS/blob/main/js/youtube.response.js`
- `https://github.com/duyvinh09/Module_IOS/blob/main/js/SoundCloudGoPlus.js`
- `https://github.com/duyvinh09/Module_IOS/blob/main/js/Locket_DuyVinh09.js`
- `https://github.com/app2smile/rules/blob/master/js/spotify-proto.js`
- `https://github.com/sub-store-org/Sub-Store`

Owned refs:
- `https://github.com/Vcab3011/Khanh-Rocket/blob/v3-test/docs/YOUTUBE_V3_SOURCE_R3.md`
- `https://github.com/Vcab3011/Khanh-Rocket/blob/v3-test/native/v3/scripts/youtube-response-r3.js`
- `https://github.com/Vcab3011/Khanh-Rocket/blob/v3-test/build/khanh-rocket-v3-test.conf`

**Conclusion:** Large true V1→V3 gaps exist in Sub-Store and YouTube's peripheral/dynamic behaviors. For the other apps most field-level rewrites are structurally aligned; real-world mismatches can arise at request matching, headers, MITM, binary/runtime semantics, app updates and server-side validation. The user-requested self-owned script policy is compatible with fixing those gaps, but **full parity cannot be inferred from source similarity**.

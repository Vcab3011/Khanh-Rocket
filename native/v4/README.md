# Khanh Rocket V4 — isolated source-behavior parity implementation

**Status:** DRAFT / device-untested. Built on published `v3-test` **R3** branch, not on the older V3 canary. None of the V4 canaries replace the existing stable `main/build/khanh-rocket.conf` or working `v3-test/build/khanh-rocket-v3-test.conf`.

**Goal:** Approach useful original V1 10in1 behaviors with independently owned, reviewable, commit-pinned source. Preserve known working components; restore only demonstrably missing behaviors; do not reintroduce obfuscated JavaScript, broad RevenueCat fallback, shared MITM certificates, arbitrary remote proxy fetching or undocumented data exports.

## Delivered in this V4 increment

1. **YouTube Guide:** `native/v4/scripts/youtube-guide.js` parses typed binary `Guide` protobuf response, removing exactly `SPunlimited`, `FEuploads` (opt-in default), `FEmusic_immersive` (opt-in default) and optionally `FEshorts` from known menu item paths; preserves unrelated raw wire fields, respects strict byte/field limits, and returns original input on unexpected schema. SHA-pinned JS; no runtime network calls.
2. **YouTube caption metadata:** `native/v4/components/youtube-caption-compat.js`, deterministically bundled into `native/v4/scripts/youtube-response-r4.js` **from the same locked R3 player/feed source** using `native/v4/tools/build_youtube_r4.py`. When opted in for language `vi`, it adds a translated caption-track URL to the existing trusted YouTube `/api/timedtext` base URL if a caption source exists. Works on typed `player` and nested `get_watch` messages; does not issue translation requests, fabricate a translated text response, access accounts, or claim the remote timedtext service always supports that language. If target track exists, no duplicate. If input is not recognized, pass original.
3. **Offline subscription conversion:** `native/v4/scripts/subscriptions-convert.js` implements a deliberately **bounded, stateless local** `https://khanh.invalid/v2/convert` POST JSON API for SS (safe AEAD variants), Trojan (TLS) and VMess (non-legacy) share URI inputs; returns JSON/URI/basic Clash YAML. Rejects unsupported schemes, noncanonical/corrupt input, excessive nodes and unsafe transport options. Does not fetch a URL, schedule sync, store secrets, serve a remote API or supply full Sub-Store. Proxy passwords appear in the requested conversion *result* by design; never save or send converter requests/logs containing real credentials.
4. **JSON app regression:** `native/v4/tests/json-parity.test.cjs` runs first-party pinned V2 scripts on synthetic fixtures for SoundCloud, Locket, Spotify URL, Alight Motion, PicsArt, Wink, Truecaller, KineMaster, CamScanner and BeautyPlus; verifies expected semantics and fail-open cases. This validates source handling, **not** live paid entitlements or server-authorized Premium.
5. **Code assurance:** Node binary/error/safety tests, Python exact config-delta/pin/baseline tests and deterministic R3 caption source builder. No external JS imported at runtime by the new V4 scripts.

## Separate canary URLs

**Guide-only:** 
`https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/v4-source-parity-isolated/native/v4/build/guide-canary.conf`

**Guide + local converter:** 
`https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/v4-source-parity-isolated/native/v4/build/full-canary.conf`

**Guide + Vietnamese caption-track + local converter:** 
`https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/v4-source-parity-isolated/native/v4/build/caption-canary.conf`

Canary URLs are on a *mutable test branch*. Each new V4 script referenced by their profiles is pinned to an immutable **own Git commit**; once device acceptance is obtained, pin and tag the entire profile too. Do **not** import more than one of these three profiles simultaneously on the same tunnel. Snapshot the old working profile before switching. Verify HTTPS decryption is enabled and locally trusted; restrict to necessary hostnames.

### Isolated code pins

- V3 R3 core retained from `34aa571c69654590302b5dde757924ecd06c6372/native/v3/scripts/youtube-response-r3.js`.
- Typed Guide: `2fc7ccf96ec1a3d288a307e411b9249a74b51486/native/v4/scripts/youtube-guide.js`.
- Local converter: `71b3828bae7bedd6022e9428e6ae63926fa23d4f/native/v4/scripts/subscriptions-convert.js`.
- R3-plus-captions bundle: `27c5b4f5c72082bae59f2e91f433dd7a9e5384a0/native/v4/scripts/youtube-response-r4.js`.

All preexisting Spotify, SoundCloud, RevenueCat/Locket, small-app scripts, URL rewrites and MITM hostnames remain *byte-identical to R3 profile* in the guide-only canary. The full converter canary adds exactly one local endpoint handler. The captions canary replaces only R3 YouTube response source with R4 plus one explicit `captionLang=vi` argument.

### Converter contract and limits

```json
{"links":["ss://...","trojan://...","vmess://..."],"output":"json"}
```

Output choices: `json` returns normalized validated records, `uri` returns share URI lines, `clash` produces basic `proxies:` YAML. POST only, Content-Type `application/json`, max input body 131072 chars, max 200 input links, max 8192 chars per link, reject entire request on invalid item; duplicates collapsed. Only intended for the reserved `.invalid` local hook. **The real Shadowrocket routing of the reserved HTTPS hostname is still unverified on an iPhone.** Never use the local converter to ingest secrets on a profile you don't control.

This is **not** Sub-Store API/management/auth/storage/scheduler/cloud sync. No arbitrary `https://provider/... ` or file paths are fetched. That omission is deliberate until there is a reviewed SSRF-resistant fetcher, storage encryption, scoped user auth, rate limits, user opt-in and privacy audit.

## Security and supply-chain design

- No third-party JavaScript downloaded during runtime by V4; raw first-party JS pinned by 40-char Git commit.
- No `fetch`, `$httpClient`, `$task.fetch`, `eval`, `new Function`, external imports, storage or console logging in added Guide/caption/converter scripts.
- Validate exact endpoint and method, payload sizes, protobuf field numbers/length bounds and supported proxy URI protocols. Fail open for intercepted YouTube traffic and return sanitized errors for local converter.
- Guide and caption parser preserve unrecognized protobuf raw bytes and avoid flattening wire-format unknown fields into JSON.
- Use no shared Egern/Shadowrocket CA; do not log Auth headers, receipts, private traffic, video identifiers, proxy secrets.
- CI and static scan reduce risk, **not a formal proof of freedom from malware or vulnerabilities**. A device/security audit remains required.

## Test commands

```bash
python native/v4/tools/build_youtube_r4.py --check
node --test native/v4/tests/*.test.cjs
python -m unittest discover -s native/v4/tests -p 'test_*.py' -v
python tools/validate_legacy.py
# Other V3 suites continue to run in existing Validate Shadowrocket config CI.
```

## Scope remaining for actual V1 10in1 parity

| Feature | V4 state | Required next engineering / device gate |
|---|---|---|
| Player in-video ad suppression/background | Preserved locked R3 algorithm, not yet phone-validated for V4 | Video / lock-screen audio test before any promotion |
| Home/Search/Next dynamic ad blacklist/whitelist | R3 conservative typed ad classification; lacks V1 persistent dynamic lists | Exact sanitized synthetic source-vs-target differential cases with real-device labels; avoid deleting ordinary cards |
| YouTube Guide | Implemented with typed filter, unit-tested | iPhone Guide render and options |
| Caption-track option | Optional typed `vi` timedtext track added when source exists, unit-tested | iPhone checks actual translated subtitle playback & timing, different videos/languages |
| Lyrics translation | **Not implemented**: V1 relied on a third-party translation HTTP call; privacy/consent design needed | User opt-in provider, timeouts, explicit data disclosure; default off |
| Youtube request-phase extra script | Not copied: actual need/benefit not proven | Capture a safe fixture demonstrating needed request mutation |
| Sub-Store Core/Simple/Cron Sync | **Not implemented**; local converter expanded | Independent management service project (auth, encrypted storage, scheduler, remote fetch/SSRF) and AGPL license compliance if code copied |
| Spotify/Locket/SoundCloud/other JSON apps | Existing R3 scripts preserved; fixture test added | App-version/device acceptance, no claim of genuine Premium/server rights |
| Egern One-shot | Different **read-only research lab** from PR #8 | Separate iPhone cache persistence tests, no promise of purchase |

## Device acceptance and rollback

1. Save current user-tested profile URL: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/v3-test/build/khanh-rocket-v3-test.conf`.
2. On a spare iPhone, import **Guide-only** first, not captions. Test Home, Search, Player, Guide and locked-screen audio. If no regressions, try the caption canary.
3. Test caption track with a video already offering subtitles and inspect whether `vi` is available/works. If no translated track exists, failure should not crash playback. Test R3 background and ads again.
4. Do **not** send raw traffic, proxy credentials, receipts or entire Shadowrocket HTTP logs. Use version numbers, coarse `KR-YT` diagnostic counters and sanitized UI observations only.
5. Stop on regression, roll back instantly to the above unchanged V3 URL or original V1 protected baseline.

Historical third-party sources used as analysis references remain attributed to their authors. Sub-Store upstream source is subject to AGPL-3.0 conditions: independently written source here avoids embedding its external runtime, but future code reuse requires licensing review. **No PR is automatically merged.**

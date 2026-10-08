# Deep script review and rewrite plan — Khanh Rocket

Date: 2026-10-08. Baseline production config is **untouched**. This is a static review, not a penetration test or a guarantee of feature parity.

## Source inspection method

Inspected the **complete text** of 10 small app scripts (SoundCloud, Alight Motion, PicsArt, Wink, Truecaller, KineMaster, CamScanner, BeautyPlus, Locket, deleteHeader) and Spotify JSON. Inspected representative logic and security-sensitive call sites of two large bundles (YouTube, Spotify protobuf). Sub-Store's three distribution binaries remain **metadata-only**, not code-audited. Original Git blob IDs are recorded in `reports/THIRD_PARTY_SCRIPT_AUDIT_2026-10-08.md`. No scripts were executed against real accounts or devices.

## Individual findings

| Script | Detailed observation | Concrete defect / concern | Rewrite approach |
| --- | --- | --- | --- |
| Sub-Store Core | Request-facing `sub-store-1.min.js`, `latest` release; ~1.32 MB | Unreviewed executable release, broad `sub.store` route, 120s timeout, mutable artifact | Audit release source and cron/storage/network behavior; pin tested release and verify SHA-256; do not reimplement complex subscription manager without specs |
| Sub-Store Simple | Request-facing `sub-store-0.min.js`, `latest`; ~1.33 MB | Same supply-chain issue; overlapping patterns with Core | Confirm handler precedence, isolate endpoints and pin separately |
| Sub-Store Sync | Scheduled `cron-sync-artifacts.min.js` ~1.28 MB, runs daily with `wake-system=1` | Background execution/network/storage unknown; power and privacy risk | Review cron implementation and disable only in test profile to measure impact |
| YouTube request | 227 KB binary/protobuf bundle is used for request and response hooks | Same URL for both phases; request hook explicitly `engine=jsc` and unlimited body; potential CPU/memory pressure; helper has outbound HTTP capability | Split phase-specific entrypoints after tracing actual call graph; cap payload where safe; test against real protobuf samples; preserve original in production |
| YouTube response | Same bundle; translation URL uses `encodeURIComponent(text)` with Google Translate; helper uses `$task.fetch`/`$httpClient` | Text may leave device if translation path executes; static presence alone cannot establish which user data is transmitted | Trace callers, explicit opt-in for translation, allowlisted destinations, avoid logging sensitive data |
| Spotify JSON | 365 chars; replaces `platform=iphone` with `platform=ipad` and normalizes `com:443` | Global string replacement and unconditional logging; changing URL may affect signatures/cache | Experimental rewrite with endpoint-specific regex, no logs, no mutation if unmatched |
| Spotify protobuf | 71.8 KB bundled protobuf handling Spotify responses; library contains `eval("require")`, `Function(...)` | Runtime dynamic-code path unproven; library makes code review difficult; binary response may change across versions | Separate decoder/transform/encoder and test with non-sensitive fixtures; do not casually replace with JSON parser |
| SoundCloud Go+ | Parses JSON, overwrites `plan` and `features` with hard-coded values | No parsing guard; replaces whole features list and may remove new server fields | Require expected schema, preserve unrelated fields, return unmodified on error; no claim of genuine subscription |
| Alight Motion | Parses response then discards it, replacing full account status/license structure | Unnecessary parse and total replacement can erase account information or warnings | Define explicit response contract; avoid wholesale replacement, validate fields and error responses |
| PicsArt | Does not read original response; emits synthetic purchase object via `$done({response:{body,status:200}})` | **Configured as `http-request`**, despite response-like script output. Request/response hook mismatch is a likely compatibility issue, not proven runtime failure | Verify intended phase and use a correctly typed isolated test hook; never forge real purchase receipts in production |
| Wink | Parses JSON and overwrites `data`; then executes obfuscated-looking suffix after `$done` | Suffix is a popup/console notice path, not demonstrated network exfiltration; extra execution after completion; no schema guard | Remove side-effecting notice/obfuscation in independently reviewed rewrite; fail-open on parse errors |
| Truecaller | Builds full subscription/product responses; switches on URL using `findUrl(regex)` | Branching depends on exact regex; unknown URLs can produce `JSON.stringify(undefined)`; `subscriptions/status` regex may not match all configured paths | Explicit URL matching and guaranteed no-op for unmatched URLs; preserve response status/errors |
| KineMaster | Parses original JSON then discards it; replaces entire subscription object | Unnecessary parse; loss of original fields; hard-coded far-future expiry | Guard schema; avoid wholesale replacement and fake entitlement status |
| CamScanner | Parses JSON; mutates `data` or `data.ar_property` based on URL | Assumes nested objects exist; can throw TypeError on new schema or errors; very large synthetic balance data | Guard every nested path, use scoped handlers and test malformed/error fixtures |
| BeautyPlus | Parses then discards response; writes synthetic VIP and huge point balance | Erases unrelated fields and may misrepresent account state | Preserve schema, avoid invented balances; fail-open |
| Locket/RevenueCat | Reads User-Agent, parses JSON, writes `subscriber.subscriptions` and `entitlements`; adds `Attention` property | **Assumes headers, body, subscriber and nested maps exist**; can throw on API errors. Fallback modifies other RevenueCat clients, not only Locket. Synthetic purchase dates/transaction data are misleading | Restrict to explicitly identified app in test profile, guard nested structures, never log tokens; do not represent synthetic entitlements as genuine purchases |
| deleteHeader | Clears `X-RevenueCat-ETag` in request headers | Mutates header map directly, may add an unnecessary header, overlaps existing `[Header Rewrite]` rules | Experimental idempotent, scoped rewrite, clone header object, do nothing if absent |

## New independently written experimental scripts

1. `experimental/scripts/spotify-platform.js`: narrowly scoped Spotify request URL normalization, no logs, no network, no storage; only changes `platform=iphone` query value.
2. `experimental/scripts/revenuecat-etag.js`: narrowly scoped, idempotent RevenueCat ETag request-header normalization, no network/storage; note that production already has header rewrite rules.
3. `experimental/scripts/response-guard-template.js`: reusable no-op JSON parse/schema guard, explicitly does **not** fabricate purchases, subscriptions, account status, or entitlements.

**These are not drop-in replacements** and are not referenced by `build/khanh-rocket.conf`. A complete parity-preserving rewrite of YouTube/Spotify protobuf/Sub-Store requires fixtures, behavior specs, provenance and device tests. The other premium-response scripts likewise should not be copied into a new production config without verifying expected server contracts and permissions.

## Acceptance gates for any future replacement

- Deterministic tests with normal, missing, malformed, oversized and HTTP error responses.
- No unexpected outbound network calls, persistent identifiers, tokens or sensitive log output.
- URL/host/phase-specific matching and a single `$done` path; preserve original response on error.
- Hash-pinned reviewed dependencies; avoid mutable `main`, `master` and `latest` in a test release.
- Canary profile on a spare device; compare connectivity, performance and app behavior.
- Human approval before modifying the live 10in1 config. Do **not** change baseline fixtures to silence failures.

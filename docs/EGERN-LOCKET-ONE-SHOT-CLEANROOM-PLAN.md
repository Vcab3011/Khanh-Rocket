# Khanh Rocket — Egern One-shot / Shadowrocket V3 Clean-room Design

**Status:** Reverse engineering of the supplied YAML and a user-provided JavaScript listing, with implementation proposal. User-provided JS provenance is NOT independently verified; no claim of permanent Locket Gold or of server-side entitlement changes. **Date:** 2026-10-08.

**Production freeze:** This document must not edit, merge, overwrite or regenerate `main/build/khanh-rocket.conf`. The currently working Shadowrocket V3 test profile at `v3-test/build/khanh-rocket-v3-test.conf` also remains unchanged. Any experimentation must be on separate branches and canaries.

## 1. Mission and product boundaries

Build an auditable, first-party, reproducible iOS traffic-processing project with **two explicitly separated deployments**:
- **Shadowrocket V3:** general compatibility, YouTube, Spotify, application-specific test hooks; maintain pinned JS and working playback/background behavior, independently tested.
- **Egern One-shot Lab:** narrow, Locket-specific, consented instrumentation to determine which subscription-related states persist after Egern is disconnected. Native Egern YAML + ES-module JavaScript; pass through unmodified responses by default. One-shot describes a **manual activation / observation window**, not a mechanism capable of changing the iOS sandbox or making new server-side purchases.

An actual server-side entitlement requires the service/provider to grant it. Locally editing `CustomerInfo` may change what the client temporarily displays and cannot be represented as a valid purchase. Do not promise a durable VPN-free unlock.

## 2. Evidence-based reverse engineering of user-provided 2024 artifact

Artifact: user-supplied `locket 2.yaml`, 27 lines, posted historically alongside a VOZ guide; shared source credited in the post to **lea_qun**. We inspected the YAML and a subsequently **user-provided JavaScript listing claimed to be the original script**. The live remote script remains inaccessible; byte-for-byte provenance and revision are not independently established.

| Evidence | What is confirmed | What is not proven |
|---|---|---|
| `mitm.enabled: true`, `ca_p12: egern.p12`, `ca_passphrase: egern`, `hostnames: [api.revenuecat.com]` | Egern decrypts selected HTTPS traffic using an Egern CA reference | That the provided CA file is safe, unique, or still available |
| Two request `header_rewrites` delete `X-RevenueCat-ETag` case variants | Removes request cache validators for matching `receipts/subscribers` URLs | This alone grants a subscription |
| `http_response` `Locket_Gold_AQVPN`, regex on RevenueCat `receipts` and `subscribers/{id}`, `body_required: true` | Script sees matching response bodies | Whether it verifies User-Agent, edits other apps, leaks credentials, or uses remote calls |
| `script_url: https://download.aqvpn.eu.org/script/apptesters/Locket_Gold.js` | Runtime depends on third-party, mutable code | Whether user-provided JS matches exact historic downloaded bytes is unverified |
| `update_interval: 5` | Egern script-file update interval in seconds | Entitlement refresh or automatic one-shot execution |

External source retrieval attempted; the hosted `Locket_Gold.js` was inaccessible through ordinary public fetch on 2026-10-08. The user **subsequently supplied JavaScript text** corresponding to this technique. Analyze the text as given; the match to the installed historical artifact is still **unverified** because no locally extracted binary with hash is available. Reconcile by exporting the old Egern cache, hashing and comparing the actual file; avoid executing historical code on a primary device.

### 2A. Static reverse engineering of the supplied JavaScript

**Precisely observable operations in the user-provided source:**

1. Reads `$request` and creates an authenticated **second request** to `https://api.revenuecat.com/v1/product_entitlement_mapping` using the intercepted original request's `authorization` and `user-agent` headers, plus `X-Platform: iOS`.
2. Uses `$httpClient.get(options, callback)` to retrieve mapping data, then immediately `JSON.parse(data)`. The returned `error` and `newResponse` parameters are ignored.
3. Constructs an **entire new response object** with `request_date`, `subscriber`, empty purchase maps, a fixed `original_app_user_id`, and hard-coded historical timestamps.
4. Iterates `product_entitlement_mapping` entries; for each `product_identifier` and each entitlement listed in `entitlements`, sets `subscriber.entitlements[entitlement]` and `subscriber.subscriptions[productIdentifier]` to synthetic `PURCHASED` / `app_store` data with far-future `expires_date: 9692-01-01T01:01:01Z`. The outer loop key `entitlementId` is unused.
5. Ends with `body = JSON.stringify(jsonToUpdate); $done({body});`, replacing the **entire** targeted response body. It does **not** preserve real subscriber data or merge only the Gold field.
6. The snippet contains **no local storage API or durable account modification call**. The observed state continuing after Egern is stopped must be explained through client persistence, UI cache, legitimate backend state, or another mechanism, not storage in this JS alone.

**Why dynamic mapping matters:** unlike the current V3 Locket script which hard-codes the `Gold` entitlement, this snippet derives product IDs and entitlement names from a RevenueCat mapping response. That reduces hard-coded assumptions but introduces an extra live API call and potentially modifies every entitlement in the mapping. It does **not** establish that the platform recognizes real purchases.

**Source-level defects and security risks:**

- No response status, `error`, or JSON shape validation; malformed JSON, blocked extra request, or missing `product_entitlement_mapping` can throw before `$done` runs.
- No request method, product bundle, or Locket User-Agent guard inside the supplied JS. The YAML matches a shared RevenueCat domain. Whether upstream Egern routing limits invocation to one app is not proven.
- Takes `Authorization` from live requests; passes it to a *RevenueCat-hosted* mapping endpoint. That is not, by itself, off-site exfiltration, but the third-party script publisher can change code later; the token is sensitive and should never be logged, cached, or sent to other destinations.
- Uses old-style `$httpClient` globals; Egern compatibility layer and error behavior require on-device verification. This does not prove a native Egern ES-module `ctx` implementation.
- Replaces the entire subscriber, drops real purchase history and account metadata; a hard-coded original user ID may conflict with the request account. Far-future expiry and contradictory dates are not genuine App Store transactions and may be rejected by receipt or signature verification.
- No call timeout, fallback on parse failures, correlation with original subscriber account, or privacy-preserving diagnostics. The `body` variable is assigned without declaration, potentially creating a global in non-strict runtimes.
- Client-visible state can persist after a modified response is delivered and cached, but that is a **hypothesis** about the iOS SDK. Restore Purchase may trigger new network responses; it does not prove an actual server-side purchase.

**Clean-room architectural lesson (do not copy the code):** a metadata-discovery adapter can inspect safe non-secret entitlement schema information for a consented diagnostic session. The response pipeline should be **read-only by default**, validate source/status/schema, preserve original bytes, restrict app scope, never synthesize unpurchased entitlements, and separately measure persistence after VPN disconnection.

**Updated provenance:** third-party configuration historically attributed by user to `lea_qun`; exact authorship/licensing of the pasted JavaScript is not independently verified. Record attribution for background research and do not redistribute its source as original Khanh Rocket code.


### The user's observed behavior

User observed that, after Egern was enabled, Locket was opened and Egern was subsequently stopped, some state persisted even after the app was force-closed and reopened. Historical instructions suggest the **Restore Purchase** flow may have been involved; this needs per-device confirmation.

RevenueCat documentation: CustomerInfo is cached across app launches; foreground refresh occurs after around 5 minutes, background refresh after approximately 25 hours and purchases/restores refresh the cache. App-specific behavior and verification policies can override how this is reflected in UI. **Hypothesis H1:** local cached CustomerInfo or other app state. **H2:** app-managed UI state separate from SDK cache. **H3:** server-recognized account state. **H4:** apparent disconnection with traffic still processed. Do not conflate H1/H2 with H3.

Reference: https://www.revenuecat.com/docs/test-and-launch/debugging/caching
Reference: https://www.revenuecat.com/docs/getting-started/restoring-purchases

## 3. Current code inventory

- Shadowrocket V3 source: `native/v2/scripts/locket-revenuecat.js`. Current *experimental* compatibility code modifies RevenueCat subscriber JSON and checks the `Locket` User-Agent. **Do not equate synthetic client-only entitlement with a genuine purchase.**
- Shadowrocket canary: `build/khanh-rocket-v3-test.conf` on `v3-test`.
- An Egern read-only observer branch exists, `feature/egern-locket-one-shot`, with `egern/scripts/locket-cache-probe.js` and `egern/modules/locket-observe.yaml`. Treat as unverified device prototype; do not use as a permanent personal VPN.
- Egern's native API differs from Shadowrocket: `export default async function(ctx)`; headers are `Headers`, response body is a one-shot stream, response scripts return an object to rewrite or nothing to leave unchanged; local storage is `ctx.storage`.
- Egern module YAML is merged into a host config; adding a `scriptings.http_response` handler alone is **not proof** that HTTPS MITM CA and hostname are configured. Avoid bundling a shared P12/passphrase.

References: https://egernapp.com/docs/configuration/scriptings/
https://egernapp.com/docs/javascript-api/
https://egernapp.com/docs/configuration/modules/

## 4. Architecture proposal

```text
                   Khanh Rocket Project / audited GitHub sources
                               |
                       manifest + lockfile
                   (SHA256 + Git commit + CI)
                      /                  \
             Egern module                 Shadowrocket config
        (.yaml + ES module)                 (.conf + native JS)
               |                                  |
      [narrow scoped adapter]                [V3 app hooks]
               |                                  |
         read-only observer                     independent
               |
       normalized local event
  (time, app version, HTTP status, cache flags;
   no account id, URL path, receipt or token)
               |
        One-shot experiment log
               |
      compare device-visible state
        at T0/T+5/T+30/T+24h
```

### Native adapters

Keep shared **pure** helpers for URL classification, response schema validation, event schema and UTF-8 size constraints. Do **not** use a fake claim of full cross-runtime portability: Egern stream handling differs from Shadowrocket `$done` binary mode. Use two separate adapter modules, both unit-tested, and a shared schema with golden fixtures.

### One-shot experiment protocol

1. **Baseline:** note Egern off, network on, Locket closed, account display status, iOS/Locket/Egern versions. Do not collect account identifiers.
2. **Observation-on:** enable only the relevant Egern module and its locally created/trusted HTTPS certificate on a spare device; record an anonymized request count, status code, whether response is parseable JSON, whether Gold field is present, and timestamp. Default to **pass-through**, not forged purchases.
3. **Normal app action:** open Locket, optionally use its legitimate Restore Purchases if already entitled. Record precise user action and change in app UI.
4. **True disconnection:** stop Egern and verify iOS VPN state, not merely icon visibility. Record connectivity.
5. **Persistence tests:** reopen app offline, reopen online immediately, after >= 5 minutes foreground, after reboot, after >=25 hours background; record UI and server-requiring feature outcome separately.
6. **Isolation checks:** unrelated RevenueCat app request untouched; no leaked identifiers; uninstall module removes observer behavior.
7. **Decision:** if status disappears after refresh, conclude client cache/transient display. If server-only features work, investigate independent backend/valid store receipt with the user's account. No assumption of durable Gold.

Event schema allowlist only: `{v, observedAt, platform, appVersion?, statusCode, responseFormat, goldFieldPresent, expiryFieldPresent, source:"observed", vpnConnected}`; no receipt, subscriber URL, User-Agent raw string, purchase token, personal account ID. Cap retention to 24 hours; explicit reset/clear.

## 5. Supply-chain and privacy policy

- Egern/Shadowrocket scripts served **only** from `Vcab3011/Khanh-Rocket/<full-commit-sha>/...`, not external updater, `latest`, `main` or mutable third-party URLs. Audited pinned source and manifest hash; CI checks references.
- Do not fetch, run or redistribute historic `Locket_Gold.js` during runtime; do not include the pasted third-party source in first-party runtime bundles; record historical credit **lea_qun** for analysis of the supplied third-party configuration, without claiming authorship of clean-room code.
- Never embed a shared `egern.p12` or fixed global CA passphrase. Each device creates its own CA in Egern, with explicit per-device trust and scope-limited MITM.
- Do not transmit or persist App Store receipts, RevenueCat API keys, authorizations, app-user IDs, email addresses or raw HTTPS payloads.
- Strict pass-through on non-Locket User-Agent, unknown paths, malformed body, non-200 status, oversized body or missing certificate.
- Fail open for response rewrites; only minimal metadata persists, use `ctx.storage.delete` for reset.
- Separate code-review roles, CODEOWNERS, no auto-merge, CI supply-chain audit, offline tests and device gate.

## 6. Implementation roadmap and acceptance criteria

| Phase | Scope and deliverable | Go/no-go gate |
|---|---|---|
| **P0 Evidence + provenance verification** | Compare user-supplied JS against Egern's cached file if accessible; record cryptographic SHA256, original URL, license and source confidence; document mapped entitlements and error handling | No false statements about missing JS; sensitive content redacted |
| **P1 Protocol model** | Document observed RevenueCat paths, request methods, content-types, ETag / 304, JSON schema variations and end-to-end flow | Synthetic fixture suite, unknown-field preservation, no real credentials |
| **P2 Egern MVP** | Complete native `egern/modules/locket-observe.yaml`, read-only `locket-cache-probe.js`, status widget, manual test instructions | YAML schema validation, Node ES-module tests, no interception of unrelated apps |
| **P3 One-shot test controller** | Recording of user-initiated T0/T+5/T+30/T+24h observations, strict local TTL & reset; docs for VPN-off verification | At least 2 devices, offline/online/restart matrix; no collection of PII |
| **P4 Shared core + Shadowrocket parity** | Shared pure matcher/validator/event logic, two independently tested adapters; do not touch confirmed working YouTube behavior | Baseline byte-for-byte unchanged; regression tests across both runtimes |
| **P5 Controlled compatibility research** | Analyze client-state vs backend-state behavior without representing local edits as legitimate purchases; device matrix, failure recovery | Independent reviewer + consent, reliability data, rollback validated |
| **P6 Release decision** | Versioned pinned Egern module and separate pinned Shadowrocket config; changelog, CI badge, clear experimental labels | CI all green, device tests, security review, manual approval before production |

Priority order: P0/P1 -> P2 -> P3 -> P4/P5 -> P6. The user-provided JS supports a concrete static analysis, but device/cache provenance is still an open P0 check.

### Tests to implement

- YAML parses with Egern-supported keys; all regex patterns compile and anchor hosts; no wildcard MITM.
- Request path and method match exactly; User-Agent `Locket` sensitivity tested with false positives.
- `200 JSON`, `304`, `4xx/5xx`, compressed/no content, malformed JSON, >256 KiB, response body stream consumed once.
- Verify unchanged output by default; no subscriptions inserted; non-Locket RevenueCat requests not read.
- Unit tests run in Node against mock Egern `ctx` (Headers, one-shot text(), storage). Device-only behavior explicitly labeled.
- Pin SHA and verify source blob hashes; reject unexpected `ctx.http` / eval / network API and insecure shared certificates.
- Data retention expiry and manual purge, service endpoints and token redaction in all test logs.

## 7. Questions and risks

- The user-provided JS listing reveals a concrete dynamic product-entitlement-mapping and whole-subscriber-response replacement algorithm; **its byte-for-byte identity to the historic external file is unverified** until the cached script can be extracted and compared.
- Client-side cache persistence does not imply backend authorization, payment or durable Gold. RevenueCat may refresh on app foreground and restore.
- Script that consumes `ctx.response.text()` must return original body when no modification is intended, because the stream is one-shot. Ensure exact headers/status/body preservation in Egern device tests.
- `header_rewrites` on the supplied artifact may be broad for all apps using RevenueCat, so don't deploy globally without scoping tests.
- A profile can be valid YAML but fail Egern runtime because of module import, certificate trust or script API differences. CI is necessary but insufficient.

## 8. Release boundaries and stable rollback

- **Unchanged production main:** `build/khanh-rocket.conf` at commit `88dbcb4751cc649592f292811b65acb4bed8837b`.
- **Unchanged working Shadowrocket V3 Test:** `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/v3-test/build/khanh-rocket-v3-test.conf`.
- **Existing Egern experimental observer (not yet iPhone validated):** `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/egern-locket-one-shot/egern/modules/locket-observe.yaml`.
- All new development through feature branches and draft PRs only; never auto-merge or repoint the existing stable URL.

**Do not interpret an observation of Gold in the client UI as an authoritative server-side subscription.**

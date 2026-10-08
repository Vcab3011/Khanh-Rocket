# Khanh Rocket Multi-App Lab v1 — Egern native and Shadowrocket V3 separation

**Status: experimental device lab, not a Premium activation tool.** Implemented on a separate feature branch; does not edit or merge working Shadowrocket V3 or main 10in1.

## Purpose

Evaluate which client-visible conditions survive after Egern is disconnected, starting with Locket and extending to SoundCloud/YouTube. Classify response families by app, not by a universal "premium" flag. Read responses **without modifying purchase state or feature flags**, and store only safe aggregate metadata. This enables a clean-room compatibility architecture for future apps, not a claim that server-side subscriptions can be unlocked offline.

## Source of mechanism claims

1. **Original user-submitted Egern YAML:** MITM for `api.revenuecat.com`, request header deletion for the RevenueCat ETag, `http_response` handler pointing at an external `Locket_Gold.js`. The script file itself was not present in the YAML.
2. **JavaScript pasted later by user:** Reads `authorization` and User-Agent, makes a second authenticated request to `/v1/product_entitlement_mapping`, loops through every product and entitlement, then **replaces the whole customer-response JSON** with far-future synthetic subscriptions. This is the documented behavior of the pasted code; byte identity against the historical installed bundle is **unverified**. Its algorithm is not included in this new implementation.
3. **Current Khanh Rocket V2/V3 source**: Locket responds to RevenueCat `subscribers/receipts` JSON; SoundCloud uses `api-mobile.soundcloud.com/configuration/ios` configuration JSON; YouTube uses binary protobuf `youtubei.googleapis.com/youtubei/v1/{player,browse,next,search,get_watch,reel/reel_watch_sequence}`.
4. **Official RevenueCat**: CustomerInfo persists between app launches and may be refreshed after ~5 minutes foreground, ~25 hours background, and purchase/restore. See https://www.revenuecat.com/docs/test-and-launch/debugging/caching and https://www.revenuecat.com/docs/getting-started/restoring-purchases .
5. **Official Egern APIs**: Scripts use native `export default async function(ctx)`, response bodies are **single-consumption streams**, generic scripts can return widgets, and modules are YAML. See https://egernapp.com/docs/javascript-api/ and https://egernapp.com/docs/configuration/scriptings/ .

## Mechanism matrix (avoid false equivalence)

| App | Protocol/endpoint | What V3 currently attempts | One-shot expectation and limit |
|---|---|---|---|
| Locket | RevenueCat REST JSON, CustomerInfo/entitlements | V2 Locket script currently modifies client JSON in the independent Shadowrocket **compatibility canary** | SDK caching may persist after app relaunch, but server-side entitlement does not follow from a modified response. Lab records presence only. |
| SoundCloud | JSON `configuration/ios` | V2 SoundCloud script currently changes `plan` and several `features` keys | Config flags can be cached for a session, but playback/download restrictions may involve server. No permanent one-shot guarantee. |
| YouTube | InnerTube protobuf for player, watch, browse, next, search, Shorts; some URL rewrite/UDP rules | V3 processes player/background and filters ad structures | Ads/feeds are returned with subsequent requests; initial One-shot cannot guarantee ad-free new feeds/videos after disconnect. Lab observes endpoint/status only, never modifies protobuf. |
| Other apps | RevenueCat, first-party JSON, GraphQL, protobuf, or signed/server-only | Not yet implemented | Require a new explicit app adapter, synthetic fixtures and device behavior evidence. Avoid blanket matching all RevenueCat consumers. |

## Egern test modules (install individually)

The lab ships five *separately installable* modules:

| URL path on this branch | Function | MITM |
|---|---|---|
| `lab/modules/egern-locket-observe.yaml` | Read-only Locket CustomerInfo summary | `api.revenuecat.com` only |
| `lab/modules/egern-soundcloud-observe.yaml` | Read-only SoundCloud plan/flag counts | `api-mobile.soundcloud.com` only |
| `lab/modules/egern-youtube-observe.yaml` | YouTube InnerTube endpoint counts **without reading protobuf** | `youtubei.googleapis.com` only |
| `lab/modules/egern-observe-status.yaml` | Manual local status widget | No MITM |
| `lab/modules/egern-observe-reset.yaml` | Manual purge of stored metadata | No MITM |

Example URL for Locket observer:
`https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/multiapp-observability-v1/lab/modules/egern-locket-observe.yaml`

**Install only one app observer first**, plus status module if needed. Modules merely add hooks; they do not configure proxy nodes. Create and trust your own unique Egern CA certificate on the device, not a shared downloadable `egern.p12`. HTTP interception is sensitive: turn it off after the controlled session. Every observer Egern script is pinned to an immutable first-party commit.

**Do not run Egern and Shadowrocket tunnel simultaneously as the same test path.** Leave the working Shadowrocket V3 Test profile alone:
`https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/v3-test/build/khanh-rocket-v3-test.conf`

### What is recorded

Only:
- An anonymized application family (`locket`, `soundcloud`, `youtube`);
- An endpoint class (e.g. `customer-info`, `feature-config`, `player`, `browse`);
- HTTP status and observation time;
- Presence of `Gold` entitlement (not whether it is verified/paid) and count of entitlements in response;
- Count of SoundCloud features and enabled flags; mapping counts if ever observed;
- Parse/error class.

Never persist request URL, account ID, User-Agent, authorization, receipt, JWT, response body, song/video details, original subscriber JSON or product names. Maximum 32 local events, 24-hour sliding TTL, no outbound logging/telemetry. Manually clear by running the reset module. **The experimental feature does not and cannot certify legitimate purchases.**

The Egern adapter reads only HTTP 200 JSON bodies with absent/identity Content-Encoding and returns the original **bytes** in `{body}` even if diagnostics or storage throws. Encoded bodies (gzip/br/deflate), non-JSON MIME types, missing bodies, non-200 statuses and YouTube protobuf are left unread. A declared Content-Length above 256 KiB is skipped before reading; an unexpectedly larger stream is restored without decoding. Invalid UTF-8 is reported without silently replacing characters. This preserves the byte representation made available by Egern, although **header/compression interoperability and real device behavior are not yet validated**. A rejected stream read cannot be reconstructed when the runtime supplies no bytes.

Only documented v1 RevenueCat GET subscribers / POST receipts and GET mapping routes are classified; SoundCloud requires GET and YouTube requires POST. Locket must be the first User-Agent token (`Locket/…` or `Locket …`). This deliberately rejects ambiguous identities and unknown API versions; User-Agent is a routing hint, not authenticated app identity. Status/outcome/signal enums and app-specific metric keys are allowlisted, including when reading old local history.

The widget shows last capture, `bodyUnavailable` and `schemaDrift` counts **within retained history**, plus manual experiment checkpoints. These are diagnostic outcomes, not entitlement validity or lifetime request totals. An empty/changed SoundCloud plan/features schema is reported as schema drift. No arbitrary notes or VPN-off claims are saved by scripts.

### One-shot experiment checklist

Record visible states (e.g. normal vs Gold display) manually, in a local note *without recording identifiers*:

1. Before starting: Egern off; close Locket; record app/OS version and UI status.
2. Enable only Locket observer and Egern VPN. Open Locket and review the status widget. For your own valid purchases, the app's Restore Purchases may cause RevenueCat to refresh CustomerInfo; do not automatically trigger restore by a script.
3. Disconnect Egern using Stop, then confirm the actual iOS VPN connection is OFF, not merely that its icon is hidden.
4. Open Locket offline after force close. Record whether state persisted.
5. Connect to normal Internet with Egern still OFF, reopen immediately and after 5/30 minutes.
6. Restart the iPhone and check again. After 24-25 hours background, repeat. Distinguish **UI presentation**, **local app features**, and **server-verified operations**.
7. Compare only timestamp/count/presence metadata from the status widget. It cannot observe fresh network events after Egern is off. Run reset module to clear local records.

A visible Gold badge after VPN disconnection could reflect app cache, UI state or valid backend entitlement; it does **not** establish which without more evidence.

## Architecture and extension contract

- `lab/core/observer-core.js`: pure dependency-free app route registry, schema-limited inspectors, allowlisted event sanitizer, 24h/32-event retention, summary.
- `lab/runtime/egern-observer.template.js`: Egern native adapter (single stream read; byte restoration; `ctx.storage` only).
- `lab/runtime/egern-status.template.js`: optional generic widget.
- `lab/tools/build_runtime.py`: deterministic offline generation for observer/status/reset; bundle core into stand-alone JS. No runtime imports from third-party packages.
- `lab/build/`: generated audited JS with pinned commit URL in module YAML.
- `lab/tests/`: fake synthetic app/API fixtures, malicious-URL and privacy checks; no real receipts required.
- Shadowrocket V3 production or canary scripts are **not modified** by this lab. A future optional read-only Shadowrocket diagnostics adapter can reuse the pure core but must have independent tests for `$done`, `bodyBytes` and storage.

Adding a fourth app requires a narrowly anchored host/path classifier, explicit content format, pure validated inspector returning only aggregate metadata, bounded tests for errors/large bodies and a separate opt-in Egern module. No generic RevenueCat wildcard or unknown script publisher.

## Tests and acceptance gates

```sh
python -m pip install PyYAML==6.0.2
node --test lab/tests/*.test.cjs
python -m unittest discover -s lab/tests -p "test_*.py" -v
python lab/tools/build_runtime.py --check
python tools/validate_legacy.py
python native/v3/audit_supply_chain.py
```

Automated tests validate code and module structural syntax; they cannot prove Egern's runtime MITM behavior. Keep Egern source and features isolated until primary functions have been verified on a spare iPhone. No merges into production without explicit user approval.

## P1 runtime evidence and remaining debt

Official API/configuration documentation rechecked on 2026-10-08: [JavaScript API](https://egernapp.com/docs/javascript-api/), [Scriptings](https://egernapp.com/docs/configuration/scriptings/), [Modules](https://egernapp.com/docs/configuration/modules/). The documented contract supports one-shot `arrayBuffer()`, case-insensitive `Headers.get`, synchronous `getJSON/setJSON/delete`, `Uint8Array` response bodies with omitted fields unchanged, and generic widget returns. `max_size` limits bodies supplied to scripts; `binary_body` enables binary handling. No documentation guarantee was found for wire-level decompression/recompression or timeout rollback after consumption.

Tests cover both minimal synthetic contexts and Node's real Fetch `Response`/`Headers`. Neither executes Egern's JavaScript engine. Before a spare-device pilot, verify module import, binary return behavior, status/Content-Type/Content-Length/Content-Encoding, missing/max-size body behavior, response timing, and widget rendering on the exact Egern version. Keep the existing Shadowrocket V3 profile and its YouTube player pin unchanged.

Remaining debt: shared local storage updates are read/append/write without documented atomic transactions, so concurrent captures can lose a metadata event; 32-event history is diagnostic sampling, not complete traffic accounting. Product mapping is a pure classifier but is not hooked by the current Locket module. Automatic experiment scheduling, backend entitlement verification, arbitrary app adapters and production promotion remain outside this patch.

## Attribution

Historical `locket.yaml` was shared with credit to `lea_qun` according to the supplied VOZ post. This project independently implements **read-only diagnostic code**, not a copy of that proprietary script. Its exact licensing and binary identity are not established.

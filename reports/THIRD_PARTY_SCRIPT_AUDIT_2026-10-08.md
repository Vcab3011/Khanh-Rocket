# Third-party JavaScript audit — Khanh Rocket 10in1

Date: 2026-10-08. Scope: `build/khanh-rocket.conf` at `main` commit `88dbcb4751cc649592f292811b65acb4bed8837b`.

## Method and assurance

Read-only source inspection of **13 distinct GitHub-hosted JS source files** referenced by the 17 configured script declarations, plus GitHub release metadata for three Sub-Store JS assets. Reviewed source sizes, embedded URLs, request/response manipulation, HTTP client and dynamic-code indicators. The three Sub-Store release binaries were **not downloaded, deminified, executed, or behaviorally audited**. The large YouTube/Spotify bundles received targeted string/code-path inspection, **not** complete data-flow review. No dynamic packet capture or app-level validation was performed. **No proof of absence of exfiltration or malicious behavior.**

The 17 declarations resolve to 13 distinct script URLs plus 3 Sub-Store release asset URLs (16 distinct URLs). YouTube request and response share one script URL. The file references GitHub branches (`main`, `master`, `refs/heads/main`) and Sub-Store `releases/latest`, not immutable version-pinned URLs.

## Risk findings (severity is operational, not a claim of maliciousness)

| Priority | Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- |
| HIGH | Mutable remote JavaScript and latest release references | All script paths in the 10in1 file use branch names or Sub-Store `latest` | Upstream code can change without a Khanh Rocket commit; trusted MITM allows code to process intercepted responses | Test vetted immutable commit/release asset URLs **in a separate profile**; record hashes; never silently swap production |
| HIGH | Broad HTTPS interception | MITM list includes YouTube/Googlevideo, RevenueCat, Spotify, Sub-Store and multiple app APIs | Decrypted app content can be processed by configured interception scripts; certificate trust increases exposure | Narrow scope in a test profile, only after functional regression tests; disable when unnecessary |
| HIGH | Large unreviewed Sub-Store distribution | `sub-store-1.min.js` 1,317,487 B, `sub-store-0.min.js` 1,328,504 B, `cron-sync-artifacts.min.js` 1,279,377 B in release 2.42.3 (2026-10-06) | Cron job and request handlers are a large unreviewed execution surface | Obtain and audit release source/bundles, provenance, network destinations and scheduled behavior before declaring safe |
| MEDIUM-HIGH | YouTube bundle contains outbound HTTP capability | `youtube.response.js` 227,066 chars; includes `$task.fetch`, `$httpClient` and a Google Translate URL constructed from encoded input | Content may be sent to a translation endpoint when translation path executes; exact runtime activation/data sensitivity unverified | Inspect call sites, default flags and outbound destinations; restrict test traffic; no unsupported exfiltration claim |
| MEDIUM-HIGH | Spotify bundle includes dynamic-code indicators | `spotify-proto.js` 71,842 chars; contains `eval("require")` and `Function(...)` in bundled protobuf/library code | Expands review complexity; text matches do not prove malicious dynamic execution | Audit call graph and runtime paths; test app-version compatibility |
| MEDIUM | Subscription response manipulation | Locket modifies RevenueCat entitlements/subscriptions, KineMaster/BeautyPlus replace status JSON; other app scripts similar | Can misrepresent account state locally; app may reject server-side; compatibility can break | Keep tests scoped, avoid real account/session data in logs; do not claim genuine entitlement |
| MEDIUM | Wink script contains obfuscation-like suffix | `WinkVipCrack.js` has `_0xcbd8x...` identifiers after JSON rewrite and an obfuscator reference string | Obscures review; reference URL in code is not proof of a network request | Deobfuscate and inspect control flow in isolation |
| MEDIUM | Fragile JSON parsing and wholesale replacement | Multiple scripts use `JSON.parse($response.body)` without visible guards and overwrite full JSON objects | Malformed or changed upstream response can break features or crash a script | Prototype schema guards and fail-open behavior in a separate profile |
| LOW-MEDIUM | Header modification on RevenueCat | `deleteHeader.js` changes `X-RevenueCat-ETag`; config also deletes cache headers | Changes caching semantics and response processing | Regression-test API behavior; do not change live rules without evidence |

## File-by-file targeted inventory

| Script | Git blob SHA | Observed behavior / review notes |
| --- | --- | --- |
| `duyvinh09/Module_IOS/js/youtube.response.js` | `1c52e039cdba6ebdcc5cec0404814c4aa09a1a33` | 227,066 chars; binary/protobuf-oriented bundle, HTTP helper and Google Translate URL. Request and response hooks point to same file. Targeted review only. |
| `app2smile/rules/js/spotify-json.js` | `61f87453d70e28f83a83a4e00f9780e0a61e2a55` | 365 chars; modifies request URL platform marker iPhone → iPad. |
| `app2smile/rules/js/spotify-proto.js` | `1815250ece304e6808bce768573a3e9c6999a295` | 71,842 chars; protobuf bundle; dynamic-code strings; Spotify response handling. Targeted review only. |
| `duyvinh09/Module_IOS/js/SoundCloudGoPlus.js` | `a83989e3d0c6925e994a14c09ad34fef4862b046` | 1,355 chars; replaces plan/features with Go+ values. |
| `duyvinh09/Module_IOS/js/AlightMotion.js` | `8818d74e4a95aa2db6c374a562f9214b4098a4a6` | 1,138 chars; replaces account license result. |
| `duyvinh09/Module_IOS/js/PicsArt.js` | `9fb0bc7a90610a18316290d7d257aae4b0662f87` | 1,326 chars; supplies synthetic subscription purchase response. |
| `duyvinh09/Module_IOS/js/WinkVipCrack.js` | `46e5619ad7791c743c3078b33648dfe7afae3800` | 2,067 chars; overwrites VIP fields, contains obfuscation-like suffix. |
| `duyvinh09/Module_IOS/js/TrueCaller.js` | `bba27b5c40978280df4757df1e4f727d7281ec26` | 4,008 chars; constructs feature/subscription response by request URL. |
| `duyvinh09/Module_IOS/js/Kinemaster.js` | `676eb353ff4a4895d037f816fc0179d2b9a7ab1f` | 314 chars; replaces subscription validity JSON. |
| `duyvinh09/Module_IOS/js/camScanner.js` | `6400fe02668a5ad8eceedef218e0cfcdc80dd58b` | 4,738 chars; modifies purchase/privilege response based on request URL. |
| `duyvinh09/Module_IOS/js/BeautyPlus.js` | `58d4c94a361b4a5f6bffe378e4dcc581ed097b43` | 328 chars; synthetic VIP/balance JSON. |
| `duyvinh09/Module_IOS/js/Locket_DuyVinh09.js` | `d1cf77eb6f57b30f824a4fbd775a6fb35f456abe` | 1,732 chars; reads User-Agent and RevenueCat JSON; writes subscription and entitlement values. |
| `duyvinh09/Module_IOS/js/deleteHeader.js` | `e22d9a844518eef43586633011f935ccfd8c8dad` | 356 chars; sets RevenueCat ETag request header empty. |

## Sub-Store release metadata — not a code audit

GitHub `sub-store-org/Sub-Store` latest release `2.42.3`, published 2026-10-06. API-reported asset SHA-256 digests (not independently recalculated):

- `sub-store-1.min.js`: `1848fa8991d2a59bc916e7a8677ddcbf28be05314e6eae946602843fc73b84aa`
- `sub-store-0.min.js`: `526e5d56a296ceab860345628ec7e569ccb1d5a4d679d892e229947ad2d0c482`
- `cron-sync-artifacts.min.js`: `8f215f6027d79ccad692db7700ec7d4d3a92a47a15271a19a09fcf0e58abd360`

These digests are **release metadata**, not proof that the device executed those exact bytes.

## Source provenance

- Khanh Rocket profile: `https://github.com/Vcab3011/Khanh-Rocket/blob/88dbcb4751cc649592f292811b65acb4bed8837b/build/khanh-rocket.conf`
- Module_IOS commit observed: `5502a6febe84b7db635d3bd31749731aed5c057b`
- app2smile/rules commit observed: `df6366a7024e0b3f0aa3510c5b791eea6f3cba89`
- Sub-Store releases: `https://github.com/sub-store-org/Sub-Store/releases/tag/2.42.3`
- app2smile compatibility reports: `https://github.com/app2smile/rules/issues/274`, `https://github.com/app2smile/rules/issues/268`

## Recommended next actions

1. **No live changes:** retain working profile, baseline snapshot and immutable recovery URL.
2. Download and independently verify the three Sub-Store release bundles; inspect network, filesystem/storage and scheduled execution paths.
3. Review YouTube translation call sites and Spotify protobuf code paths, then Wink suffix; document outbound destinations and sensitive data exposure.
4. Produce a **separate canary profile** with reviewed, immutable script URLs and only necessary MITM hosts. Test YouTube, Locket and normal browsing on a spare device.
5. Introduce release approval gates and rollback on any functional regression. Static analysis alone cannot guarantee runtime behavior.

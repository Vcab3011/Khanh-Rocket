# V4 Security and Trust Review

**Scope:** new Guide filter, R3-composed caption metadata adapter, local proxy conversion, associated configs and tests. Review is **source-based**, with 35 passing Node tests and 6 passing Python assertions at latest CI; no independent penetration test, fuzzing campaign, or real iOS compatibility validation. Do not label as vulnerability-free.

## Trust boundaries

| Boundary | Controls implemented | Residual risk |
|---|---|---|
| Public GitHub URL -> Shadowrocket script | All new JavaScript is first-party and pinned to immutable 40-char git commit; deterministic R4 builder verifies SHA-256 of original first-party R3 source before reuse | GitHub delivery availability, app remote download integrity and Git account compromise; script SHA is referenced, not verified by Shadowrocket binary at install time |
| Proxy/VPN TLS inspection -> application data | Existing narrow MITM hostnames; no new broad host access; no shared trusted CA in V4 configs | The device's own trusted root CA is a sensitive security permission. Users must verify and revoke trust on uninstall |
| HTTP response -> protobuf codec | Typed field numbers; bounds for response size/field count/work; unknown wire bytes preserved; fail-open on nonmatching schema | Schema drift, compression, noncanonical protobuf, app-level signature verification |
| Local proxy URI -> formatter | Strict parse, AEAD SS only, Trojan TLS only, modern VMess; 200-item/128KiB upper bounds; all-or-nothing failures | Output includes expected proxy credentials; cannot be safely posted to a bug tracker or public chat. Local reserved hostname interception has not been proven on device |
| User's subscription/account -> entitlement script | V4 adds **no** new entitlement or purchase spoofing script; existing V3 compatibility hooks remain unmodified | Existing V3 Locket/Spotify/other app simulation is not real server-side authorization; no official purchase/status claim |
| Third-party source -> clean-room implementation | Public originals used only to understand wire fields and existing behavior. No Sub-Store release JS or original YouTube bundle copied into runtime | Upstream licensing of future copied code must be reviewed, especially AGPL-3.0 Sub-Store. Static similarity is not proof of functional parity |

## Code and CI checks

- `native/v4/tools/build_youtube_r4.py --check` requires exact SHA-256 of R3 input and deterministic generated R4 output; no arbitrary network download.
- `native/v4/tests/youtube-guide.test.cjs`: typed binary fixture, unknown raw field retention, option behavior, status/method/host false positives, bounds.
- `native/v4/tests/youtube-caption-r4.test.cjs`: trusted timedtext origin, never duplicates tracks, get_watch nested response, opt-out, errors.
- `native/v4/tests/subscriptions-convert.test.cjs`: SS/Trojan/VMess canonicalization, dedup, Clash YAML, invalid schemes/params/methods, no remote input fetching.
- `native/v4/tests/json-parity.test.cjs`: synthetic first-party regression outputs for SoundCloud, Spotify URL, Locket and other JSON apps.
- `native/v4/tests/fuzz-security.test.cjs`: fixed-seed malformed protobuf and invalid scheme inputs, bounded VM, generic non-leaking errors.
- `native/v4/tests/test_guide_canary.py`: exact source SHA/profile-delta tests, original main and V3 Test blob hashes, no production modifications.
- `.github/workflows/v4-parity.yml` plus original V3 baseline validation CI.

## What V4 cannot guarantee

1. No static scan can prove the **absence** of malicious behavior/vulnerabilities in all transitive code or iOS interception engines.
2. A passing simulated `$done({body:Uint8Array})` path cannot prove Shadowrocket returns the correct content to current YouTube iOS versions.
3. Returning a translated timedtext URL is not guaranteed to make caption translations render. This feature is not an offline translator.
4. Running code on an actual logged-in iPhone with HTTPS MITM presents privacy and account integrity risk. Do not send real Authorization headers, receipts, billing records, proxy node passwords or raw video query URLs to CI or chat.
5. Unknown current app API formats may not match source-derived fixtures. Fail-open and user-controlled rollback must remain.
6. This update does not implement full Sub-Store remote fetch/auth/storage/cron and cannot promise universal app Premium entitlement or a one-shot VPN-off mode.

## Deployment approval gate

- Green static and VM tests + pinned source validation.
- Independent source review and security sign-off.
- Spare-device import/CA, HTTPS response, legitimate playback/menu/subtitle behavior, reset/uninstall and rollback testing.
- User explicitly approves a specific stable profile; **never rewrite protected `main/build/khanh-rocket.conf` or working `v3-test/build/khanh-rocket-v3-test.conf` under a general enhancement request**.

# Gấu Apple 10in1 — static audit (Phase 1)

Reviewed 2026-10-08. **Not a forensic or dynamic audit.** Sources were read, not executed; iPhone behavior has not been validated.

## Provenance

- Original configuration: https://raw.githubusercontent.com/Gaucuto/ver2promax/refs/heads/main/10in1
- Observed upstream commit: `70a1343587324ff5a17195d8847ce55001f9ed44`
- Other observed commits: `duyvinh09/Module_IOS` = `5502a6febe84b7db635d3bd31749731aed5c057b`, `app2smile/rules` = `df6366a7024e0b3f0aa3510c5b791eea6f3cba89`.
- Three Sub-Store `latest` release binaries were not inspected; metadata showed version 2.42.3 published 2026-10-06. These are large, mutable runtime dependencies.

## Config characteristics

| Component | Observed |
| --- | --- |
| Rules | 2 UDP rejects for YouTube/Googlevideo |
| Header Rewrite | 3 header modifications |
| URL Rewrite | 5 rewrites, mostly YouTube-related |
| Script | 17 entries; 13 distinct non-Sub-Store JS files read statically |
| Map Local | 1 synthetic playback response |
| MITM | 18 explicit hostname patterns |
| Proxy nodes or proxy groups | 0 |

## Technical findings

- **Subscription-state spoofing:** Locket/RevenueCat, SoundCloud, Alight Motion, PicsArt, Truecaller, KineMaster, CamScanner, BeautyPlus and others modify response JSON, expiry, feature and entitlement fields. This does not grant genuine server-side authorization. All disabled.
- **YouTube:** ~227 KB JS bundle, HTTP client helper and Google Translate endpoint string; outbound content and actual runtime paths not verified.
- **Spotify:** Small script rewrites platform marker from iPhone to iPad. Larger ~72 KB protobuf bundle includes textual `eval` / `Function` references; their presence is a review signal, not proof of compromise.
- **Wink:** Contains obfuscation-like code, hindering review.
- **Sub-Store:** Three large JS release assets, two request-facing and one sync job, were not fetched or code-audited; do not enable without content review.
- **Supply chain:** URLs pointing to mutable branches or `latest` releases can execute changed code later without a local configuration change.
- **HTTPS decryption:** An installed trusted CA plus matching MITM hostname permits Shadowrocket to handle sensitive decrypted content. No third-party CA or MITM is enabled in Khanh Rocket baseline.

## Decision record

1. Route via DIRECT/PROXY, reject only optionally; no auto-loaded JS.
2. Keep all upstream scripts as links or metadata only, not executable copies.
3. Retain real server credentials solely on user devices and server.
4. Require pinned hashes, narrow hostnames, tests and explicit approval before any content-rewrite module is enabled.
5. Test DNS and IPv6 for leaks before claiming production safety.

**Limitations:** This review neither proves exfiltration nor certifies upstream scripts safe. Licenses, binaries, runtime data flows and iPhone behavior remain unverified.

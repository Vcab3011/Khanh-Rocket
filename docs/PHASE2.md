# Phase 2 — Reverse-engineering & Custom App Modules

## Scope and decision

- Original 10in1: **17 script declarations** (including 3 Sub-Store assets, 2 YouTube hooks sharing one file), 5 URL rewrites, 3 header rewrites, 2 UDP rules, 1 Map Local, 18 explicit MITM host patterns.
- `inventory/legacy_scripts.json` catalogs every upstream script from the original configuration, including URL, phase and preliminary security risk. **Completeness is inventory-level, not functional parity.**
- Phase 2 introduces 12 *additional* app-oriented privacy/telemetry modules. These are optional domain-based filters. No subscription spoofing, purchase verification bypass, or promise of paid features for free.
- Runtime behavior of app endpoints is **not yet verified** on iPad. Breaking an analytics endpoint may also affect login, playback, recommendations, diagnostics or app stability.
- No external JS, MITM interception, or third-party root certificate. This intentionally differs from Gấu Apple's original 10in1.

## Functional parity matrix

| Original 10in1 feature | Analysis outcome | Phase 2 implementation status |
| --- | --- | --- |
| General rules (2 UDP rejects) | YouTube-related UDP fallback suppression | Audit only; risky to reproduce indiscriminately |
| YouTube URL Rewrite (5) + Map Local (1) | Tracks/ad playback URL modification | Audit only; new optional telemetry-domain filter is **not equivalent** |
| RevenueCat/Spotify Header Rewrite (3) | Cache / request-header modification | Audit only; no MITM |
| Sub-Store Core/Simple/Sync (3 hooks) | Local subscription manager and scheduled sync | Not enabled, 3 release binaries unaudited |
| YouTube request + response (2 hooks) | Binary bundled response transforms | Not ported; needs fixtures and controlled tracing |
| Spotify JSON + Protobuf (2 hooks) | iPhone/iPad URL change + partial playback transforms | Not ported; optional Spotify telemetry filter is not Premium |
| SoundCloud Go+ | Overwrites account plan/features response | Audited; not ported |
| Locket Gold (revenuecat + deleteHeader) | Response entitlement spoofing + ETag handling | Audited; not ported |
| Alight Motion, PicsArt, Wink, Truecaller, KineMaster, CamScanner, BeautyPlus (7) | Subscription/VIP state replacements | Audited; not ported |
| MITM hostname list (18 patterns) | Allows selective HTTPS interception with trusted CA | Deliberately absent |

## New experimental app modules

| Module | App/service | What it tries to do |
| --- | --- | --- |
| `app-youtube-telemetry` | YouTube | Reject analytics endpoint only |
| `app-spotify-telemetry` | Spotify | Reject telemetry endpoint only |
| `app-reddit-telemetry` | Reddit | Reject event telemetry |
| `app-tiktok-telemetry` | TikTok | Reject analytics/log endpoints |
| `app-twitch-telemetry` | Twitch | Reject telemetry endpoint |
| `app-pinterest-telemetry` | Pinterest | Reject logging endpoint |
| `app-meta-telemetry` | Facebook/Meta | Reject narrow analytics endpoint |
| `app-amazon-ads` | Amazon | Reject ad-network domain |
| `app-microsoft-telemetry` | Microsoft | Reject diagnostic endpoint |
| `app-adobe-telemetry` | Adobe | Reject analytics endpoint |
| `app-google-advertising` | Google | Reject ad conversion domain |
| `app-snapchat-telemetry` | Snapchat | Reject analytics endpoint |

These domains are **candidate patterns**, not measured coverage or verified features. Some endpoints may have changed since this document was written. A site may use first-party domains or encrypted protocols not affected by these rules.

## How to test on iPad

1. Import `build/apps-privacy.conf` from a reviewed GitHub branch. Do not override your existing 10in1 configuration.
2. Home → Global Routing → `Config`, enable Shadowrocket.
3. Ensure `FINAL,DIRECT`: public IP should remain Canada. This profile works without a Vietnam server.
4. Test one app at a time (login, feed, playback, messaging, purchases). If it breaks, disable its module via `--disable app-…`, rebuild, and reimport.
5. Confirm the actual `Data` network logs if relevant. Ad/telemetry reduction cannot be inferred from the Config list alone.
6. Never install an unknown HTTPS-decryption root certificate merely to use this profile.

## Next gates

- Provide app version + sanitized, user-owned test fixtures before attempting compatibility claims.
- Check licenses and hash pin upstream JS only after code-level review.
- Verify user-authored/authorized request-rewrite tests in a controlled environment before considering any experimental MITM module.
- Add honest automated compatibility reports, not “all apps unlocked forever” guarantees.

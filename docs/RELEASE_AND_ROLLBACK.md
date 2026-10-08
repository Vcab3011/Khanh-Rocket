# Khanh Rocket: safe upgrade and rollback runbook

## Production baseline (2026-10-08)

The user reported that re-importing `build/khanh-rocket.conf` and enabling HTTPS Decryption made the 10in1 features work on iPhone/iPad. This is a **user-observed smoke test**, not a guarantee that upstream scripts or app entitlements will remain functional.

- Stable profile: `build/khanh-rocket.conf` on `main`.
- Baseline commit: `88dbcb4751cc649592f292811b65acb4bed8837b`.
- Baseline fixture: `tests/fixtures/10in1-active.conf` (35 ordered effective directives).
- Immutable recovery URL (same config at baseline commit):
  `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/88dbcb4751cc649592f292811b65acb4bed8837b/build/khanh-rocket.conf`

**Do not regenerate or overwrite the stable profile from `tools/build.py`.** That tool builds separate non-MITM routing profiles. Do not change live script paths, MITM hosts, rewrites, or routing just to make a test pass.

## Release gates

1. Develop on a feature branch; keep `main` unchanged until review.
2. Run `python -m unittest discover -s tests -v`, `python tools/validate_legacy.py`, and `python tools/audit_10in1.py`.
3. Compare the effective directives against the baseline. Any difference is **intentional and requires device testing**; do not update the fixture just to silence a failure.
4. Review external script provenance and mutable URLs. Offline checks cannot prove remote code is safe.
5. On a test device, verify: VPN connection; Global Routing = Config; HTTPS Decryption and trusted CA only if deliberately enabled; YouTube playback/ad behavior; Locket behavior; normal browsing; app sign-in; and DNS/connectivity. Record app/Shadowrocket versions and observed results. A locally rewritten subscription state is not a genuine purchase.
6. Merge only after human approval. Roll out to one device first; preserve the previous file for rollback.

## Rollback

- If a new version breaks behavior, select the previously working local profile or import the immutable recovery URL above.
- Select that profile in Config; confirm Global Routing = Config.
- HTTPS Decryption requires explicit trust in the interception CA and all scripts with access to decrypted traffic. Disable it when not needed.
- If a remote script changes independently, rolling back the configuration alone **may not restore behavior**. Compare and audit upstream script versions; remote URLs are not pinned.
- Never commit certificates, CA private keys, proxy credentials, device logs containing tokens, or personal data.

## Roadmap

- **Phase 1 — stability:** baseline snapshot, regression tests, release/rollback instructions.
- **Phase 2 — security:** read-only third-party script inventory and mutable URL report. Next: review actual JS and pin vetted immutable versions **in a separate test profile**.
- **Phase 3 — performance:** measure latency, DNS behavior, battery, CPU, request counts on real devices; optimize only after before/after measurements.
- **Phase 4 — modularity:** prototype opt-in modules in separate profiles; do not silently modify 10in1 production profile.

No static test can guarantee compatibility with future iOS, Shadowrocket, YouTube, Locket, or third-party JS releases.

# 10in1 compatibility baseline

Khanh Rocket maintainer: **Vcab3011**. Original 10in1 config compiler: Gaucuto (plain-text provenance; no account mention).
Original baseline repository: Gaucuto / ver2promax, commit 70a1343587324ff5a17195d8847ce55001f9ed44 (plain text; no GitHub @mention).

`build/khanh-rocket.conf` implements the original 10in1 configuration directives:
2 protocol-specific rules, 3 header rewrites, 5 URL rewrites, 17 script declarations, 1 Map Local and the original MITM host list. All JS script paths point to **external third-party repositories** and are **not vendored** into this repo. The original 10in1 repository does not publish an explicit license, so this project retains attribution and independently assembles a functional compatibility config, not a claim of ownership of third-party scripts.

This profile is materially different from the previous Phase 2 privacy-only DNS rules: it asks Shadowrocket to intercept HTTPS and invoke external JavaScript, including app subscription-state response rewriting. Only use with a deliberately installed and trusted Shadowrocket CA. External scripts are not pinned; changes upstream can change behavior without updating Khanh Rocket. An app's actual subscription is determined by its provider and may not be granted by a local rewrite. Ad blocking or compatibility is not verified on device yet.

The stable URL continues to be:
`https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/main/build/khanh-rocket.conf`.

To rollback to safe no-MITM routing, use `build/apps-privacy.conf` or `build/canada-direct.conf`. Never import private account material, session tokens, or root CA keys into this repository.

Run `python tools/validate_legacy.py` to check structure; this test does not verify runtime behavior or remote JS safety. Keep the privacy-only profile independent for regression comparisons.

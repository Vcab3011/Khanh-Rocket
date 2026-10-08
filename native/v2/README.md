# Khanh Rocket Native V2 (experimental, 2026-10-08)

**Never replace the user-confirmed working 10in1 on the main device without testing.** The production profile `build/khanh-rocket.conf` remains unchanged. The original continues to work as last confirmed by the user, but upstream scripts are mutable.

## Deliverables

- **13 independently implemented JavaScript files** under [scripts/](scripts/): 11 straightforward JSON/URL/header adapters, one Spotify protobuf wire editor and one YouTube protobuf editor covering Player/Watch/Shorts.
- **2 canary profiles**:
  - [hybrid-canary.conf](build/hybrid-canary.conf): 17 original hook declarations retained. 12 script URLs now point to our own code pinned at Git commit `d7d43523dd973c0184a70a3398935c15eef96648`; 5 entries still use upstream Sub-Store (3) and YouTube (2).
  - [native-only-canary.conf](build/native-only-canary.conf): 13 script declarations with **zero third-party JavaScript paths**, pinned to our repository commit. No Sub-Store manager and only partial YouTube behavior; **NOT full feature parity**.
- **Node VM behavioral tests** under [tests/](tests/) (13 tests for synthetic JSON and binary protobuf with unknown-field preservation) and Python canary source/isolation checks (4 tests).
- [Deep reverse-engineering report](../../reports/KHANH_V2_REVERSE_ENGINEERING_DEEP_DIVE.md), source provenance, missing features, and clean-room implementation strategy.

## Which profile to use?

- **Daily use:** stable production `main/build/khanh-rocket.conf` already confirmed working by the user.
- **Testing independently rewritten JSON/protobuf on spare device:** hybrid canary; this has higher likely feature overlap, **not confirmed compatibility**. Script replacements can behave differently from original, especially RevenueCat User-Agent fallback and malformed response behavior.
- **Testing complete removal of externally authored JavaScript:** Native-only canary; deliberately missing Sub-Store and broad YouTube features. Do not use as a daily driver.

### Test-only Shadowrocket subscription URLs

```
https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/native-reverse-engineered-v2/native/v2/build/hybrid-canary.conf
https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/native-reverse-engineered-v2/native/v2/build/native-only-canary.conf
```

Imported canary configs can still install/use the same HTTPS CA as the original. HTTPS Decryption grants scripts visibility into matched traffic; use only on a device you control and understand. Do not upload account tokens or personal captures into issue reports.

### Rollback

Previous working config as an immutable Git commit:

```
https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/88dbcb4751cc649592f292811b65acb4bed8837b/build/khanh-rocket.conf
```

Note this pins the **config bytes only**, not the external third-party JavaScript to which the old config points.

## Verification

```bash
node --test native/v2/tests/*.test.cjs
python -m unittest discover -s native/v2/tests -p 'test_*.py' -v
python -m unittest discover -s native/tests -p 'test_*.py' -v
python native/tools/audit_pipeline.py
```

CI must be green for review. Static tests are **not equivalent** to testing YouTube videos, Spotify playback, Sub-Store sync, native iOS certificate behavior or server-side entitlements.

## What remains before claiming full replacement?

1. Implement and test YouTube Browse, Next, Search, Guide, Setting, caption and lyric processing; characterize request-phase hook.
2. Build a first-party subscription manager with source conversion, authentication, token storage, sync scheduler, backup/restore, transparent remote destinations and local domain safety.
3. Obtain anonymized protobuf fixtures and a device behavior matrix. Validate no unwanted HTTP calls or missing unknown fields.
4. Pin code/release, separately canary-test, review and approve. Do not change production on an assumption of parity.

Upstream library licensing: the checked locations of Module_IOS and app2smile/rules did not expose a repository `LICENSE` at the root. Sub-Store is AGPL-3.0. This repo's V2 scriptlets are independently written from observed protocol fields and documented behavior, not copied upstream distributions.

# Khanh Rocket Native V3 — security/control-plane prototype

Status: **experimental** (2026-10-08). Built entirely from first-party JavaScript **sources** and pinned to Git commit SHAs, with no JavaScript executed from the legacy maintainers' URLs. This is **not** feature parity with the working 10in1 and not yet validated on an iPhone.

Stable production profile remains `build/khanh-rocket.conf` on `main`. Do not overwrite it or its working Shadowrocket configuration.

## What changed from V2

1. **Independent build-time module control.** `build_canary.py` generates deterministic canaries from the protected production config and the audited feature registry. Use `--disable <feature>` to remove both the script and its applicable MITM hosts (unless another enabled feature still needs the host).
2. **Least-privilege MITM:** neither profile inherits `%APPEND%`; `privacy` omits RevenueCat and all unrelated premium-app API hosts entirely.
3. **Immutable runtime sources:** 15 first-party JS source files under V2/V3 pinned at two specific repo commits, never `main/master/releases/latest`.
4. **Supply-chain audit:** `supply-chain-lock.json` records the reviewed Git blob ID and pinned commit for each JavaScript. The offline checker validates checked-out bytes, script URI hosts, refs and a small list of unsafe literal runtime APIs (network, dynamic code, persistence). It is not a formal security proof or byte-verification of a Shadowrocket download.
5. **Stateless local subscription normalizer:** `scripts/offline-subscriptions.js` accepts explicitly supplied JSON node data and returns Shadowsocks/Trojan/VMess share URIs. No remote subscription downloads, Gist uploads, account persistence or cron. It uses reserved `khanh.invalid`; interception failure should fail resolution rather than reach an unrelated `.store` domain, but validate DNS interception on the actual device.
6. **Independent YouTube Browse/Next/Search transformer:** `scripts/youtube-browse.js` processes documented typed protobuf paths conservatively, with no external translation calls or saved ad-classifier lists. Other YouTube protobuf functions continue to use our independently written V2 Player/Watch/Shorts codec.

## Profiles

| Profile | First-party JS hooks | Interception scope | Designed for | Important missing features |
|---|---:|---|---|---|
| `privacy-canary.conf` | 4 | YouTube, Spotify URL, reserved local normalizer only | Privacy/security-first validation | Spotify protobuf, app-entitlement scripts, Sub-Store remote sync, YouTube Guide/captions/lyrics |
| `compat-canary.conf` | 15 | YouTube, Spotify, RevenueCat and app API hosts, local normalizer | Regression testing of as much baseline as is independently implemented | Full Sub-Store, parts of YouTube, certified app Premium parity |

**Privacy is the recommended first canary.** Compat intercepts more HTTPS traffic and includes app-response rewriting; only turn it on deliberately and temporarily on a device you own.

### URLs for TEST devices only

- Privacy: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/native-v3-security-control-plane/native/v3/build/privacy-canary.conf`
- Compat: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/native-v3-security-control-plane/native/v3/build/compat-canary.conf`

The canary *config* URLs reference a feature branch and can change during development; the **JavaScript code inside each current config** points to pinned commits. Confirm the commit and profile text before using. Do not recommend these as permanent production subscription URLs.

### Build and audit locally

From repository root with Python 3.12+ / Node.js 20+:

```bash
python native/v3/build_canary.py --profile privacy --check
python native/v3/build_canary.py --profile compat --check
python native/v3/audit_supply_chain.py
python -m unittest discover -s native/v3/tests -p 'test_*.py' -v
node --test native/v3/tests/*.test.cjs
```

Generate a custom canary by toggling modules. Example: enable all compat features except RevenueCat interception:

```bash
python native/v3/build_canary.py --profile compat --disable locket --disable revenuecat-header
```

This writes `native/v3/build/compat-canary.conf` on your checkout. **Always inspect and test changes** before sharing a build. Restore the repository's checked-in canary with a clean checkout. Do not replace `build/khanh-rocket.conf`.

Other disable flags include `youtube`, `youtube-browse`, `spotify-url`, `spotify-protobuf`, `soundcloud`, `alightmotion`, `picsart`, `wink`, `truecaller`, `kinemaster`, `camscanner`, `beautyplus`, `offline-subscriptions`.

## Offline subscription manager API

The manager registers the following **local interception-only** routes when enabled:

- `GET https://khanh.invalid/v1/health`: capability/status JSON.
- `POST https://khanh.invalid/v1/normalize`: `Content-Type: application/json`, body of the shape below.

```json
{
  "nodes": [
    {
      "protocol": "ss",
      "server": "example.org",
      "port": 8388,
      "method": "aes-256-gcm",
      "password": "example-password",
      "name": "Test node"
    }
  ]
}
```

- Max request body: 128 KiB at config interception level; JS also imposes a character count limit.
- Max 200 nodes. All-or-nothing response; no partial output if one node is invalid.
- Conservative protocols: SS (AEAD methods), Trojan TLS, VMess TCP/WS with UUID validation.
- Returns `application/json` with `subscription` containing newline-separated share URI strings. The response necessarily contains the supplied proxy credentials; **never publish or log it**.
- No read or write of saved subscriptions, no embedded HTTP client, no remote fetch, no Gist access, no background cron.
- No permissive browser CORS headers. This is *not* a remotely reachable SaaS or complete replacement for Sub-Store.
- **Unverified:** whether the Shadowrocket HTTPS MITM/request hook correctly synthesizes responses to the reserved `.invalid` hostname for the exact iOS/Shadowrocket version.

## Main threats and mitigations

| Threat | Mitigation | Residual risk |
|---|---|---|
| Third-party scripts change without warning | Only first-party sources pinned to Git commit SHA + Git blob lock | GitHub delivery availability; Shadowrocket downloads are not cryptographically verified by the app in this project |
| Unnecessary HTTPS decryption across apps | Privacy profile limits hostnames, feature-specific build-time MITM | Shadowrocket trusted root CA still enables sensitive decryption for selected hosts |
| Secret leakage by a subscription tool | Stateless local normalizer, no network APIs, no logs, reserved `.invalid` host | A deliberate caller receives the generated secret-bearing URIs; device interception unverified |
| Code executing hidden network operations | Offline script source scan and Node VM tests without network APIs | Static scanning can miss obfuscated/dynamically composed behavior; peer review required |
| Parser corruption/data loss | Request/response error guards, protobuf unknown-field preservation, strict test fixtures | Proprietary app schemas change; unknown legitimate content can still be misclassified |
| Paid account spoofing | Distinguish local simulated entitlement from genuine server purchases | Some app features cannot be made functional by local response edits |
| Production regressions | Exact 35-effective-directive fixture; write only to canary paths and draft PR | Third-party script URLs inside old production may still change independently |

## Regression checklist before authorizing a release

1. Test privacy profile on a non-primary device. Record iOS + Shadowrocket versions, whether local `.invalid` routes are actually intercepted, DNS behavior and ability to restore baseline.
2. YouTube: playback, loading times, pre-roll/mid-roll ads, Browse/Next/Search, Shorts, background play, captions, lyrics, login; check false positives. Codec fixture pass is not device evidence.
3. Spotify: search/playback, after login, after app restart, offline status and any genuinely server-verified features.
4. App API scripts: test exact endpoint responses, malformed/error responses, and interactions with unrelated apps sharing RevenueCat.
5. Subscription API: SSH/SSL transport, 4xx/5xx, input limits, secrets in process logs and DNS failure.
6. Roll back to the immutable known-working **config** below on any regression. Remote third-party scripts in the baseline remain mutable.

### Production recovery URL

```
https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/88dbcb4751cc649592f292811b65acb4bed8837b/build/khanh-rocket.conf
```

## What is not yet independent

Native V3 removes runtime JavaScript dependency on external maintainers, but it still depends on **Shadowrocket** for interception, **GitHub** to serve pinned source, and external application APIs for behavior. Full Sub-Store cloud synchronization, comprehensive subscription-format conversion, YouTube captions/lyrics/Guide/Settings, and genuine server-side subscription entitlements are **not implemented or verified**. Do not promise 100% feature parity or unrestricted lifetime access.

Additional technical reverse-engineering background: `docs/KHANH_NATIVE_ARCHITECTURE.md` and `reports/KHANH_V2_REVERSE_ENGINEERING_DEEP_DIVE.md`.

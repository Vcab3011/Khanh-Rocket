# Khanh Rocket

Shadowrocket 10in1 compatibility profile plus separate experimental routing profiles.

**Status:** The user reported the 10in1 profile working on iPhone/iPad after re-import and enabling HTTPS Decryption (2026-10-08). This is a device observation, not a guarantee of future app compatibility or an audit of remote scripts. The separate generated routing profiles have not been device-verified. **No working VPN server is bundled.**

## Profiles

- `build/khanh-rocket.conf`: user-confirmed working 10in1 compatibility profile; **do not regenerate or overwrite** with the modular builder.

- `build/vn-split.conf`: routes `.vn` domains via a Home-selected proxy; other traffic direct.
- `build/vn-full.conf`: routes most Internet traffic through a selected Vietnam proxy.
- `build/canada-direct.conf`: direct baseline for troubleshooting.

## Setup

1. Configure a real Vietnam Shadowsocks node in Shadowrocket Home: address, port, method, password. Keep all credentials off GitHub.
2. Import a `build/*.conf` into Shadowrocket and select it.
3. Select the Vietnam node and set Global Routing to **Config**.
4. Verify exit location and DNS/IPv6 behavior on an actual device, especially with full mode.

## Build & test

```bash
python tools/build.py --profile vn-split
python tools/build.py --profile vn-full
python tools/build.py --profile canada-direct
python tools/build.py --profile vn-split --enable ads-lite privacy-lite
python tools/validate.py build/vn-split.conf
python -m unittest discover -s tests -v
```

## Safety

- The **separate generated routing profiles** have no HTTPS MITM, injected root CA, active third-party JavaScript, or subscription spoofing. **The 10in1 compatibility profile DOES enable HTTPS MITM and third-party scripts.**
- The 10in1 profile references remote third-party scripts that Shadowrocket may execute. Their contents can change independently of this repository. See `reports/SECURITY_AUDIT.md`.
- The VPS template uses a placeholder password. Never commit `server/vn-vps/config.json`.
- A VPS gives datacenter IP, not necessarily residential IP. CGNAT may prevent hosting at home.
- Independent dynamic testing is needed; passing static checks does not guarantee Shadowrocket compatibility.

Source reviewed: https://github.com/Gaucuto/ver2promax/blob/main/10in1 at commit `70a1343587324ff5a17195d8847ce55001f9ed44`.

## Stable URL (iPad / iPhone)

`https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/main/build/khanh-rocket.conf`

The stable URL now serves the **10in1 compatibility profile**, not the earlier privacy-only profile. It enables URL/Header Rewrite, Map Local, MITM and remote third-party JavaScript. It has not passed a complete security audit; only install an HTTPS certificate you explicitly trust. Read [compatibility notes](docs/LEGACY_10IN1.md) before using. The older privacy baseline remains at `build/apps-privacy.conf`.

## Phase 2 preview (experimental)

Phase 2 introduces: 12 opt-in app-specific domain filters, a deterministic rules compiler, stricter linting, iPad test notes, and [original 10in1 feature parity audit](docs/PHASE2.md). These are privacy/ad-network controls **not** Premium unlocks; third-party subscription scripts remain audit-only. Import `build/apps-privacy.conf` from the preview branch on a test device.

## Stability and safe upgrades

The working 10in1 profile is protected by an exact effective-directive snapshot and unit tests. See [release gates and rollback](docs/RELEASE_AND_ROLLBACK.md). Run `python tools/audit_10in1.py` for a **read-only** inventory of remote scripts and MITM hostname patterns. This does not download or execute external scripts. All new features must be tested separately before touching the stable profile.

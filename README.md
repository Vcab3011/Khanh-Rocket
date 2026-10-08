# Khanh Rocket v0.1

Personal modular Shadowrocket routing baseline and static audit.

**Status:** Generated configurations passed static checks; not yet tested on an iPhone or deployed to a Vietnamese proxy endpoint. **No working VPN server is bundled.**

## Profiles

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

- No HTTPS MITM, injected root CA, active third-party JavaScript, or subscription spoofing in built configurations.
- Gấu Apple and upstream scripts are reviewed as historical references, **not** shipped or run; see `reports/SECURITY_AUDIT.md`.
- The VPS template uses a placeholder password. Never commit `server/vn-vps/config.json`.
- A VPS gives datacenter IP, not necessarily residential IP. CGNAT may prevent hosting at home.
- Independent dynamic testing is needed; passing static checks does not guarantee Shadowrocket compatibility.

Source reviewed: https://github.com/Gaucuto/ver2promax/blob/main/10in1 at commit `70a1343587324ff5a17195d8847ce55001f9ed44`.

## Stable URL (iPad / iPhone)

Import this URL in Shadowrocket's **Config → +** to obtain the maintained default profile:

`https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/main/build/khanh-rocket.conf`

After future releases, refresh the same existing config URL in Shadowrocket; **it does not auto-update instantly** and may require manual re-download. Default currently uses the Phase 2 **Apps Privacy (Experimental)** profile with DIRECT egress and optional ad/telemetry blocking. It **does not grant app Premium subscriptions** and may disrupt apps; use `build/canada-direct.conf` for rollback. A Vietnam VPN server/node is still separate and not bundled.

The canonical file is generated from `apps-privacy` and kept in sync by CI:

```bash
python tools/build.py --profile apps-privacy --output build/khanh-rocket.conf
```

## Phase 2 preview (experimental)

Phase 2 introduces: 12 opt-in app-specific domain filters, a deterministic rules compiler, stricter linting, iPad test notes, and [original 10in1 feature parity audit](docs/PHASE2.md). These are privacy/ad-network controls **not** Premium unlocks; third-party subscription scripts remain audit-only. Import `build/apps-privacy.conf` from the preview branch on a test device.

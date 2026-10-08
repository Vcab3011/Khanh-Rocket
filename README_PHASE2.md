# Khanh Rocket — Phase 2 preview

A practical, reproducible ruleset generator for Shadowrocket on iPad/iPhone. This **does not reproduce subscription bypasses** in third-party apps. Historical 10in1 scripts are catalogued and tracked for audit, not bundled.

## iPad test: Apps Privacy

Stable URL after merge to main:

`https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/main/build/khanh-rocket.conf`

Config -> '+' -> download URL -> select profile -> Home -> Global Routing **Config** -> enable.

The profile routes `DIRECT`, so it requires no Vietnam VPN node. Device-based smoke testing remains necessary.

## Windows

```powershell
git clone https://github.com/Vcab3011/Khanh-Rocket.git
cd Khanh-Rocket
git pull origin main
py -3 tools/build.py --list-modules
py -3 tools/build.py --profile apps-privacy
py -3 tools/build.py --profile apps-privacy --disable app-tiktok-telemetry
py -3 tools/build.py --profile apps-privacy --enable app-youtube-telemetry app-spotify-telemetry
py -3 tools/validate.py build/apps-privacy.conf
py -3 -m unittest discover -s tests -v
```

## Risks

Apps may change endpoints; DNS rules are not a universal ad blocker and can break app functionality. No paid subscription or server-entitlement rights are created. See `docs/PHASE2.md` for feature inventory and parity caveats.

# P0/P1 engineering review — 2026-10-08

Scope: isolated Egern read-only Multi-App Lab. No changes to Shadowrocket sources, profiles or baseline locks. No merge or deployment to an iPhone.

## Evidence and repository topology [G]

- Handoff read in full at `429a1fa1ff1743d2424260f3efba53d96daf8c6b`, branch `docs/codex-handoff-2026-10-08`, Draft PR #9 based on the lab branch. Its only change against the lab base is the handoff document.
- Implementation base: `feature/multiapp-observability-v1` at `ab046e6a3e7715a31b943642f54d100c406c77db` (Draft PR #8 against `v3-test`). Feature work: `feature/multiapp-runtime-safety-p1`.
- `main` remains `88dbcb4751cc649592f292811b65acb4bed8837b`. Protected `build/khanh-rocket.conf` Git blob: `e1f1f71ef4e9c0fa88ef68ffafecb02c81153a29`.
- `v3-test` remains `39bb2d467844535cd1945b45193f0d161ca742ba`. Protected `build/khanh-rocket-v3-test.conf` Git blob: `4ca2337e4473785bbaa5439de343acddfa1059cd`.
- GitHub API confirms PR #3–#9 are open Drafts. PR #5 targets V2; PR #6/#7/#8 target `v3-test`. PR #6 adds a separate banner profile and filter; it does not change the working player or V3 Test. No cherry-picks/rebases/merges were performed.
- Read `lab/README.md`, `native/v3/README.md`, `docs/KHANH_NATIVE_ARCHITECTURE.md`, `reports/KHANH_V2_REVERSE_ENGINEERING_DEEP_DIVE.md`, PR #7's `docs/EGERN-LOCKET-ONE-SHOT-CLEANROOM-PLAN.md`, branch history, PR metadata/file inventories and workflow definitions.
- All 15 V3 pins match historical Git bytes and recorded blob IDs. Original lab observer/status/reset pins also matched their historical bytes before changes. New observer/status bytes are committed at `f9c72dff2a4f92e7c93a9c1a44777e286f0a5ea3`; reset retains its unchanged `3f9f748ca90e7cf2c68aef1f039014d7c8b6c7f6` pin.

## CI baseline [G/T]

- PR #8 exact head: [Lab 37800149134](https://github.com/Vcab3011/Khanh-Rocket/actions/runs/37800149134) and [Shadowrocket 37800149163](https://github.com/Vcab3011/Khanh-Rocket/actions/runs/37800149163) both completed successfully, independently confirmed via GitHub API.
- PR #9 handoff: [37801622011](https://github.com/Vcab3011/Khanh-Rocket/actions/runs/37801622011) completed successfully at `429a1fa…`.
- Before edits: Lab 25 Node + 4 Python; baseline 5 Node + 20 Python; V2 13 Node + 4 Python; V3 11 Node + 8 Python all passed locally. These counts are from executed local suites, not inferred from historical CI.

## Confirmed defects and minimal corrections [G/T]

1. **Consumed body lost on diagnostics failure:** storage write exceptions escaped to a catch returning nothing after `arrayBuffer()` consumed the stream. A regression test failed before the fix. The adapter now restores successfully obtained bytes in `finally`, including empty byte arrays and parser/storage errors.
2. **Encoding/MIME ambiguity:** compressed or incorrectly typed bodies could be consumed without a verified runtime encoding contract. The adapter skips encoded/non-JSON streams, uses fatal UTF-8 decoding and explicitly records missing/oversized bodies. JSON hooks now request documented binary handling.
3. **Isolation too permissive:** no method constraints, future RevenueCat API versions, and a Locket substring anywhere in the User-Agent were accepted. Classification now permits only documented routes/methods and first-token Locket identity. Unknown traffic is not read or persisted. User-Agent still cannot authenticate app identity.
4. **Event allowlist gaps:** free-form outcomes/signals and unrelated app metrics could enter persisted history. Enumerated signals/outcomes and per-app metric allowlists now reject such fields. SoundCloud unknown schemas report drift instead of valid zero counts. UTF-8 size is capped in bytes as well as characters.
5. **Incomplete build/pin gates:** reset was not generated or checked, and module checks did not verify actual pinned bytes. Reset has a deterministic template; a source lock plus offline auditor checks all three bundles and five module URLs. CI fetches history and runs these gates. Protected profile tests now compare exact Git blobs, not only effective directives.
6. **Diagnostics clarity:** widget exposes last capture and retained-history `bodyUnavailable`/`schemaDrift` counts with manual experiment checkpoints. Latest time uses maximum capture timestamp, choosing the later event on ties. No arbitrary notes or automated VPN-off observations are stored.

## Official runtime contract [D]

Rechecked [JavaScript API](https://egernapp.com/docs/javascript-api/), [Scriptings](https://egernapp.com/docs/configuration/scriptings/) and [Modules](https://egernapp.com/docs/configuration/modules/) on 2026-10-08:

- Native async ES-module entrypoint, one-shot `arrayBuffer()`, case-insensitive `Headers`, synchronous storage JSON/delete calls and `Uint8Array` returns are documented.
- Omitted response status/headers are documented to remain unchanged. Generic widget and module/script keys used here are documented.
- `max_size` may withhold a body from a script. `binary_body` controls binary handling.
- Automatic compression normalization and timeout rollback are not established by these documents. Encoded bodies remain unread pending device verification.

## Final local validation [T]

Local versions: Node 24.19.0, Python 3.12.14, PyYAML 6.0.3. CI pins Node 22, Python 3.12 and PyYAML 6.0.2.

| Suite / command | Node passed | Python passed |
|---|---:|---:|
| `node --test lab/tests/*.test.cjs`; `python -m unittest discover -s lab/tests -p 'test_*.py' -v` | 43 | 9 |
| `node --test native/tests/*.test.cjs`; `python -m unittest discover -s tests -v`; Python discovery under `native/tests` | 5 | 20 |
| Node/Python discovery under `native/v2/tests` | 13 | 4 |
| Node/Python discovery under `native/v3/tests` | 11 | 8 |
| **Total** | **72** | **41** |

No failures or skipped tests. Also passed `lab/tools/build_runtime.py --check` (observer/status/reset), `lab/tools/audit_pins.py`, both `native/v3/build_canary.py --check` profiles, `native/v3/audit_supply_chain.py`, `native/tools/audit_pipeline.py`, `tools/validate_legacy.py`, four baseline profile builds using `--output /workspace/khanh-rocket-output/…` and their validators, and `git diff --check`.

Fixtures use only synthetic data. Native Node Fetch fixtures verify JS-visible byte equality, untouched status/header objects, gzip/decompressed-with-gzip-header pass-through, invalid UTF-8, 204/304, methods, query variation, body read failures, storage failures, the 256 KiB boundary, 32-event retention and metadata leakage prevention. They are **not Egern integration tests on iOS**.

## Unresolved risks and next gate [I/U]

- No new iPhone/iPad test was performed. Previously reported V3 YouTube background playback and in-video ad suppression are user observations; unchanged profile/player bytes preserve that baseline but do not prove current app behavior.
- Egern return-body/header/compression behavior, body caps, widget import/rendering, timeouts, CA/trust, proprietary schemas and account functionality require a spare-device pilot.
- Failed stream reads cannot be reconstructed without runtime-provided bytes. Concurrent storage read/append/write may lose metadata events; no atomic storage API is documented. TTL is applied on append/read, not an idle automatic purge; reset after testing.
- Encoded responses will produce skip metadata rather than entitlement/feature counts. Ambiguous Locket User-Agents and unknown API versions are intentionally skipped. Product mapping remains unhooked. These are conservative limitations, not proof of missing/valid purchases.
- Status presence/feature counts describe client-visible metadata only. No receipts are forged, no HTTP client is called, no account or genuine server entitlement is created.

Next: independently review the Draft PR, then obtain an explicit spare-device test session. Install only this feature branch's Locket observer plus local status; use a device-local CA, verify response preservation and unrelated RevenueCat app isolation, then record manual VPN-off checkpoints (offline, online, 5/30 minutes, force close, reboot, 24–25 hours). Keep all private traffic on-device. Test SoundCloud/YouTube observers separately; never chain them with Shadowrocket rewrites.

Rollback: remove/disable the new Egern modules and clear local history. The working [V3 Test URL](https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/v3-test/build/khanh-rocket-v3-test.conf) and [production rollback](https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/88dbcb4751cc649592f292811b65acb4bed8837b/build/khanh-rocket.conf) remain unchanged. Production rollback still depends on mutable third-party script URLs; it is not a complete immutable supply-chain guarantee.

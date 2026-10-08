# Khanh Native (experimental)

This is an **independently written**, testable policy engine. It is intentionally isolated from production `build/khanh-rocket.conf` and is NOT a drop-in replacement for 10in1.

- `core/dispatcher.cjs`: pure input validation, exact hostname/phase matching, ambiguity detection, fail-unchanged handling, bounded output actions.
- `modules/youtube-telemetry.cjs`: selectively simulates a local response for specifically matched telemetry URLs; does not decode protobuf or guarantee YouTube ad blocking.
- `modules/spotify-url.cjs`: narrowly adjusts `platform=iphone` in a matched Spotify URL; does not modify entitlements.
- `legacy-script-manifest.json`: static source inventory from the working 10in1.
- `tools/audit_pipeline.py`: deterministic audit of configured scripts, MITM and overlapping patterns.

Run locally:

```bash
python native/tools/audit_pipeline.py
python -m unittest discover -s native/tests -v
node --test native/tests/*.test.cjs
```

**Important:** CommonJS is used for offline tests. Shadowrocket does not execute Node's `require` interface as-is. A future **tested** bundling/runtime adapter will produce self-contained Shadowrocket scripts for a canary profile. Neither existing production config nor MITM should be edited for this stage.

Architecture and risk: [KHANH_NATIVE_ARCHITECTURE.md](../docs/KHANH_NATIVE_ARCHITECTURE.md).

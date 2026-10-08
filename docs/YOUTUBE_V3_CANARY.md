# YouTube V3 — isolated feed completion canary

This revision targets the user-reported iPhone 13 / iOS 27 symptom: Home banners and ads among recommendations below a playing video, while video playback itself works. Exact YouTube/Shadowrocket versions and the live ad payload schema are not yet known. This is a tested code canary, **not a claim of complete iPhone ad blocking**.

## Install one Shadowrocket profile

Recommended when testing YouTube alone:

`https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/youtube-v3-completion-canary/build/khanh-rocket-youtube-only-v3.conf`

This profile contains only the existing YouTube player hook and the new feed hook, with four YouTube MITM hosts. It keeps working YouTube rules, URL rewrites and Map Local unchanged. Unrelated app hooks are excluded from this profile.

If you need the existing V3 compatibility profile's other apps during the test:

`https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/feature/youtube-v3-completion-canary/build/khanh-rocket-youtube-v3-canary.conf`

This variant changes only the Browse/Next/Search script URL at the effective-directive level. The working player and 14 other hooks, MITM, rules, URL/header rewrites and Map Local remain identical. Those other app hooks have their original limitations; client-side simulated status is not a legitimate server purchase.

1. Keep the current V3 Test profile installed so rollback remains immediate. Add the new URL as a **separate** Shadowrocket configuration; do not overwrite your working configuration.
2. On an authorized test device, confirm your device-local Shadowrocket HTTPS certificate is trusted and HTTPS decryption is enabled for the listed hosts. Never download a shared CA/P12 or send certificate private keys.
3. Select the new profile, use Global Routing **Config**, and keep Egern stopped during this test.
4. Fully close/reopen YouTube and refresh Home. Cached ad cards may predate the new hook; the filter operates on new HTTP responses, not already-rendered cache.
5. Check Home, scroll several screens, open a video and inspect recommendations below it, then Search and continuation loads. Verify ordinary recommendations remain present.
6. Check background playback with screen locked, seek/resume, a second video, and Shorts. These preserve the old player code; actual regression testing on your phone is still required.
7. On loading problems, missing ordinary cards or playback regressions, select the original V3 Test immediately. Disable the test profile; do not uninstall your working certificate merely to switch profiles.

Report only: app/OS/Shadowrocket versions, tested surface, whether banners remain, whether normal cards/playback work, and non-sensitive HTTP endpoint/status/body-size/format metadata if available. Do not upload raw responses, tokens, account IDs, video history or receipts. Device debugging must keep private traffic on-device.

## What the new feed script changes

`native/v3/scripts/youtube-feed-filter.js` is first-party, read-only apart from removing selected ad cards. It does not contact a server, persist data, log traffic, rewrite purchases or modify the player.

- Covers the reviewed typed paths for Home (`browse`), below-video recommendations (`next`), Search, their existing continuation/action fields, single-column tabs and Shorts shelves.
- Removes the exact typed `inline_injection_entrypoint_layout.eml` layout with protobuf singular-field merge/last-value semantics; a title merely quoting it is preserved.
- Replaces the old arbitrary `pagead` substring heuristic with a complete canonical ad-tracker URL in a structured opaque renderer, or an unknown field under typed `VideoInfo.VideoContext.VideoContent`. Opaque evidence remains heuristic and needs live-device confirmation; unrelated text/hosts, small unknown fields and known timed lyrics remain untouched.
- Accepts numeric statuses, `statusCode` and HTTP status lines. Only HTTP 200 POST Browse/Next/Search responses are edited. Missing status, unrelated endpoints, malformed/oversized bytes, unsupported wire types and exhausted budgets pass unchanged.
- Supports ArrayBuffer, Uint8Array, numeric-byte arrays and sliced binary views. Preserves unrelated varints, fixed32/fixed64, unknown bytes, list ordering, ordinary Shorts and continuation metadata.
- Has 5 MiB input, 24-level traversal, 100,000 cumulative-field and 32 MiB cumulative-scan limits. Failing a known sibling cancels the whole edit instead of returning a partially rewritten feed. Completion occurs once.

## Evidence and boundaries

Schema facts were independently reviewed against `duyvinh09/Module_IOS` at `34865755c1aee7ba770c1afa364254d8924cfd85` and earlier `5502a6febe84b7db635d3bd31749731aed5c057b`; the inspected script bytes are identical. No upstream JavaScript is copied into runtime files or fetched by the canary. New synthetic fixtures reproduce three old defects: status-line responses were skipped, duplicate EML scalars/fragments were interpreted incorrectly, and ordinary opaque text containing `pagead` could be removed.

The player remains pinned to `d7d43523dd973c0184a70a3398935c15eef96648/native/v2/scripts/youtube-player-protobuf.js`, preserving the previously user-confirmed background playback and in-video-ad baseline. No differential proof identifies which existing player/rule suppressed the user's video ads. The script and profile bytes are unchanged; this alone does not certify behavior on a new app version.

Unknown modern renderers can still carry ads. Guide/account settings, caption/lyrics translation, SponsorBlock and server-side purchases are not added. The source reference contains a dynamic learned classifier and translation code; those are deliberately not activated here without reliable schema/device evidence. The canary does not remove every card mentioning Shorts and does not block arbitrary recommendation domains. Raw gzip bodies pass through; decompression/recompression and Shadowrocket binary return semantics still require device verification.

## Build and validation

From repository root with full Git history, Python 3.12+ and Node 22+:

```sh
python native/v3/build_youtube_canary.py --check
node --test native/v2/tests/*.test.cjs native/v3/tests/*.test.cjs
python -m unittest discover -s native/v3/tests -p 'test_*.py' -v
python native/v3/audit_supply_chain.py
python tools/validate_legacy.py
```

`native/v3/youtube-feed-lock.json` records the reviewed first-party source commit, Git blob and SHA-256. The generator verifies actual pinned Git bytes and exact protected profile blobs before rendering. It writes only the two new profile paths; `--check` writes nothing. Commit reviewed source first, then pin/render in a separate commit. Existing production, V3 Test and earlier banner profiles are not regenerated.

Node VM tests exercise code with synthetic protobuf, not iOS. Dedicated CI uses Node 22 and checks the pinned source, deterministic profiles and protected bytes. Do not call the profile device-verified until the above checklist passes on the actual iPhone.

Rollback: `https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/v3-test/build/khanh-rocket-v3-test.conf`. Production also stays unchanged at commit `88dbcb4751cc649592f292811b65acb4bed8837b`.

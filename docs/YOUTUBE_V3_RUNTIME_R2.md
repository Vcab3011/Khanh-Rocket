# YouTube V3 r2: device failure investigation

The user reports banners on both Home and below-video recommendations, and audio
stops when the screen locks, on iPhone 13 / reported iOS 27. Shadowrocket HTTPS
Decryption is enabled. YouTube and Shadowrocket versions, certificate trust,
active configuration bytes, actual status/body representation and payload schema
have not been verified on the device. No personal traffic has been collected.

## Two reproduced code defects

1. `native/v2/scripts/youtube-player-protobuf.js` uses `Number(response.status)`.
   An explicit `HTTP/1.1 200 OK` returns NaN, skipping ad removal and background
   activation. The adapter normalizes an explicit, consistent 200 status line;
   403/500 or conflicting statusCode are not normalized. This is a demonstrated
   code defect, not proof of the device's actual status representation.
2. The old player handles only Watch.contents[1].player[2]. It leaves
   Watch.contents[1].next[3] unchanged. The new feed path processes the nested
   Next response through the existing typed filter. Schema reference:
   Module_IOS `34865755c1aee7ba770c1afa364254d8924cfd85`, Watch/Content fields.

`native/v3/templates/youtube-player-feed.js.in` runs the unchanged original
player first and the feed second, through a single get_watch response hook.
It retains the player's result when the feed passes through or rejects bytes.
Player-only and Shorts numeric-status outputs are identical to the old player.
The actual background audio and in-video ad behavior require an iPhone test.

`native/v3/build_youtube_player_feed.py --check` verifies the original player's
SHA-256 and exact deterministic bundle. It never writes production profiles.
The new immutable pins and SHA-256 are recorded in `youtube-runtime-lock.json`.
Config regression tests allow only the two YouTube source URLs and revision name
to change against the previously published `c86b3a2` profile. Other hooks, MITM,
rules and rewrites, production config and old player source stay unchanged.

## One installation URL

Continue using:

https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/v3-test/build/khanh-rocket-v3-test.conf

Refresh this configuration and verify its name contains **V3 r2** before testing.
Fully close/reopen YouTube, refresh Home, open a video and check below-video
recommendations. Play a normal video, lock the screen and check audio separately.

Inspect Shadowrocket script logs after these actions. Share only the lines
starting `KR-YT feed-r2` / `KR-YT player-r2`. These are fixed route/status/body
enums, coarse size buckets and aggregate counts. They contain no request URLs,
queries, body contents, ad URLs, video identifiers, account IDs or tokens.
Never export complete request/response logs or personal HTTP bodies.

- No KR-YT lines: script invocation or applied configuration is not established.
- `body_unavailable`, `gzip_body`, `status_skip`, `method_skip`, `parse_error`:
  the filter passed through; investigate runtime representation or format.
- `schema_unmatched`: bytes parsed, but no reviewed list schema was reached.
- `no_ad_match`: a reviewed list was reached, but no supported ad evidence found.
- `filtered`: a supported ad card was removed; this does not prove every ad on
  screen was removed or that audio continues while the device is locked.
- Player `changed`: the player returned edited bytes, not proof iOS honored them.

Home classification is unchanged in r2. The device diagnostic is necessary to
choose a justified next fix. Do not claim Home banners are solved by these tests.
Logs do not persist identifiers, make network calls or send device notifications.

Offline verification: synthetic Node VM fixtures cover status-line rejection,
Watch recommendation filtering, preservation of the original player's output,
background flags, ad fields, malformed Next pass-through, binary return formats,
exactly one completion and diagnostic privacy. These are code tests, not iOS.

Production remains unchanged. No Egern deployment or PR merge is part of r2.
If r2 introduces a regression, the original configuration remains available at
the immutable rollback URL:

https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/39bb2d467844535cd1945b45193f0d161ca742ba/build/khanh-rocket-v3-test.conf

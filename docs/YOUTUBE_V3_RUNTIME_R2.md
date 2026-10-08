# YouTube V3 r2: device failure investigation

The user reports banners on both Home and below-video recommendations, and audio
stops when the screen locks, on iPhone 13 / reported iOS 27. Shadowrocket HTTPS
Decryption is enabled. YouTube and Shadowrocket versions, certificate trust,
active configuration bytes, actual status/body representation and payload schema
have not been verified on the device. No personal traffic has been collected.

## Current device acceptance: failed

After r2 was published at `769a81c5edb1fd21d696aaf2c10fc6ee6ec0a766`, the user
again reported both Home/below-video banners and loss of audio when locking the
screen. This is an actual user device report and supersedes any inference that
the passing synthetic tests establish usable background playback or ad blocking.
The old handoff's working-device observation remains historical, not acceptance
of this release. Do not promote or describe r2 as working on this iPhone.

The user sees the config filename `khanh-rocket-v3-test.conf`. Shadowrocket may
display the filename rather than the `#!name` metadata. This does not establish
that the wrong configuration is selected or that the latest bytes are applied.
Public delivery was rechecked: the shared URL returns the exact r2 checkout and
both script URLs return bytes matching `youtube-runtime-lock.json` SHA-256.
No device KR-YT diagnostic lines or current app versions have been provided.
The next prerequisite is a device invocation/body/status result; do not release
another speculative classifier or background-player rewrite based on mocks alone.

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

![QR for the same existing V3 configuration URL](../build/khanh-rocket-v3-test-qr.png)

The user requests QR codes with configuration links from now on. This QR encodes
the exact URL above, without a redirect, shortener or different configuration.
It was generated locally with qrcode 8.2 (error correction Q, four-module quiet
zone, 570x570 PNG) and independently decoded with zxing-cpp 2.3.0 to the exact URL.
The image stays valid when the configuration at that URL is updated.

Refresh this same configuration before testing. In its text, the `#!name` contains
**V3 r2** and its two YouTube script URLs contain source commit `9ab2ebbf...`.
The filename shown by the app may remain `khanh-rocket-v3-test.conf`.
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

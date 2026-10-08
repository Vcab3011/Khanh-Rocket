#!/usr/bin/env python3
"""Build one get_watch response handler without changing the reviewed player.

No downloads, eval, runtime imports, production generation or profile writes.
"""
import argparse
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PLAYER = ROOT / 'native/v2/scripts/youtube-player-protobuf.js'
FEED = ROOT / 'native/v3/scripts/youtube-feed-filter.js'
TEMPLATE = ROOT / 'native/v3/templates/youtube-player-feed.js.in'
TARGET = ROOT / 'native/v3/scripts/youtube-player-feed.js'
PLAYER_SHA256 = '33f2f30bcf7bf84134e9c23b9491c3e9a3f2b463af1cbba9d8377f45b2b840a9'


def render():
    player = PLAYER.read_bytes()
    if hashlib.sha256(player).hexdigest() != PLAYER_SHA256:
        raise ValueError('Reviewed V2 player bytes changed; stop and review')
    template = TEMPLATE.read_text()
    assert template.count('@@PLAYER@@') == template.count('@@FEED@@') == 1
    return template.replace('@@PLAYER@@', player.decode()).replace('@@FEED@@', FEED.read_text())


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    expected = render()
    if args.check:
        if not TARGET.is_file() or TARGET.read_text() != expected:
            raise SystemExit('Player/feed bundle differs from its reviewed inputs')
        print('PASS: deterministic bundle; original V2 player bytes unchanged')
    else:
        TARGET.write_text(expected)
        print(TARGET.relative_to(ROOT))

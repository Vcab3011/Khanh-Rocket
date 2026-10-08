#!/usr/bin/env python3
"""Deterministic first-party YouTube engine; never writes a config or downloads JS."""
import argparse
import hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
PLAYER = ROOT / 'native/v2/scripts/youtube-player-protobuf.js'
FEED = ROOT / 'native/v3/scripts/youtube-feed-r3.js'
TEMPLATE = ROOT / 'native/v3/templates/youtube-response-r3.js.in'
TARGET = ROOT / 'native/v3/scripts/youtube-response-r3.js'


def render():
    player = PLAYER.read_bytes()
    if hashlib.sha256(player).hexdigest() != '33f2f30bcf7bf84134e9c23b9491c3e9a3f2b463af1cbba9d8377f45b2b840a9':
        raise ValueError('Original player source changed')
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
            raise SystemExit('R3 bundle differs from reviewed components')
        print('PASS: deterministic R3 bundle and original player SHA-256')
    else:
        TARGET.write_text(expected)

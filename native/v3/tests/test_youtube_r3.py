"""Enforce the authorized R3 profile delta and real immutable runtime bytes."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import unittest
ROOT = Path(__file__).resolve().parents[3]
PROFILE = 'build/khanh-rocket-v3-test.conf'
LOCK = json.loads((ROOT / 'native/v3/youtube-r3-lock.json').read_text())
PREFIX = 'https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/'
PATTERN = r'^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/(player|get_watch|browse|next|search|reel\/reel_watch_sequence|account\/get_setting)(?:\?|$)'


def git_bytes(ref, path):
    return subprocess.check_output(['git', 'show', f'{ref}:{path}'], cwd=ROOT, timeout=10)


class YouTubeR3Tests(unittest.TestCase):
    def test_only_youtube_hook_pair_and_revision_change_from_published_r2(self):
        baseline = git_bytes(LOCK['baseline_ref'], PROFILE).decode()
        lines = [line for line in baseline.splitlines() if line.startswith('youtube.native.')]
        self.assertEqual(len(lines), 2)
        line = ('youtube.native.response = type=http-response,pattern=' + PATTERN +
                ',requires-body=1,max-size=5242880,binary-body-mode=1,timeout=10,script-path=' +
                PREFIX + LOCK['source_ref'] + '/' + LOCK['path'])
        expected = baseline.replace('\n'.join(lines) + '\n', line + '\n', 1)
        expected = expected.replace('Khanh Rocket V3 r2 COMPAT CANARY', 'Khanh Rocket V3 r3 COMPAT CANARY', 1)
        self.assertEqual((ROOT / PROFILE).read_bytes(), expected.encode())

    def test_one_hook_routes_all_reviewed_response_endpoints_to_real_pinned_source(self):
        profile = (ROOT / PROFILE).read_text()
        self.assertEqual(len([line for line in profile.splitlines() if line.startswith('youtube.native.')]), 1)
        for route in ['browse', 'next', 'search', 'player', 'get_watch', 'reel/reel_watch_sequence', 'account/get_setting']:
            self.assertIsNotNone(re.search(PATTERN, 'https://youtubei.googleapis.com/youtubei/v1/' + route + '?synthetic=1'))
        for route in ['player_extra', 'account/subscription', 'get_watch/other']:
            self.assertIsNone(re.search(PATTERN, 'https://youtubei.googleapis.com/youtubei/v1/' + route))
        pinned = git_bytes(LOCK['source_ref'], LOCK['path'])
        self.assertEqual(hashlib.sha256(pinned).hexdigest(), LOCK['sha256'])
        self.assertEqual((ROOT / LOCK['path']).read_bytes(), pinned)
        self.assertIn(PREFIX + LOCK['source_ref'] + '/' + LOCK['path'], profile)

    def test_original_production_player_and_soundcloud_code_remain_unchanged(self):
        data = (ROOT / 'build/khanh-rocket.conf').read_bytes()
        blob = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        self.assertEqual(blob, 'e1f1f71ef4e9c0fa88ef68ffafecb02c81153a29')
        for path in ['native/v2/scripts/youtube-player-protobuf.js', 'native/v2/scripts/soundcloud-go.js']:
            self.assertEqual((ROOT / path).read_bytes(), git_bytes('d7d43523dd973c0184a70a3398935c15eef96648', path))

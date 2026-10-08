"""Guard the explicitly authorized shared V3 update against unrelated changes."""
import hashlib
import json
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[3]
PROFILE = 'build/khanh-rocket-v3-test.conf'
LOCK = json.loads((ROOT / 'native/v3/youtube-runtime-lock.json').read_text())
PREFIX = 'https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/'


def git_bytes(ref, path):
    return subprocess.check_output(['git', 'show', f'{ref}:{path}'], cwd=ROOT, timeout=10)


def blob(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


class YouTubeRuntimeTests(unittest.TestCase):
    def test_shared_profile_changes_only_youtube_pins_and_revision_name(self):
        old = git_bytes(LOCK['profile_baseline_ref'], PROFILE).decode()
        expected = old.replace('#!name = Khanh Rocket V3 COMPAT CANARY',
                               '#!name = Khanh Rocket V3 r2 COMPAT CANARY', 1)
        before_after = {
            'd7d43523dd973c0184a70a3398935c15eef96648/native/v2/scripts/youtube-player-protobuf.js':
                'native/v3/scripts/youtube-player-feed.js',
            'ca7a2ede3f059fb66cbfd7b542938389e5096d35/native/v3/scripts/youtube-feed-filter.js':
                'native/v3/scripts/youtube-feed-filter.js',
        }
        for old_path, path in before_after.items():
            self.assertEqual(expected.count(PREFIX + old_path), 1)
            expected = expected.replace(PREFIX + old_path, PREFIX + LOCK['source_ref'] + '/' + path, 1)
        self.assertEqual((ROOT / PROFILE).read_bytes(), expected.encode())

    def test_exact_pinned_sources_are_real_git_objects_and_match_reviewed_hashes(self):
        self.assertRegex(LOCK['source_ref'], r'^[0-9a-f]{40}$')
        content = (ROOT / PROFILE).read_text()
        for path, digest in LOCK['sources'].items():
            pinned = git_bytes(LOCK['source_ref'], path)
            self.assertEqual(hashlib.sha256(pinned).hexdigest(), digest)
            self.assertEqual((ROOT / path).read_bytes(), pinned)
            self.assertIn('script-path=' + PREFIX + LOCK['source_ref'] + '/' + path, content)

    def test_original_production_and_player_bytes_remain_unchanged(self):
        self.assertEqual(blob((ROOT / 'build/khanh-rocket.conf').read_bytes()),
                         'e1f1f71ef4e9c0fa88ef68ffafecb02c81153a29')
        self.assertEqual(blob((ROOT / 'native/v2/scripts/youtube-player-protobuf.js').read_bytes()),
                         'd0dea75aeb1a86bb85b234a5ed2aa22eee31b315')

#!/usr/bin/env python3
"""Fetch hash-checked analysis oracles to /tmp; never install them as runtimes."""
import hashlib
from pathlib import Path
import urllib.request
REFERENCES = [
    ('34865755c1aee7ba770c1afa364254d8924cfd85', 'youtube.response.js',
     '5762e310cd546084f172828d827e16b1db36d1677a692c5de4f1a476c3bd89e6',
     '/tmp/khanh-youtube-reference.js'),
    ('5502a6febe84b7db635d3bd31749731aed5c057b', 'SoundCloudGoPlus.js',
     '08421be74ff6ce5f4fc17714d92899a7765f1b0254b78246c58580d284cec05e',
     '/tmp/khanh-soundcloud-source-reference.js'),
]
for ref, name, sha, filename in REFERENCES:
    target = Path(filename)
    if target.is_file() and hashlib.sha256(target.read_bytes()).hexdigest() == sha:
        print('PASS: cached analysis reference SHA-256:', name)
        continue
    url = f'https://raw.githubusercontent.com/duyvinh09/Module_IOS/{ref}/js/{name}'
    data = urllib.request.urlopen(url, timeout=30).read()
    if hashlib.sha256(data).hexdigest() != sha:
        raise SystemExit('Reference SHA-256 mismatch; do not execute: ' + name)
    target.write_bytes(data)
    print('PASS: downloaded pinned analysis reference SHA-256:', name)

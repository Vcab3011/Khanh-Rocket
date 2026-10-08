#!/usr/bin/env python3
"""Generate isolated YouTube canaries, never overwrite existing profiles."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOCK = ROOT / "native/v3/youtube-feed-lock.json"
SOURCE = "native/v3/scripts/youtube-feed-filter.js"
TARGETS = ("khanh-rocket-youtube-v3-canary.conf", "khanh-rocket-youtube-only-v3.conf")
PROTECTED = {
    "build/khanh-rocket.conf": "e1f1f71ef4e9c0fa88ef68ffafecb02c81153a29",
    "build/khanh-rocket-v3-test.conf": "4ca2337e4473785bbaa5439de343acddfa1059cd",
    "build/khanh-rocket-v3-banner-test.conf": "b592773ad320af2ae81581619976bc93c9cec4ad",
}


def blob(data):
    return hashlib.sha1(f"blob {len(data)}\0".encode() + data).hexdigest()


def verify_sources():
    for path, expected in PROTECTED.items():
        if blob((ROOT / path).read_bytes()) != expected:
            raise ValueError("protected profile differs: " + path)
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    if lock.get("schema") != 1 or lock.get("path") != SOURCE or not re.fullmatch(r"[a-f0-9]{40}", lock.get("ref", "")):
        raise ValueError("invalid immutable YouTube source lock")
    data = (ROOT / SOURCE).read_bytes()
    if blob(data) != lock.get("git_blob_sha1") or hashlib.sha256(data).hexdigest() != lock.get("sha256"):
        raise ValueError("unreviewed YouTube feed bytes")
    pinned = subprocess.run(["git", "-C", str(ROOT), "show", f"{lock['ref']}:{SOURCE}"],
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False)
    if pinned.returncode or pinned.stdout != data:
        raise ValueError("pinned source unavailable/different; fetch full history")
    text = re.sub(r"/\*[\s\S]*?\*/|^\s*//[^\n]*", "", data.decode(), flags=re.MULTILINE)
    forbidden = r"\b(?:fetch|eval|Function|require|importScripts)\s*\(|\$httpClient|\$task|\$persistentStore|\$prefs|\bconsole\s*[.\[]|\$notify|\$notification"
    if re.search(forbidden, text):
        raise ValueError("unexpected feed runtime capability")
    return lock


def render():
    lock = verify_sources()
    base = (ROOT / "build/khanh-rocket-v3-test.conf").read_text(encoding="utf-8")
    lines = base.splitlines()
    hooks = [line for line in lines if line.startswith("youtube.native.")]
    if len(hooks) != 2:
        raise ValueError("unexpected working YouTube hooks")
    feed = next(line for line in hooks if line.startswith("youtube.native.browse = "))
    uri = f"https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/{lock['ref']}/{SOURCE}"
    updated = re.sub(r"script-path=https://[^,\s]+", "script-path=" + uri, feed)
    compat = base.replace(feed, updated).replace(
        "#!name = Khanh Rocket V3 COMPAT CANARY",
        "#!name = Khanh Rocket YouTube V3 Feed Canary",
    ).replace(
        "#!desc = First-party JavaScript only. NOT verified on iPhone; NOT 10in1 parity.",
        "#!desc = Home/Next/Search feed canary. Working player preserved; device test required.",
    )
    compat = compat.replace("\n[Rule]", f"\n# Feed source: {lock['ref']}\n# Instructions: docs/YOUTUBE_V3_CANARY.md\n\n[Rule]", 1)
    sections = {}
    section = None
    for line in lines:
        if line.startswith("[") and line.endswith("]"):
            section = line
            sections[section] = []
        elif section:
            sections[section].append(line)
    header = [
        "#!name = Khanh Rocket YouTube Only V3",
        "#!desc = YouTube-only canary: preserved player plus revised feed filter. Device validation required.",
        "#!author = Vcab3011",
        "# Separate Shadowrocket profile; never import this .conf into Egern.",
        "# Working V3 Test and production URLs remain unchanged.",
        "# Instructions: docs/YOUTUBE_V3_CANARY.md",
        "# Feed source: " + lock["ref"],
        "",
    ]
    for name in ("[Rule]", "[Url Rewrite]"):
        header.extend([name, *sections[name]])
    header.extend(["[Script]", hooks[0], updated, "", "[Map Local]", *sections["[Map Local]"]])
    header.extend(["[MITM]", "hostname = *.googlevideo.com, youtubei.googleapis.com, www.youtube.com, s.youtube.com", ""])
    return dict(zip(TARGETS, (compat, "\n".join(header))))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    for name, content in render().items():
        target = ROOT / "build" / name
        if args.check:
            if not target.exists() or target.read_text(encoding="utf-8") != content:
                raise SystemExit("stale YouTube canary: " + name)
            print("Verified: build/" + name)
        else:
            target.write_text(content, encoding="utf-8")
            print("Built: build/" + name)


if __name__ == "__main__":
    main()

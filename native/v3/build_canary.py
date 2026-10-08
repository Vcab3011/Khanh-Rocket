#!/usr/bin/env python3
"""Build independently hosted, auditable Shadowrocket V3 canary configurations.

Inputs are the user-confirmed 10in1 config and immutable Git SHAs.
No remote fetch, no JS evaluation and no production writes.
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRODUCTION = ROOT / "build" / "khanh-rocket.conf"
DEST = ROOT / "native" / "v3" / "build"

V2_COMMIT = "d7d43523dd973c0184a70a3398935c15eef96648"
V3_COMMIT = "05f8ae6a3b96eae528b0c786d3de8ccbd0a978b0"
OWNER = "Vcab3011/Khanh-Rocket"

# Source names and tested first-party replacement. No third-party runtime JS.
FEATURES = {
    "youtube": ("youtube.response", "youtube-player-protobuf.js",
                ("*.googlevideo.com", "youtubei.googleapis.com", "www.youtube.com", "s.youtube.com")),
    "youtube-browse": ("youtube.response", "youtube-browse.js", ("youtubei.googleapis.com",)),
    "spotify-url": ("spotify-json", "spotify-json.js",
                    ("spclient.wg.spotify.com", "*spclient.spotify.com")),
    "spotify-protobuf": ("spotify-proto", "spotify-protobuf.js",
                         ("spclient.wg.spotify.com", "*spclient.spotify.com")),
    "soundcloud": ("SoundCloudGo+", "soundcloud-go.js", ("api-mobile.soundcloud.com",)),
    "alightmotion": ("AlightMotion", "alight-motion.js",
                     ("us-central1-alight-creative.cloudfunctions.net",)),
    "picsart": ("PicsArt", "picsart.js", ("api.picsart.com",)),
    "wink": ("Wink", "wink.js", ("api-sub.meitu.com",)),
    "truecaller": ("Truecaller", "truecaller.js", ("premium*.truecaller.com",)),
    "kinemaster": ("Kinemaster", "kinemaster.js", ("api-account.kinemasters.com",)),
    "camscanner": ("Camscanner", "camscanner.js", ("ap*.intsig.net",)),
    "beautyplus": ("BeautyPlus", "beautyplus.js",
                   ("api.mr.pixocial.com", "newbeee-api.beautyplus.com")),
    "locket": ("revenuecat", "locket-revenuecat.js", ("api.revenuecat.com",)),
    "revenuecat-header": ("deleteHeader", "revenuecat-header.js", ("api.revenuecat.com",)),
    "offline-subscriptions": ("Native Offline Subscriptions", "offline-subscriptions.js",
                              ("khanh.invalid",)),
}
PRIVACY = {"youtube", "youtube-browse", "spotify-url", "offline-subscriptions"}
COMPAT = set(FEATURES)
SHA = re.compile(r"^[0-9a-f]{40}$")


def sections(text: str) -> dict[str, list[str]]:
    groups = {}
    current = None
    for line in text.splitlines():
        cleaned = line.strip()
        if not cleaned or cleaned.startswith("#"):
            continue
        if cleaned.startswith("[") and cleaned.endswith("]"):
            current = cleaned[1:-1]
            if current in groups:
                raise ValueError("duplicate section")
            groups[current] = []
        elif current is not None:
            groups[current].append(cleaned)
    expected = ["Rule", "Header Rewrite", "Url Rewrite", "Script", "Map Local", "MITM"]
    if list(groups) != expected:
        raise ValueError("legacy section order changed")
    return groups


def source(feature: str, filename: str, v2_ref: str, v3_ref: str) -> str:
    ref, directory = (v3_ref, "v3") if feature in {"offline-subscriptions", "youtube-browse"} else (v2_ref, "v2")
    return f"https://raw.githubusercontent.com/{OWNER}/{ref}/native/{directory}/scripts/{filename}"


def build(profile: str, disabled: set[str] | None = None,
          v2_ref: str = V2_COMMIT, v3_ref: str = V3_COMMIT) -> str:
    if profile not in {"privacy", "compat"}:
        raise ValueError("invalid profile")
    if not SHA.fullmatch(v2_ref) or not SHA.fullmatch(v3_ref):
        raise ValueError("requires two immutable full commit SHA refs")
    disabled = disabled or set()
    if not disabled <= set(FEATURES):
        raise ValueError(f"unknown features: {disabled - set(FEATURES)}")

    selected = (PRIVACY if profile == "privacy" else COMPAT) - disabled
    legacy = sections(PRODUCTION.read_text(encoding="utf-8"))
    originals = {}
    for line in legacy["Script"]:
        if " = type=" in line:
            originals[line.split(" = type=", 1)[0]] = line

    script_lines = []
    for feature, (old_name, filename, hosts) in FEATURES.items():
        if feature not in selected:
            continue
        uri = source(feature, filename, v2_ref, v3_ref)
        if feature == "offline-subscriptions":
            pat = r"^https:\/\/khanh\.invalid\/v1\/(health|normalize)$"
            script_lines.append(
                f"Native Offline Subscriptions = type=http-request,pattern={pat},"
                f"requires-body=true,max-size=131072,timeout=10,script-path={uri}"
            )
        elif feature == "youtube-browse":
            pat = r"^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/(browse|next|search)(?:\?|$)"
            script_lines.append(
                f"youtube.native.browse = type=http-response,pattern={pat},"
                f"requires-body=true,max-size=5242880,binary-body-mode=1,timeout=10,script-path={uri}"
            )
        elif feature == "youtube":
            pat = r"^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/(player|get_watch|reel\/reel_watch_sequence)(?:\?|$)"
            script_lines.append(
                f"youtube.native.response = type=http-response,pattern={pat},"
                f"requires-body=true,max-size=5242880,binary-body-mode=1,timeout=10,script-path={uri}"
            )
        else:
            if old_name not in originals:
                raise ValueError(f"legacy handler missing: {old_name}")
            line = originals[old_name]
            line = re.sub(r"script-path=https://[^,\s]+", "script-path=" + uri, line)
            if feature == "spotify-protobuf":
                line = line.replace("max-size=0", "max-size=5242880")
            if feature in {"beautyplus", "locket"}:
                line = line.replace("max-size=-1", "max-size=262144")
            script_lines.append(line)

    has_youtube = "youtube" in selected or "youtube-browse" in selected
    rules = legacy["Rule"] if has_youtube else []
    rewrites = legacy["Url Rewrite"] if has_youtube else []
    map_local = legacy["Map Local"] if has_youtube else []

    # Keep only the Spotify cache-validator rewrite when protobuf hook is enabled.
    header_rewrites = (legacy["Header Rewrite"][2:3]
                       if "spotify-protobuf" in selected else [])

    hostnames = []
    for feature in FEATURES:
        if feature not in selected:
            continue
        for hostname in FEATURES[feature][2]:
            if hostname not in hostnames:
                hostnames.append(hostname)

    parts = [
        f"#!name = Khanh Rocket V3 {profile.upper()} CANARY",
        "#!desc = First-party JavaScript only. NOT verified on iPhone; NOT 10in1 parity.",
        "#!author = Vcab3011",
        "# Experimental isolated profile: NEVER overwrite build/khanh-rocket.conf.",
        "# No third-party JavaScript URLs; pinned first-party Git commits.",
        f"# V2 script SHA: {v2_ref}",
        f"# V3 manager SHA: {v3_ref}",
        "# HTTPS Decryption processes only the explicitly listed MITM hostnames.",
        "# RevenueCat interception is enabled ONLY if Locket/header module selected.",
        "# Synthetic account status is NOT a genuine server-side purchase.",
        f"# Enabled features: {','.join(sorted(selected)) or '(none)'}",
        "",
    ]
    for name, values in (
        ("Rule", rules),
        ("Header Rewrite", header_rewrites),
        ("Url Rewrite", rewrites),
        ("Script", script_lines),
        ("Map Local", map_local),
        ("MITM", ["hostname = " + ", ".join(hostnames)] if hostnames else []),
    ):
        parts.append(f"[{name}]")
        parts.extend(values)
        parts.append("")

    result = "\n".join(parts)
    # Assertions defend against accidentally shipping upstream scripts or broad inherited MITM.
    assert "/releases/latest/" not in result
    assert "duyvinh09/Module_IOS" not in result
    assert "app2smile/rules" not in result
    assert "%APPEND%" not in result
    assert "sub.store" not in result
    for line in script_lines:
        assert "script-path=https://raw.githubusercontent.com/" + OWNER + "/" in line
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=("privacy", "compat"), required=True)
    parser.add_argument("--disable", action="append", default=[], choices=sorted(FEATURES))
    parser.add_argument("--v2-ref", default=V2_COMMIT)
    parser.add_argument("--v3-ref", default=V3_COMMIT)
    parser.add_argument("--check", action="store_true", help="compare generated text, do not write")
    args = parser.parse_args()
    generated = build(args.profile, set(args.disable), args.v2_ref, args.v3_ref)
    output = DEST / f"{args.profile}-canary.conf"
    if args.check:
        if not output.exists() or output.read_text(encoding="utf-8") != generated:
            raise SystemExit(f"stale or missing canary: {output}")
        print(f"Verified: {output.relative_to(ROOT)}")
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(generated, encoding="utf-8")
        print(f"Built: {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

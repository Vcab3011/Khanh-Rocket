#!/usr/bin/env python3
"""Build three standalone Egern scripts; no network and no production writes."""
from __future__ import annotations
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "core" / "observer-core.js"
TARGETS = {
    "egern-observer": ROOT / "runtime" / "egern-observer.template.js",
    "egern-status": ROOT / "runtime" / "egern-status.template.js",
    "egern-reset": ROOT / "runtime" / "egern-reset.template.js",
}

def render() -> dict[str, str]:
    source = CORE.read_text(encoding="utf-8").strip()
    if "fetch(" in source or "$httpClient" in source or "$task.fetch" in source:
        raise ValueError("network primitives not allowed in pure core")
    results = {}
    for name, template in TARGETS.items():
        text = template.read_text(encoding="utf-8")
        expected = 0 if name == "egern-reset" else 1
        if text.count("__KHANH_CORE__") != expected:
            raise ValueError("missing or duplicate core placeholder")
        result = text.replace("__KHANH_CORE__", source)
        if "ctx.http." in result or "$httpClient" in result or "eval(" in result:
            raise ValueError("unsafe network or code evaluation")
        results[name] = result
    return results

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    targets = render()
    dest = ROOT / "build"
    if not args.check:
        dest.mkdir(parents=True, exist_ok=True)
    for name, content in targets.items():
        path = dest / (name + ".js")
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                raise SystemExit("Stale Egern bundle: " + str(path))
            print("Verified: " + str(path.relative_to(ROOT)))
        else:
            path.write_text(content, encoding="utf-8")
            print("Built: " + str(path.relative_to(ROOT)))

if __name__ == "__main__":
    main()

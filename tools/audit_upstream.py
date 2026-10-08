#!/usr/bin/env python3
"""Non-executing metadata inventory of upstream Shadowrocket script URLs.
Reads remote plaintext assets solely as bytes; does not import or run JS.
"""
import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = "https://raw.githubusercontent.com/Gaucuto/ver2promax/70a1343587324ff5a17195d8847ce55001f9ed44/10in1"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "KhanhRocket-Audit/0.1"})
    with urllib.request.urlopen(req, timeout=25) as response:
        content = response.read(3 * 1024 * 1024 + 1)
    if len(content) > 3 * 1024 * 1024:
        raise ValueError("asset exceeds 3 MiB safety cap")
    return content

def inventory():
    content = fetch(URL)
    config = content.decode("utf-8")
    rows = []
    section = ""
    for line in config.splitlines():
        line = line.strip()
        if line.startswith("[") and line.endswith("]"):
            section = line
            continue
        if section != "[Script]" or line.startswith("#") or "script-path=" not in line:
            continue
        match = re.search(r"script-path=(https?://[^,\s]+)", line)
        if not match:
            continue
        name = line.split("=", 1)[0].strip()
        url = match.group(1)
        record = {"name": name, "url": url}
        try:
            js = fetch(url)
            record.update({"size_bytes": len(js), "sha256": hashlib.sha256(js).hexdigest(), "ok": True})
        except Exception as exc:
            record.update({"ok": False, "error": str(exc)[:160]})
        rows.append(record)
    return {"config_url": URL, "config_sha256": hashlib.sha256(content).hexdigest(), "script_declarations": len(rows), "scripts": rows}

if __name__ == "__main__":
    out = ROOT / "build" / "upstream_network_inventory.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    results = inventory()
    out.write_text(json.dumps(results, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved {len(results['scripts'])} script records in {out}")

#!/usr/bin/env python3
"""Static check for Khanh Rocket's intentionally small .conf subset."""
import sys
from pathlib import Path

ALLOWED = {"DIRECT", "PROXY", "REJECT"}

def validate(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    errors = []
    if any(k in text.lower() for k in ("[script]", "[mitm]", "[url rewrite]", "[header rewrite]")):
        errors.append("active script/MITM/rewrite sections are forbidden in baseline")
    lines = [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("#")]
    if lines.count("[Rule]") != 1:
        errors.append("expected one [Rule] section")
    rules = [ln for ln in lines if not ln.startswith("[")]
    finals = [i for i, ln in enumerate(rules) if ln.startswith("FINAL,")]
    if finals != [len(rules)-1]:
        errors.append("exactly one FINAL rule must be last")
    for line in rules:
        fields = [f.strip() for f in line.split(",")]
        typ = fields[0]
        if typ == "FINAL":
            if len(fields) != 2 or fields[-1] not in {"DIRECT", "PROXY"}:
                errors.append(f"invalid final rule: {line}")
        elif typ == "DOMAIN-SUFFIX":
            if len(fields) != 3 or fields[2] not in ALLOWED or not fields[1]:
                errors.append(f"invalid domain rule: {line}")
        elif typ == "IP-CIDR":
            if len(fields) != 4 or fields[2] != "DIRECT" or fields[3] != "no-resolve":
                errors.append(f"invalid private-network exception: {line}")
        else:
            errors.append(f"unsupported rule: {line}")
    return errors

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: python tools/validate.py build/<name>.conf")
    problems = validate(Path(sys.argv[1]))
    if problems:
        print("FAIL:\n- " + "\n- ".join(problems))
        raise SystemExit(1)
    print("PASS: configuration passes baseline static checks")

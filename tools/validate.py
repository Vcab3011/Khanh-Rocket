#!/usr/bin/env python3
"""Fail closed on unexpected syntax in generated Shadowrocket rulesets."""
import ipaddress
import re
import sys
from pathlib import Path

DOMAIN = re.compile(r'^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$')
FORBIDDEN_SECTIONS = {'[script]', '[mitm]', '[url rewrite]', '[header rewrite]', '[map local]', '[body rewrite]'}


def validate_text(content: str):
    problems = []
    lines = [s.strip() for s in content.splitlines() if s.strip() and not s.strip().startswith('#')]
    sections = [s for s in lines if s.startswith('[')]
    if sections != ['[Rule]']:
        problems.append('expected a single [Rule] section and no other sections')
    if any(s.lower() in FORBIDDEN_SECTIONS for s in sections):
        problems.append('interception / script sections are not allowed')
    rules = [s for s in lines if not s.startswith('[')]
    final_positions = [i for i, s in enumerate(rules) if s.startswith('FINAL,')]
    if final_positions != [len(rules)-1]:
        problems.append('exactly one FINAL must be last')
    for rule in rules:
        args = rule.split(',')
        typ = args[0]
        if typ == 'FINAL':
            if len(args) != 2 or args[1] not in ('DIRECT', 'PROXY'):
                problems.append('bad FINAL: '+rule)
        elif typ in ('DOMAIN', 'DOMAIN-SUFFIX'):
            if len(args) != 3 or not DOMAIN.fullmatch(args[1]) or args[2] not in ('DIRECT', 'PROXY', 'REJECT'):
                problems.append('bad domain rule: '+rule)
        elif typ == 'IP-CIDR':
            if len(args) != 4 or args[2] != 'DIRECT' or args[3] != 'no-resolve':
                problems.append('bad IP-CIDR: '+rule)
            else:
                try:
                    if not ipaddress.ip_network(args[1]).is_private:
                        problems.append('non-private DIRECT CIDR: '+rule)
                except ValueError:
                    problems.append('bad CIDR: '+rule)
        else:
            problems.append('unsupported rule: '+rule)
    if len(rules) != len(set(rules)):
        problems.append('duplicate rules')
    return problems


def validate(path: Path):
    return validate_text(path.read_text(encoding='utf-8'))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('usage: python tools/validate.py build/filename.conf')
    faults = validate(Path(sys.argv[1]))
    if faults:
        print('FAIL:\n- ' + '\n- '.join(faults))
        raise SystemExit(1)
    print('PASS: static validation succeeded')

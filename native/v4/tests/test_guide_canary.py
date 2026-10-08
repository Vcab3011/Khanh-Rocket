"""Protect V3 main/test baseline and the exact V4-only Guide scope."""
from pathlib import Path
import hashlib
import re
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[3]
BASE_SHA="ba5812d913bc26eb13485f91b1593295a0921e76"
GUIDE_SHA="2fc7ccf96ec1a3d288a307e411b9249a74b51486"
BASE_PATH="build/khanh-rocket-v3-test.conf"
V4_PATH="native/v4/build/guide-canary.conf"
SCRIPT="native/v4/scripts/youtube-guide.js"

def git_show(ref,path):
    return subprocess.check_output(["git","show",f"{ref}:{path}"],cwd=ROOT,timeout=10)

class V4Isolation(unittest.TestCase):
    def test_exact_isolated_profile_diff(self):
        baseline=git_show(BASE_SHA,BASE_PATH).decode()
        canary=(ROOT/V4_PATH).read_text(encoding="utf8")
        self.assertIn("Khanh Rocket V3 r3 COMPAT CANARY",baseline)
        self.assertIn("Khanh Rocket V4 GUIDE CANARY (isolated)",canary)
        self.assertEqual(canary.count("youtube.native.guide = "),1)
        guide=next(line for line in canary.splitlines() if line.startswith("youtube.native.guide = "))
        self.assertIn("https://raw.githubusercontent.com/Vcab3011/Khanh-Rocket/"+GUIDE_SHA+"/"+SCRIPT,guide)
        self.assertIn("binary-body-mode=1",guide)
        self.assertIn("max-size=5242880",guide)
        expected=baseline.replace("Khanh Rocket V3 r3 COMPAT CANARY","Khanh Rocket V4 GUIDE CANARY (isolated)",1).replace("\n[Map Local]\n","\n"+guide+"\n\n[Map Local]\n",1)
        self.assertEqual(canary,expected)
        self.assertEqual(len([l for l in canary.splitlines() if "type=http-response" in l and "youtube.native." in l]),2)

    def test_script_commit_stable_and_pinned(self):
        raw=(ROOT/SCRIPT).read_bytes()
        original=git_show(GUIDE_SHA,SCRIPT)
        self.assertEqual(raw,original)
        self.assertIn(b"117866661",raw)
        self.assertIn(b"318370163",raw)
        self.assertNotIn(b"$httpClient",raw)
        self.assertNotIn(b"$persistentStore",raw)

    def test_main_baseline_hash_immutable(self):
        original=(ROOT/"build/khanh-rocket.conf").read_bytes()
        h=hashlib.sha1(b"blob "+str(len(original)).encode()+b"\0"+original).hexdigest()
        self.assertEqual(h,"e1f1f71ef4e9c0fa88ef68ffafecb02c81153a29")
        self.assertEqual((ROOT/BASE_PATH).read_bytes(),git_show(BASE_SHA,BASE_PATH))

    def test_script_and_profile_dont_intercept_unrelated_hosts(self):
        src=(ROOT/SCRIPT).read_text(encoding="utf8")
        self.assertNotIn("api.revenuecat.com",src)
        self.assertNotIn("sub.store",src)
        profile=(ROOT/V4_PATH).read_text(encoding="utf8")
        self.assertEqual(profile.count("youtube.native.guide = "),1)
        self.assertFalse(re.search(r"script-path=https?://(?:?!raw\\.githubusercontent).*guide",profile))

if __name__=="__main__":
    unittest.main()

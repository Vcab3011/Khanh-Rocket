#!/usr/bin/env python3
"""Deterministically compose reviewed V3 R3 YouTube engine + optional V4 captions.

No external downloads, remote JavaScript imports, production writes or network.
Only native/v4/scripts/youtube-response-r4.js is written without --check.
"""
from pathlib import Path
import argparse
import hashlib

ROOT=Path(__file__).resolve().parents[3]
R3=ROOT/"native/v3/scripts/youtube-response-r3.js"
COMP=ROOT/"native/v4/components/youtube-caption-compat.js"
OUT=ROOT/"native/v4/scripts/youtube-response-r4.js"
R3_SHA256="e007244ed4436ffa2e97c3ed4cc3e20771ff6a7835e29db0db136c81c3566642"
BASE=" var answer={};"
FLAG="if(!conflict && (known===200 || (s===undefined && known===null))){"
INSERT=" }catch(_){}\n try {\n  if(route && typeof console"
PIPE=''' }catch(_){}
 // V4 optional metadata-only caption track attachment after R3 processing.
 try {
  var captionLangV4="vi";
  if(typeof $argument==="string" && $argument.length<512){
   try {
    var argsV4=JSON.parse($argument);
    if(argsV4 && typeof argsV4.captionLang==="string")captionLangV4=argsV4.captionLang;
   }catch(_){}
  }
  if(canEnhanceV4 && route && /^(player|get_watch)$/.test(route[1]) && captionLangV4!=="off"){
   var capSource=asBytes(answer.body!==undefined?answer.body:
    (response.bodyBytes!==undefined?response.bodyBytes:response.body));
   if(capSource && capSource.length && capSource.length<=5242880){
    var captionResult=khanhCaptionV4(capSource,route[1],captionLangV4);
    if(captionResult.changed)answer={body:captionResult.bytes};
   }
  }
 }catch(_){}
 try {
  if(route && typeof console'''
def render():
    original=R3.read_bytes()
    if hashlib.sha256(original).hexdigest()!=R3_SHA256:
        raise ValueError("V3 r3 source hash mismatch — review before rebuilding")
    source=original.decode("utf8")
    component=COMP.read_text("utf8").strip()
    if "function khanhCaptionV4(" not in component: raise ValueError("missing caption helper")
    for needle in (BASE,FLAG,INSERT):
        if source.count(needle)!=1: raise ValueError("unexpected R3 source anchor: "+needle)
    source=source.replace(BASE,BASE+"\n var canEnhanceV4=false;",1)
    source=source.replace(FLAG,FLAG+"\n     canEnhanceV4=true;",1)
    source=source.replace(INSERT,PIPE,1)
    end=source.rfind("\n})();")
    source=source[:end]+"\n"+component+"\n"+source[end:]
    return ("/* Generated from SHA-256 locked first-party YouTube R3 and "
            "V4 caption source. No copied third-party runtime. */\n"+source)
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--check",action="store_true")
    args=p.parse_args()
    expected=render()
    if args.check:
        if not OUT.exists() or OUT.read_text("utf8")!=expected:
            raise SystemExit("Stale V4 YouTube bundle; run builder in feature branch")
        print("Verified deterministic V4 R3-plus-captions bundle")
    else:
        OUT.parent.mkdir(exist_ok=True,parents=True)
        OUT.write_text(expected,encoding="utf8")
        print("Generated native/v4/scripts/youtube-response-r4.js")
if __name__=="__main__":main()

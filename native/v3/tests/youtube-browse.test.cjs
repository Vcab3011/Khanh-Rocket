"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const code=fs.readFileSync(path.resolve(__dirname,"../scripts/youtube-browse.js"),"utf8");
function vi(n){let v=[];do{let b=n%128;n=Math.floor(n/128);v.push(n?b+128:b)}while(n);return Uint8Array.from(v)}
function join(...arr){let l=arr.reduce((n,x)=>n+x.length,0),v=new Uint8Array(l),p=0;for(const a of arr){v.set(a,p);p+=a.length}return v}
function field(id,v){return join(vi(id*8+2),vi(v.length),v)}
function valueOf(b,id){
  let p=0,ret=[];function n(){let val=0,m=1;while(true){let c=b[p++];if(c===undefined)throw Error("missing bytes");val+=(c&127)*m;if(!(c&128))return val;m*=128;}}
  while(p<b.length){let tag=n(),no=Math.floor(tag/8),wire=tag%8,d;
    if(wire===2){let len=n();d=b.slice(p,p+len);p+=len}
    else if(wire===0){n();continue}
    else throw Error("unexpected wire");
    if(no===id)ret.push(d);
  }
  return ret;
}
function invoke(kind,bytes,status=200){
 const returns=[],ctx={
   $request:{url:"https://youtubei.googleapis.com/youtubei/v1/"+kind,method:"POST"},
   $response:{body:bytes,status},
   $done:obj=>returns.push(obj),
   Uint8Array,ArrayBuffer,Number,Object,Math,String
 };
 vm.runInNewContext(code,ctx,{timeout:2000});
 assert.equal(returns.length,1);return returns[0];
}
const opaque=field(121,Uint8Array.from(Buffer.concat([Buffer.from("pagead"),Buffer.alloc(1100)])));
const good=field(153515154,field(5,Uint8Array.from(Buffer.from("normal video"))));
const section=field(50195462,join(field(1,good),field(1,opaque)));
const browseContent=field(49399797,field(1,section));
const browse=field(9,browseContent);

test("Browse removes only a strong ad marker in an unknown large field",()=>{
 const out=invoke("browse",browse);
 assert.ok(out.body instanceof Uint8Array);
 const itemSection=valueOf(valueOf(valueOf(out.body,9)[0],49399797)[0],1)[0];
 const items=valueOf(valueOf(itemSection,50195462)[0],1);
 assert.equal(items.length,1);
 assert.deepEqual([...items[0]],[...good]);
});
test("Next/Search shares typed subtree and never filters unmatched content",()=>{
 const next=field(7,field(51779735,field(1,browseContent)));
 const result=invoke("next",next);
 assert.ok(result.body instanceof Uint8Array);
 const search=field(4,browseContent);
 assert.ok(invoke("search",search).body instanceof Uint8Array);
 assert.deepEqual(invoke("browse",field(9,field(49399797,field(1,field(50195462,field(1,good)))))),{});
});
test("Malformation and non-matching routes fall through safely",()=>{
 assert.deepEqual(invoke("browse",Uint8Array.from([255])),{});
 assert.deepEqual(invoke("browse",browse,503),{});
 assert.deepEqual(invoke("player",browse),{});
});
test("Large unrecognized protobuf objects are kept rather than globally scanning all bytes",()=>{
 const unknown=field(999,opaque);
 assert.deepEqual(invoke("browse",unknown),{});
});

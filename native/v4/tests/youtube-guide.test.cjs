"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.resolve(__dirname,"../scripts/youtube-guide.js"),"utf8");
function varint(n){const a=[];do{let v=n%128;n=Math.floor(n/128);a.push(n?v+128:v);}while(n);return Buffer.from(a);}
function join(...a){return Buffer.concat(a);}
function f(n,b){return join(varint(n*8+2),varint(b.length),b);}
function item(id,fieldNo=318370163){return f(fieldNo,f(1,Buffer.from(id,"utf8")));}
function root(...entries){return join(f(4,f(117866661,join(...entries.map(x=>f(1,x))))),f(188,Buffer.from("unknown-field")));}
function decoded(b){let offset=0,out=[];function read(){let n=0,m=1;while(true){if(offset>=b.length)throw Error("end");let x=b[offset++];n+=(x&127)*m;if(!(x&128))return n;m*=128;}}
 while(offset<b.length){let tag=read(),id=Math.floor(tag/8),wire=tag%8;let value;if(wire===2){let len=read();value=b.subarray(offset,offset+len);offset+=len;}else if(wire===0)value=read();else throw Error("wire");out.push({id,wire,value});}return out;}
function extractIds(b){let first=decoded(b).find(x=>x.id===4);let section=decoded(first.value).find(x=>x.id===117866661);
 return decoded(section.value).filter(x=>x.id===1).map(x=>{let r=decoded(x.value)[0];return decoded(r.value)[0].value.toString("utf8");});}
function run(body,{url="https://youtubei.googleapis.com/youtubei/v1/guide",method="POST",status=200,arg,other=false}={}){
 let calls=[],sandbox={$request:{url,method},$response:{status,body:Uint8Array.from(body)},
  $done:(v)=>calls.push(v)};
 if(arg!==undefined)sandbox.$argument=arg;
 if(other) sandbox.$response.body="binary-broken";
 vm.runInNewContext(source,sandbox,{timeout:500});
 assert.equal(calls.length,1,"must finish exactly once");
 return calls[0];
}
test("Guide filter only drops named menu entries and keeps other entries and opaque root fields",()=>{
 const input=root(item("FEuploads"),item("home"),item("FEmusic_immersive",117501096),item("SPunlimited"),item("FEshorts"));
 const result=run(input);
 assert.ok(result.body);
 const modified=Buffer.from(result.body);
 assert.deepEqual(extractIds(modified),["home","FEshorts"]);
 assert.ok(modified.includes(Buffer.from("unknown-field")));
});
test("argument switches blockShorts and disable upload/immersive filtering",()=>{
 const input=root(item("FEuploads"),item("FEmusic_immersive"),item("SPunlimited"),item("FEshorts"));
 const r=run(input,{arg:JSON.stringify({blockUpload:false,blockImmersive:false,blockShorts:true})});
 assert.deepEqual(extractIds(Buffer.from(r.body)),["FEuploads","FEmusic_immersive"]);
});
test("no changes for normal Guide entries; no original payload rewrite",()=>{
 let input=root(item("home"),item("subscriptions"));
 assert.deepEqual(run(input),{});
});
test("wrong hostname/path/method/error status and incompatible body safely pass",()=>{
 let b=root(item("FEuploads"));
 for(const opts of [{url:"https://youtubei.googleapis.com.evil.org/youtubei/v1/guide"},
 {url:"https://youtubei.googleapis.com/youtubei/v1/guide_extra"},{method:"GET"},{status:404},
 {status:"HTTP/1.1 503 Service Unavailable"},{other:true}])
   assert.deepEqual(run(b,opts),{},JSON.stringify(opts));
});
test("accepts common Shadowrocket HTTP 200 response status syntax",()=>{
 const b=root(item("FEuploads"));
 assert.ok(run(b,{status:"HTTP/1.1 200 OK"}).body);
});
test("unknown field order and bytes are preserved, including multiple Guide sections",()=>{
 const more=f(6,f(117866661,join(f(1,item("FEuploads")),f(1,item("library")))));
 const input=join(root(item("FEmusic_immersive"),item("home")),more);
 const result=Buffer.from(run(input).body);
 assert.deepEqual(extractIds(result),["home"]);
 assert.ok(result.includes(Buffer.from("library")));
});
test("malformed binary and large response fail open",()=>{
 assert.deepEqual(run(Buffer.from([0xff])),{});
 assert.deepEqual(run(Buffer.alloc(5242881,0)),{});
 assert.deepEqual(run(Buffer.from([31,139,8,0])),{});
});
test("scripts contain no network clients, purchase simulation, storage or dynamic eval",()=>{
 for(const keyword of ["$httpClient","fetch(","ctx.http","$persistentStore","$prefs","eval(","new Function","store_transaction_id","subscriber","receipt","Gold"]){
   assert.ok(!source.includes(keyword),keyword);
 }
});

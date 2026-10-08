"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.resolve(__dirname,"../scripts/subscriptions-convert.js"),"utf8");
const encode=s=>Buffer.from(s,"utf8").toString("base64url");
const ss="ss://"+encode("aes-256-gcm:Secret#123")+"@ss.example.net:443#SS%20One";
const trojan="trojan://"+encodeURIComponent("pass@word")+"@trojan.example.net:443?security=tls&sni=front.example.net#T";
const vmess="vmess://"+encode(JSON.stringify({v:"2",ps:"VMess",add:"vmess.example.net",port:"443",
 id:"00000000-0000-4000-8000-000000000042",aid:"0",net:"ws",host:"front.example.net",path:"/ws",tls:"tls"}));
function call(input,{url="https://khanh.invalid/v2/convert",method="POST",type="application/json"}={}){
  const values=[];
  const context={$request:{url,method,headers:{"Content-Type":type},body:JSON.stringify(input)},$done:v=>values.push(v)};
  vm.runInNewContext(source,context,{timeout:800});
  assert.equal(values.length,1);
  return JSON.parse(JSON.stringify(values[0]));
}
function payload(input,opts){const res=call(input,opts);return res.response?{status:res.response.status,value:JSON.parse(res.response.body)}:res;}
test("local-only converter supports SS Trojan and modern VMess, retains only validated metadata in output",()=>{
 const r=payload({links:[ss,trojan,vmess],output:"json"});
 assert.equal(r.status,200);
 assert.equal(r.value.count,3);
 assert.deepEqual(r.value.data.map(x=>x.protocol),["ss","trojan","vmess"]);
 assert.equal(r.value.data[0].password,"Secret#123");
 assert.equal(r.value.data[1].sni,"front.example.net");
 assert.equal(r.value.data[2].network,"ws");
});
test("converts proxy URIs into basic Clash YAML without external requests",()=>{
 const r=payload({links:[ss,trojan,vmess],output:"clash"});
 assert.equal(r.status,200);
 assert.equal(r.value.count,3);
 const yaml=r.value.data;
 assert.ok(yaml.includes("proxies:"));
 assert.ok(yaml.includes('name: "SS One"'));
 assert.ok(yaml.includes('skip-cert-verify: false'));
 assert.ok(yaml.includes('ws-opts:'));
 assert.ok(yaml.includes('Host: "front.example.net"'));
});
test("canonical share URI round-trip produces valid nodes and deduplicates",()=>{
 const first=payload({links:[ss,trojan,vmess,ss],output:"uri"});
 assert.equal(first.status,200);assert.equal(first.value.count,3);
 const second=payload({links:first.value.data.split("\n"),output:"json"});
 assert.equal(second.status,200);assert.equal(second.value.count,3);
 assert.equal(second.value.data[0].name,"SS One");
 assert.equal(second.value.data[1].protocol,"trojan");
 assert.equal(second.value.data[2].uuid,"00000000-0000-4000-8000-000000000042");
});
test("rejects unsupported schemes, dangerous/invalid protocols and noncanonical input with generic errors",()=>{
 const bad=["http://example.net/list","file:///etc/passwd",
 "ss://"+encode("rc4-md5:weak")+"@server.example.org:443#bad",
 "trojan://bad@server.example.net:443?allowInsecure=true",
 "vmess://"+encode(JSON.stringify({v:"2",ps:"bad",add:"host.example.org",port:80,id:"00000000-0000-4000-8000-000000000042",aid:"64"})),
 "trojan://pwd@server.example.org:65536?security=tls","ss://*notbase64*@server.example.org:443#bad"];
 for(const value of bad){
  const r=payload({links:[value],output:"json"});
  assert.equal(r.status,422,value);assert.equal(r.value.error,"invalid_subscription");
  assert.ok(!JSON.stringify(r.value).includes("pwd"));
 }
});
test("enforces method, content-type, local-only hostname and source limits",()=>{
 assert.deepEqual(call({links:[ss],output:"json"},{url:"https://khanh.invalid.evil.com/v2/convert"}),{});
 assert.equal(payload({links:[ss],output:"json"},{method:"GET"}).status,405);
 assert.equal(payload({links:[ss],output:"json"},{type:"text/plain"}).status,415);
 assert.equal(payload({links:Array(201).fill(ss),output:"json"}).status,422);
});
test("invalid percent encoding, hostile JSON fields and unicode controls safely reject",()=>{
 for(const s of ["trojan://abc%XX@host.example.org:443","trojan://abc@host.example.org:443?__proto__=yes",
  "ss://"+encode("aes-128-gcm:p")+"@bad..host:80"]){
   assert.equal(payload({links:[s],output:"json"}).status,422);
 }
});
test("no network access, dynamic eval, URL fetch, local persistence or untrusted imports",()=>{
 for(const term of ["$httpClient","$task.fetch","ctx.http","XMLHttpRequest","fetch(","eval(","new Function","import(","require(","$persistentStore","$prefs","console.","crypto.subtle"]){
   assert.equal(source.includes(term),false,term);
 }
});

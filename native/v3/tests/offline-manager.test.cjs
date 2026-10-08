"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const FILE = path.resolve(__dirname, "../scripts/offline-subscriptions.js");
const JS = fs.readFileSync(FILE,"utf8");
const ORIGIN = "https://khanh.invalid/v1/";
function run(url,method="GET",body,extraHeaders={}){
  const calls=[];
  const sandbox={
    $request:{url,method,headers:extraHeaders,body},
    $done:value=>calls.push(value),
    // Deliberately omit all outgoing-network, storage and logging APIs.
  };
  vm.runInNewContext(JS,sandbox,{filename:FILE,timeout:1000});
  assert.equal(calls.length,1,"Shadowrocket $done must execute exactly once");
  return JSON.parse(JSON.stringify(calls[0] || {}));
}
function request(nodes){
  const event=run(ORIGIN+"normalize","POST",JSON.stringify({nodes}),{"Content-Type":"application/json"});
  return {status:event.response.status,data:JSON.parse(event.response.body),headers:event.response.headers};
}
test("health is local and explicitly reports no network/storage capabilities",()=>{
  const response=run(ORIGIN+"health");
  assert.equal(response.response.status,200);
  const json=JSON.parse(response.response.body);
  assert.equal(json.remoteFetch,false);assert.equal(json.storage,false);
  assert.equal(response.response.headers["Cache-Control"],"no-store");
});
test("normalizes SS userinfo into standard SIP002 share URI",()=>{
  const r=request([{protocol:"ss",server:"edge.example.org",port:8388,
    method:"aes-256-gcm",password:"safe:pass%",name:"Canada Node"}]);
  assert.equal(r.status,200);assert.equal(r.data.count,1);
  const match=r.data.subscription.match(/^ss:\/\/([^@]+)@edge\.example\.org:8388#Canada%20Node$/);
  assert.ok(match);
  assert.equal(Buffer.from(match[1],"base64url").toString("utf8"),"aes-256-gcm:safe:pass%");
});
test("normalizes Trojan TLS and VMess without transmitting credentials",()=>{
  const r=request([
    {protocol:"trojan",server:"edge.example.org",port:443,password:"t@pass",sni:"cdn.example.org",name:"Trojan"},
    {protocol:"vmess",server:"edge.example.org",port:"443",
      uuid:"bb8b7df1-4043-49c0-9758-f51b3ab835ad",
      tls:true,network:"ws",path:"/ws",name:"VMess",wsHost:"cdn.example.org"}
  ]);
  assert.equal(r.status,200);
  const lines=r.data.subscription.split("\n");
  assert.match(lines[0],/^trojan:\/\/t%40pass@edge\.example\.org:443\?security=tls&sni=cdn\.example\.org/);
  const parsed=JSON.parse(Buffer.from(lines[1].slice(8),"base64url").toString("utf8"));
  assert.equal(parsed.net,"ws");assert.equal(parsed.path,"/ws");
  assert.equal(parsed.id,"bb8b7df1-4043-49c0-9758-f51b3ab835ad");
});
test("disallows unknown endpoints/methods/content types",()=>{
  assert.deepEqual(run("https://example.net/v1/health"),{});
  assert.equal(run(ORIGIN+"health","POST").response.status,405);
  assert.equal(run(ORIGIN+"normalize","GET").response.status,405);
  assert.equal(run(ORIGIN+"normalize","POST",JSON.stringify({nodes:[]}),{"Content-Type":"text/plain"}).response.status,415);
});
test("rejects malicious or malformed nodes atomically, without leaking input",()=>{
  const attack=[
    {protocol:"ss",server:"good.example",port:443,method:"aes-256-gcm",password:"password",name:"good"},
    {protocol:"trojan",server:"bad.example\nFake = evil",port:443,password:"secret"}
  ];
  const response=request(attack);
  assert.equal(response.status,422);
  assert.equal(response.data.ok,false);
  assert.ok(!JSON.stringify(response).includes("password"));
  for(const node of [
    {protocol:"ss",server:"evil.example",port:443,method:"rc4-md5",password:"x"},
    {protocol:"ss",server:"evil.example",port:0,method:"aes-256-gcm",password:"x"},
    {protocol:"trojan",server:"evil.example/steal",port:443,password:"x"},
    {protocol:"vmess",server:"edge.example.org",port:443,uuid:"not-a-uuid"}
  ])assert.equal(request([node]).status,422);
});
test("handles malformed and oversized JSON safely",()=>{
  const invalid=run(ORIGIN+"normalize","POST","{not-valid",{"Content-Type":"application/json"});
  assert.equal(invalid.response.status,422);
  assert.equal(run(ORIGIN+"normalize","POST","x".repeat(131073),{"content-type":"application/json"}).response.status,413);
  assert.equal(request(Array.from({length:201},(_,i)=>({protocol:"ss",server:"edge.example.org",port:443,method:"aes-256-gcm",password:"x",name:"n"+i}))).status,422);
});
test("no globals for network, storage or logs are available to the evaluated code",()=>{
  const suspicious=["$task.fetch","$httpClient","$persistentStore","$prefs","globalThis.fetch","XMLHttpRequest","require(","eval("];
  const active=JS.replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*\/\/.*$/gm,"");
  for(const word of suspicious)assert.equal(active.includes(word),false,"unexpected risky primitive "+word);
});

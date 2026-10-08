"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
async function load(name) {
 const code=fs.readFileSync(path.join(root,"build",name+".js"),"utf8");
 return (await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"))).default;
}
const stamp=Date.now();
const locket="https://api.revenuecat.com/v1/subscribers/my-secret-account";
const sc="https://api-mobile.soundcloud.com/configuration/ios";
const yt="https://youtubei.googleapis.com/youtubei/v1/player";
function mock({url=locket,ua="Locket iOS",body='{"subscriber":{"entitlements":{"Gold":{"expires_date":"2026-12-01"}}}}',status=200,contentType="application/json"}={}) {
 const db=new Map(),calls={reads:0,writes:0,gets:0};
 const headers={get:(name)=>name.toLowerCase()==="user-agent"?ua:null};
 const ctx={
   request:{url,headers},
   response:{status,headers:{get:(name)=>name.toLowerCase()==="content-type"?contentType:null},
     text:async()=>{calls.reads++;if(calls.reads>1)throw Error("stream consumed twice");return body}},
   storage:{getJSON:(key)=>{calls.gets++;return db.get(key)},
     setJSON:(key,data)=>{calls.writes++;db.set(key,data)}}
 };
 return {ctx,calls,db,body};
}
test("generated Egern observer is a runnable native ES-module",async()=>{
 const f=await load("egern-observer");
 assert.equal(typeof f,"function");
});
test("Egern reads valid Locket body once, restores exact raw body, stores only permitted metadata",async()=>{
 const f=await load("egern-observer"),m=mock();
 const r=await f(m.ctx);
 assert.equal(r.body,m.body);
 assert.equal(m.calls.reads,1);assert.equal(m.calls.writes,1);
 const data=m.db.get("khanh.multiapp.events.v1");
 assert.equal(data.length,1);
 assert.equal(data[0].goldFieldPresent,true);
 for(const secret of ["my-secret-account","2026-12-01","Locket iOS"]){
  assert.ok(!JSON.stringify(data).includes(secret),secret);
 }
});
test("Egern unrelated app on shared RevenueCat domain never reads or stores",async()=>{
 const f=await load("egern-observer"),m=mock({ua:"NotTheApp"});
 assert.equal(await f(m.ctx),undefined);
 assert.equal(m.calls.reads,0);assert.equal(m.calls.writes,0);
});
test("Egern SoundCloud configuration is observed without rewriting config",async()=>{
 const f=await load("egern-observer"),m=mock({url:sc,ua:"SoundCloud",body:'{"plan":{"plan_id":"high_tier"},"features":[{"name":"offline_sync","enabled":true}]}'} );
 const r=await f(m.ctx);
 assert.equal(r.body,m.body);
 assert.equal(m.db.get("khanh.multiapp.events.v1")[0].featureCount,1);
});
test("Egern YouTube does not consume or overwrite protobuf binary stream",async()=>{
 const f=await load("egern-observer"),m=mock({url:yt,ua:"YouTube",contentType:"application/x-protobuf"});
 assert.equal(await f(m.ctx),undefined);
 assert.equal(m.calls.reads,0);
 assert.equal(m.db.get("khanh.multiapp.events.v1")[0].format,"protobuf");
});
test("Egern malformed JSON returns exact response for uninterrupted app",async()=>{
 const f=await load("egern-observer"),m=mock({body:"{invalid json"});
 assert.equal((await f(m.ctx)).body,m.body);
 assert.equal(m.calls.writes,1);
 assert.equal(m.db.get("khanh.multiapp.events.v1")[0].outcome,"invalid-json");
});
test("Egern errors and wrong content types preserve response and do not inspect body",async()=>{
 const f=await load("egern-observer");
 for(const setup of [{status:503},{contentType:"application/octet-stream"}]) {
  const m=mock(setup),r=await f(m.ctx);
  assert.equal(r,undefined);
  assert.equal(m.calls.reads,0);
 }
});
test("Egern widget summarizes only recent locally cached event counts, without tokens",async()=>{
 const observe=await load("egern-observer"),render=await load("egern-status");
 const m=mock();await observe(m.ctx);
 const widget=await render(m.ctx);
 const s=JSON.stringify(widget);
 assert.equal(widget.type,"widget");
 assert.ok(s.includes("Locket: 1"));
 assert.ok(s.includes("YouTube endpoint calls: 0"));
 assert.ok(!s.includes("my-secret-account"));
});
test("Egern missing storage and malformed storage fail quietly",async()=>{
 const f=await load("egern-observer");
 const m=mock();delete m.ctx.storage;
 assert.equal((await f(m.ctx)).body,m.body);
 const widget=await load("egern-status");
 assert.equal((await widget(m.ctx)).type,"widget");
});
test("no external network, synthetic purchases, or raw response storage in Egern bundle",()=>{
 const source=fs.readFileSync(path.join(root,"build/egern-observer.js"),"utf8");
 for(const token of ["ctx.http", "$httpClient", "$task.fetch", "store_transaction_id", "ownership_type", "9999-01-09", "console.", "eval("]){
  assert.ok(!source.includes(token),token);
 }
});

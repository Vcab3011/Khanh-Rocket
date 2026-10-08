import {test} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const file = new URL("../scripts/locket-cache-probe.js", import.meta.url);
const script = await readFile(file, "utf8");
const imported = await import("data:text/javascript;base64,"+Buffer.from(script).toString("base64"));
const probe = imported.default;

function fake({url="https://api.revenuecat.com/v1/subscribers/test",ua="Locket/1.0",status=200,body='{"subscriber":{"entitlements":{"Gold":{"expires_date":"2026-11-01"}}}}',storage=true}={}){
  const records = [],reads = [];
  const ctx = {
    request: {url,headers:{get:(k)=>k.toLowerCase()==="user-agent"?ua:null}},
    response: {status,text:async()=>{reads.push(1);return body;}},
    storage:storage?{setJSON:(key,val)=>records.push([key,val])}:undefined
  };
  return {ctx,records,reads};
}

test("uses official Egern ESM async export and stores non-sensitive metadata only",async()=>{
  const o=fake();const r=await probe(o.ctx);
  assert.equal(r.body,await Promise.resolve('{"subscriber":{"entitlements":{"Gold":{"expires_date":"2026-11-01"}}}}'));
  assert.equal(o.records.length,1);
  assert.equal(o.records[0][0],"khanh.egern.locket.probe");
  const x=o.records[0][1];
  assert.equal(x.goldFieldPresent,true);
  assert.equal(x.goldHasExpiry,true);
  assert.ok(x.seenAt>0);
  assert.ok(!JSON.stringify(x).includes("Locket/"));
  assert.ok(!JSON.stringify(x).includes("/v1/subscribers"));
  assert.ok(!JSON.stringify(x).includes("2026-11-01"));
});
test("fails open without reading other RevenueCat apps",async()=>{
  const o=fake({ua:"OtherApp/1.0"});assert.equal(await probe(o.ctx),undefined);
  assert.equal(o.records.length,0);assert.equal(o.reads.length,0);
});
test("does not access traffic for unrelated URLs, or for errors",async()=>{
  for(const opts of [{url:"https://example.org/health"},{status:401},{url:"https://api.revenuecat.com/v1/other"}]){
    const o=fake(opts);assert.equal(await probe(o.ctx),undefined);
    assert.equal(o.reads.length,0);assert.equal(o.records.length,0);
  }
});
test("preserves response body even if JSON is malformed or absent",async()=>{
  for(const body of ['broken!', '{"subscriber":{}}']){
    const o=fake({body});const r=await probe(o.ctx);
    assert.equal(r.body,body);assert.equal(o.records.length,body==='broken!'?0:1);
  }
});
test("no network/storage access is needed if Egern ctx.storage unavailable",async()=>{
  const o=fake({storage:false});const r=await probe(o.ctx);
  assert.equal(typeof r.body,"string");
});
test("source contains no remote network clients, no synthetic purchase objects",()=>{
  const noComments=script.replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*\/\/.*$/gm,"");
  for(const keyword of ["ctx.http", "fetch(", "XMLHttpRequest", "store_transaction_id", "original_purchase_date", "expires_date:\"9999", "ctx.respond("]){
    assert.ok(!noComments.includes(keyword),keyword);
  }
});

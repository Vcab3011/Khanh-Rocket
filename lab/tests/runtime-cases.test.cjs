"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {gzipSync}=require("node:zlib");
const root=path.resolve(__dirname,"..");
const key="khanh.multiapp.events.v1";
const url="https://api.revenuecat.com/v1/subscribers/synthetic-account";
const sample='{"subscriber":{"entitlements":{"Gold":{}}}}';
async function load(name="egern-observer"){
 const code=fs.readFileSync(path.join(root,"build",name+".js"),"utf8");
 return (await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"))).default;
}
function fixture({body=sample,status=200,method="GET",target=url,ua="Locket/3.0",headers={},db=new Map()}={}){
 const ctx={request:{url:target,method,headers:new Headers({"User-Agent":ua})},
  response:new Response(body,{status,headers:{"Content-Type":"application/json","X-Synthetic":"preserve",...headers}}),
  storage:{getJSON:k=>db.get(k),setJSON:(k,v)=>db.set(k,v)}};
 let reads=0;
 const read=ctx.response.arrayBuffer.bind(ctx.response);
 ctx.response.arrayBuffer=()=>{reads++;return read();};
 return {ctx,db,reads:()=>reads};
}
function event(m){return m.db.get(key)[0];}
test("native Response/Headers stream is read once and body/status/headers survive restoration",async()=>{
 const f=await load(),bytes=Buffer.from(sample+"\r\n "),m=fixture({body:bytes,headers:{"Content-Length":String(bytes.length)}});
 const status=m.ctx.response.status,headers=[...m.ctx.response.headers];
 const result=await f(m.ctx);
 assert.deepEqual(Object.keys(result),["body"]);
 assert.deepEqual(Buffer.from(result.body),bytes);
 assert.equal(m.reads(),1);assert.equal(m.ctx.response.bodyUsed,true);
 assert.equal(m.ctx.response.status,status);assert.deepEqual([...m.ctx.response.headers],headers);
 const restored=new Response(result.body,{status,headers});
 assert.deepEqual(Buffer.from(await restored.arrayBuffer()),bytes);
 assert.equal(restored.status,200);assert.deepEqual([...restored.headers],headers);
});
test("gzip wire bytes and already-decompressed bytes with a gzip header are both left unread",async()=>{
 const f=await load();
 for(const body of [gzipSync(sample),Buffer.from(sample)]){
  const m=fixture({body,headers:{"Content-Encoding":"gzip","Content-Length":String(body.length)}});
  const headers=[...m.ctx.response.headers];
  assert.equal(await f(m.ctx),undefined);assert.equal(m.reads(),0);
  assert.equal(m.ctx.response.bodyUsed,false);assert.equal(event(m).outcome,"encoded-body-skipped");
  assert.deepEqual(Buffer.from(await m.ctx.response.arrayBuffer()),body);
  assert.deepEqual([...m.ctx.response.headers],headers);
 }
});
test("other encodings and non-JSON MIME types stay unread with bounded skip outcomes",async()=>{
 const f=await load();
 for(const encoding of ["br","deflate","gzip, br"]){
  const m=fixture({headers:{"Content-Encoding":encoding}});
  assert.equal(await f(m.ctx),undefined);assert.equal(m.reads(),0);
  assert.equal(event(m).outcome,"encoded-body-skipped");
 }
 for(const type of ["text/html; note=json","application/jsonp","text/json",""]){
  const m=fixture({headers:{"Content-Type":type}});
  assert.equal(await f(m.ctx),undefined);assert.equal(m.reads(),0);
  assert.equal(event(m).outcome,"content-type-skipped");
 }
 const accepted=fixture({headers:{"Content-Type":"application/customer+json; charset=utf-8","Content-Encoding":"identity"}});
 assert.ok((await f(accepted.ctx)).body);assert.equal(event(accepted).outcome,"observed");
});
test("invalid UTF-8 is not silently repaired or parsed and original bytes are restored",async()=>{
 const f=await load(),body=Buffer.concat([Buffer.from('{"subscriber":{"entitlements":{"'),Buffer.from([0xc3,0x28]),Buffer.from('\":{}}}}')]);
 const m=fixture({body});
 assert.deepEqual(Buffer.from((await f(m.ctx)).body),body);
 assert.equal(event(m).outcome,"invalid-utf8");assert.equal(m.reads(),1);
});
test("204/304 and error statuses never consume their response bodies",async()=>{
 const f=await load();
 for(const status of [204,304,401,500]){
  const m=fixture({status,body:status===204||status===304?null:"synthetic-error"});
  const before=[...m.ctx.response.headers];
  assert.equal(await f(m.ctx),undefined);assert.equal(m.reads(),0);
  assert.equal(event(m).outcome,"http-non200");assert.equal(event(m).status,status);
  assert.equal(m.ctx.response.bodyUsed,false);assert.deepEqual([...m.ctx.response.headers],before);
 }
});
test("exact 256 KiB boundary is analyzed; larger actual or declared bodies are not decoded",async()=>{
 const f=await load(),exact=sample+" ".repeat(262144-Buffer.byteLength(sample));
 const m=fixture({body:exact});
 assert.deepEqual(Buffer.from((await f(m.ctx)).body),Buffer.from(exact));
 assert.equal(event(m).outcome,"observed");
 const large=fixture({body:exact+" "});
 assert.equal((await f(large.ctx)).body.byteLength,262145);
 assert.equal(event(large).outcome,"body-too-large");
 const declared=fixture({body:sample,headers:{"Content-Length":"262145"}});
 assert.equal(await f(declared.ctx),undefined);assert.equal(declared.reads(),0);
 assert.equal(event(declared).outcome,"body-too-large");
});
test("query variations are observed without storing query, URL, identity, auth or receipt",async()=>{
 const f=await load(),sentinels=["synthetic-account","synthetic-token","synthetic-receipt","synthetic-query"];
 const m=fixture({target:url+"?trace=synthetic-query",body:JSON.stringify({subscriber:{entitlements:{},original_app_user_id:sentinels[0],receipt:sentinels[2]}})});
 m.ctx.request.headers.set("Authorization","Bearer "+sentinels[1]);
 await f(m.ctx);
 for(const value of [...sentinels,"https://","authorization","receipt","original_app_user_id"])
  assert.ok(!JSON.stringify([...m.db.values()]).includes(value));
});
test("HEAD, unsupported methods, unknown paths and other app identities do not read or store",async()=>{
 const f=await load();
 const cases=[{method:"HEAD"},{method:"DELETE"},{method:"POST"},{method:"GET",target:url+"/more"},
  {ua:"OtherApp/1 Locket"},{ua:"Not-Locket/1"},{ua:"OtherApp (Locket)"},
  {target:url.replace("/v1/","/v2/")},{target:url.replace("/subscribers/","/SUBSCRIBERS/")},
  {target:url.replace("api.revenuecat.com","api.revenuecat.com.evil.invalid")},
  {target:url.replace("https://","https://user@")},
  {target:"https://api-mobile.soundcloud.com/configuration/ios",method:"POST"},
  {target:"https://youtubei.googleapis.com/youtubei/v1/player",method:"GET"}];
 for(const item of cases){
  const m=fixture(item);assert.equal(await f(m.ctx),undefined);
  assert.equal(m.reads(),0);assert.equal(m.db.size,0);
 }
 const missing=fixture();delete missing.ctx.request.method;
 assert.equal(await f(missing.ctx),undefined);assert.equal(missing.reads(),0);
});
test("receipts require POST; shared RevenueCat traffic still requires Locket first-token identity",async()=>{
 const f=await load(),target="https://api.revenuecat.com/v1/receipts";
 for(const ua of ["Locket/3","Locket iOS"]){
  const m=fixture({target,method:"POST",ua});
  assert.ok((await f(m.ctx)).body);assert.equal(event(m).app,"locket");
 }
 const m=fixture({target,method:"GET"});
 assert.equal(await f(m.ctx),undefined);assert.equal(m.db.size,0);
});
test("missing/already-used/rejected body reports unavailability without raw error details",async()=>{
 const f=await load();
 const absent=fixture({body:null});
 assert.equal(await f(absent.ctx),undefined);assert.equal(absent.reads(),0);
 assert.equal(event(absent).outcome,"body-unavailable");
 const missing=fixture();missing.ctx.response.arrayBuffer=undefined;
 assert.equal(await f(missing.ctx),undefined);assert.equal(event(missing).outcome,"body-unavailable");
 const used=fixture();await used.ctx.response.arrayBuffer();
 assert.equal(await f(used.ctx),undefined);assert.equal(used.reads(),1);
 assert.equal(event(used).outcome,"body-unavailable");
 const broken=fixture();broken.ctx.response.arrayBuffer=async()=>{throw Error("synthetic-private-error")};
 assert.equal(await f(broken.ctx),undefined);assert.equal(event(broken).outcome,"body-unavailable");
 assert.ok(!JSON.stringify(event(broken)).includes("synthetic-private-error"));
});
test("storage read/write exceptions preserve consumed bytes; empty bodies are restored too",async()=>{
 const f=await load();
 for(const body of [sample,""]){
  for(const failure of ["getJSON","setJSON"]){
   const m=fixture({body});m.ctx.storage[failure]=()=>{throw Error("synthetic-private-error")};
   assert.deepEqual(Buffer.from((await f(m.ctx)).body),Buffer.from(body));assert.equal(m.reads(),1);
  }
 }
});
test("runtime retains 32 aggregate events and widget reports failures and manual checkpoints",async()=>{
 const f=await load(),render=await load("egern-status"),db=new Map();
 for(let i=0;i<40;i++){
  const m=fixture({db,body:i===38?'{}':sample});
  if(i===39)m.ctx.response.arrayBuffer=undefined;
  await f(m.ctx);
 }
 assert.equal(db.get(key).length,32);
 const widget=JSON.stringify(await render({storage:{getJSON:k=>db.get(k)}}));
 assert.ok(widget.includes("Body unavailable: 1"));assert.ok(widget.includes("Schema drift: 1"));
 assert.ok(widget.includes("Last capture: locket / body-unavailable"));
 assert.ok(widget.includes("Manual: baseline"));assert.ok(!widget.includes("synthetic-account"));
});
test("every generated bundle is free of logging, outbound clients and dynamic code",()=>{
 for(const name of ["egern-observer","egern-status","egern-reset"]){
  const source=fs.readFileSync(path.join(root,"build",name+".js"),"utf8");
  for(const pattern of [/console\s*[.[]/,/\$notify\b/,/\$notification\b/,/ctx\s*\.\s*(?:http|notify|ssh)\b/,
    /\bfetch\s*\(/,/\$httpClient\b/,/\$task\s*\.\s*fetch/,/\beval\s*\(/,/\bFunction\s*\(/])
   assert.ok(!pattern.test(source),name+" contains disallowed side effects");
 }
});

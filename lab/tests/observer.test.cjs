"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const code=fs.readFileSync(path.join(root,"core/observer-core.js"),"utf8");
const Core=vm.runInNewContext(code, {Number,Math,Object,Array,JSON,RegExp,String});
const now=Date.parse("2026-10-08T12:00:00Z");
const lock="https://api.revenuecat.com/v1/subscribers/user123";
const sound="https://api-mobile.soundcloud.com/configuration/ios";
const yt="https://youtubei.googleapis.com/youtubei/v1/";
function inspect(url,body,userAgent="",status=200,clock=now){
  return Core.inspect({url,body,userAgent,status,now:clock,method:url.startsWith(yt)?"POST":"GET"});
}
function own(value){return JSON.parse(JSON.stringify(value));}
function assertSafe(value){
 const repr=JSON.stringify(value);
 for(const forbidden of ["user123","bearer-secret","customer_user_id","soundcloud-track-title","access_token","receipt_payload"]){
   assert.ok(!repr.includes(forbidden),"leaked "+forbidden);
 }
}
const customer={subscriber:{entitlements:{Gold:{expires_date:"2026-12-01",id:"customer_user_id"},Plus:{}},subscriptions:{receipt_payload:"secret"},original_app_user_id:"customer_user_id"}};
const config={plan:{plan_id:"go-plus",account:"customer_user_id"},features:[{name:"offline_sync",enabled:true},{name:"no_audio_ads",enabled:true},{name:"access_token",enabled:false}]};

test("strict app classification rejects unrelated hosts, path ambiguity, fake suffixes and shared RevenueCat apps",()=>{
 for(const url of ["https://api.revenuecat.com.evil.com/v1/subscribers/a","http://api.revenuecat.com/v1/subscribers/a","https://api.revenuecat.com/v1/subscribers/a/more","https://api-mobile.soundcloud.com.evil.com/configuration/ios","https://youtubei.googleapis.com.bad/youtubei/v1/player"]){
  assert.equal(Core.classify(url,"Locket"),null,url);
 }
 assert.equal(Core.classify(lock,"OtherApp/1"),null);
 assert.equal(Core.classify(lock,"Pocket/1"),null);
 assert.equal(Core.classify(lock,"Locket/1").app,"locket");
 assert.equal(Core.classify(sound).app,"soundcloud");
 for(const endpoint of ["player","browse","next","search","get_watch","reel/reel_watch_sequence"]){
  assert.equal(Core.classify(yt+endpoint,"","POST").app,"youtube");
 }
});
test("RevenueCat CustomerInfo captures only entitlement count and presence not subscriber identity",()=>{
 const body=JSON.stringify(customer);
 const event=inspect(lock,body,"Locket/3.0");
 assert.equal(event.outcome,"observed");
 assert.equal(event.goldFieldPresent,true);
 assert.equal(event.goldExpiryFieldPresent,true);
 assert.equal(event.entitlementCount,2);
 assertSafe(event);
});
test("unrelated RevenueCat app not inspected even with identical JSON",()=>{
 assert.equal(inspect(lock,JSON.stringify(customer),"OtherApp/1"),null);
});
test("RevenueCat mapping metadata counts only schema entries and never returns product or entitlement names",()=>{
 const body=JSON.stringify({product_entitlement_mapping:{
  "khanh_secret_sku":{product_identifier:"receipt_payload",entitlements:["Gold","Pro"]},
  "second":{product_identifier:"customer_user_id",entitlements:["Standard"]}
 }});
 const event=inspect("https://api.revenuecat.com/v1/product_entitlement_mapping",body,"Locket/3");
 assert.equal(event.productCount,2);
 assert.equal(event.mappingEntryCount,3);
 assertSafe(event);
 assert.ok(!JSON.stringify(event).includes("khanh_secret_sku"));
});
test("SoundCloud feature flags are counted without plan identifiers or feature names",()=>{
 const event=inspect(sound,JSON.stringify(config));
 assert.equal(event.outcome,"observed");
 assert.equal(event.planFieldPresent,true);
 assert.equal(event.featureCount,3);
 assert.equal(event.enabledFeatureCount,2);
 assertSafe(event);
});
test("YouTube protobuf endpoint observed without decoding binary body",()=>{
 const event=inspect(yt+"browse",undefined,"",200);
 assert.equal(event.outcome,"opaque-protobuf");
 assert.equal(event.app,"youtube");
 assert.equal(event.signal,"browse");
 assert.ok(!("body" in event));
});
test("HTTP non-200 events record status but do not parse payload",()=>{
 const e=inspect(lock,"receipt_payload","Locket/3",304);
 assert.equal(e.outcome,"http-non200");assertSafe(e);
});
test("invalid, oversized and unexpected JSON fail closed to aggregate status only",()=>{
 assert.equal(inspect(sound,"{broken").outcome,"invalid-json");
 assert.equal(inspect(sound,'"hi"').outcome,"unexpected-json");
 assert.equal(inspect(sound,"a".repeat(262145)).outcome,"body-too-large");
 assert.equal(inspect(lock,JSON.stringify({subscriber:{}}),"Locket").outcome,"schema-mismatch");
});
test("rejects missing or out-of-range observation clock",()=>{
 assert.equal(inspect(sound,"{}", "",200,NaN),null);
 assert.equal(inspect(sound,"{}","",200,-1),null);
 assert.equal(inspect(sound,"{}","",99),null);
});
test("bounded history, 24-hour TTL, timestamp guard and redaction of injected extra keys",()=>{
 let history=[];
 for(let i=0;i<60;i++)history=Core.append(history,inspect(sound,JSON.stringify(config),"",200,now-i),now);
 assert.equal(history.length,32);
 const unsafe={...history[0],fullURL:lock,secret:"bearer-secret",original_app_user_id:"customer_user_id"};
 history=Core.append([unsafe,...history],null,now);
 assertSafe(history);
 assert.ok(history.length<=32);
 const expired={...history[0],observedAt:now-86400001};
 assert.equal(Core.append([expired],null,now).length,0);
 const future={...history[0],observedAt:now+300001};
 assert.equal(Core.append([future],null,now).length,0);
});
test("empty and malformed histories yield safe zero counts",()=>{
 const o=own(Core.summary({raw:"receipt_payload"},now));
 assert.deepEqual(o.apps,{locket:0,soundcloud:0,youtube:0});
 assert.equal(o.eventCount,0);
});
test("one-shot cache timeline is *observed events*, never claimed active subscriptions",()=>{
 const first=inspect(lock,JSON.stringify(customer),"Locket",200,now);
 const after=inspect(lock,JSON.stringify({subscriber:{entitlements:{}}}),"Locket",200,now+5*60000);
 const history=Core.append(Core.append([],first,now),after,now+5*60000);
 assert.deepEqual(own(history.map(x=>x.goldFieldPresent)),[true,false]);
 assertSafe(history);
 assert.equal(Core.summary(history,now+5*60000).apps.locket,2);
});
test("no direct network, persistence API, dynamic evaluation or console in pure core",()=>{
 for(const keyword of ["fetch(", "$httpClient", "$task.fetch", "ctx.http", "console.", "eval(", "Function(", "persistentStore", "storage."]){
  assert.equal(code.includes(keyword),false,keyword);
 }
});
test("event-store enums reject identifiers hidden in signal/outcome and cross-app fields",()=>{
 const safe=inspect(lock,JSON.stringify(customer),"Locket");
 for(const change of [{signal:"synthetic-account"},{outcome:"bearer-secret"},
   {signal:"feature-config"},{format:"protobuf"},{app:"__proto__"}]){
  assert.equal(Core.compactEvent({...safe,...change}),null);
 }
 const youtube=inspect(yt+"player",undefined);
 const result=own(Core.compactEvent({...youtube,goldFieldPresent:true,entitlementCount:99,
  fullURL:lock,authorization:"bearer-secret",receipt:"receipt_payload",body:"customer_user_id"}));
 assert.deepEqual(Object.keys(result).sort(),["v","app","signal","status","observedAt","format","outcome"].sort());
 assertSafe(result);
});
test("UTF-8 byte cap applies even when character count is below the limit",()=>{
 const body=JSON.stringify({subscriber:{entitlements:{},padding:"é".repeat(140000)}});
 assert.ok(body.length<262144);assert.ok(Buffer.byteLength(body)>262144);
 assert.equal(inspect(lock,body,"Locket").outcome,"body-too-large");
});
test("unknown SoundCloud schema is reported instead of counted as a valid empty config",()=>{
 for(const payload of [{},{plan:{}},{features:[]},{plan:[],features:[]},{plan:{},features:{}}])
  assert.equal(inspect(sound,JSON.stringify(payload)).outcome,"schema-mismatch");
});
test("summary uses maximum capture time and counts only retained unavailable/schema events",()=>{
 const first=inspect(lock,"{}","Locket",200,now);
 const older=inspect(lock,undefined,"Locket",200,now-1);
 const expired={...older,observedAt:now-86400001};
 const summary=own(Core.summary([first,older,expired],now));
 assert.equal(summary.lastObservedAt,now);assert.equal(summary.lastOutcome,"schema-mismatch");
 assert.equal(summary.schemaDrift,1);assert.equal(summary.bodyUnavailable,1);
 assert.equal(Core.summary([{...first,outcome:"synthetic-account"}],now).eventCount,0);
});

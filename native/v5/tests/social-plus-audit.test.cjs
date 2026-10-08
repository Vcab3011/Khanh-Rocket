"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"../research");
const matrix=JSON.parse(fs.readFileSync(path.join(root,"social-plus-feature-matrix.json"),"utf8"));
const source=fs.readFileSync(path.join(root,"social-plus-audit.js"),"utf8");
const audit=require(path.join(root,"social-plus-audit.js"));
test("Instagram Plus and Snapchat+ are separate app families with distinct verified feature sets",()=>{
 const idx=audit.buildIndex(matrix);
 assert.ok(Object.keys(idx.snapchat_plus).length>=7);
 assert.ok(Object.keys(idx.instagram_plus).length>=9);
 assert.equal(idx.snapchat_plus.memories_250gb,"server-storage");
 assert.equal(idx.instagram_plus.story_preview,"server-privacy");
 assert.equal(idx.instagram_plus.story_extend,"server-social");
 assert.equal(idx.snapchat_plus.custom_app_icon,"ui-with-account-gate");
 assert.equal(idx.instagram_plus.custom_app_icon,"ui-with-account-gate");
});
test("visible paid-feature badge alone never counts as verified account subscription",()=>{
 const report=audit.assess(matrix,[
  {app:"snapchat_plus",feature:"memories_250gb",ui:"visible",action:"blocked"},
  {app:"instagram_plus",feature:"story_preview",ui:"visible",action:"not_tested"}
 ]);
 assert.equal(report.apps.snapchat_plus.blocked,1);
 assert.equal(report.apps.instagram_plus.needsDeviceCheck,1);
 assert.equal(report.visibleButBlocked,1);
 assert.equal(report.conclusions.serverEntitlementVerified,false);
 assert.equal(report.conclusions.vpnOffPersistenceVerified,false);
});
test("working UI does not imply backend subscription validity or actual storage quota",()=>{
 const report=audit.assess(matrix,[
  {app:"snapchat_plus",feature:"custom_app_icon",ui:"visible",action:"worked"},
  {app:"instagram_plus",feature:"bio_fonts",ui:"visible",action:"worked"}
 ]);
 assert.equal(report.apps.snapchat_plus.worked,1);
 assert.equal(report.apps.instagram_plus.worked,1);
 assert.equal(report.conclusions.serverEntitlementVerified,false);
});
test("rejects unknown endpoints, unknown apps and app-mismatched feature labels",()=>{
 for(const record of [
  {app:"snapchat_plus",feature:"story_extend",ui:"visible",action:"worked"},
  {app:"instagram_plus",feature:"memories_250gb",ui:"visible",action:"worked"},
  {app:"facebook_plus",feature:"custom_app_icon",ui:"visible",action:"worked"},
  {app:"instagram_plus",feature:"story_preview",ui:"subscribed",action:"worked"},
  {app:"instagram_plus",feature:"story_preview",ui:"visible",action:"purchased"}
 ])assert.throws(()=>audit.assess(matrix,[record]));
 assert.throws(()=>audit.assess(matrix,new Array(33).fill({app:"snapchat_plus",feature:"custom_app_icon",ui:"visible",action:"worked"})));
});
test("drops sensitive unknown observation properties without persisting any ID or secret",()=>{
 const info={app:"instagram_plus",feature:"story_extend",ui:"visible",action:"not_tested",
  accountId:"user_123_private",authorization:"Bearer PRIVATE_TOKEN",receipt:"receipt_payload",
  url:"https://i.instagram.com/private/account/123",raw:"sensitive social graph"};
 const report=audit.assess(matrix,[info]),serialized=JSON.stringify(report);
 for(const secret of ["user_123_private","PRIVATE_TOKEN","receipt_payload",
   "i.instagram.com","sensitive social graph"])assert.ok(!serialized.includes(secret));
 assert.deepEqual(Object.keys(report.observations[0]).sort(),["action","app","control","feature","ui"]);
});
test("rejects malicious or malformed manifests including duplicate feature keys",()=>{
 assert.throws(()=>audit.assess({...matrix,schema_version:2},[]));
 const bad=JSON.parse(JSON.stringify(matrix));
 bad.apps.snapchat_plus.features.push({...bad.apps.snapchat_plus.features[0]});
 assert.throws(()=>audit.assess(bad,[]));
});
test("runs in isolated VM without network, storage, browser, console or permissioned globals",()=>{
 const sandbox={module:{exports:{}},globalThis:undefined};
 vm.runInNewContext(source,sandbox,{timeout:600});
 assert.equal(typeof sandbox.module.exports.assess,"function");
 const r=sandbox.module.exports.assess(matrix,[]);
 assert.equal(r.totalObservations,0);
 for(const token of ["$httpClient","$task.fetch","XMLHttpRequest","fetch(","ctx.http",
 "$persistentStore","localStorage","sessionStorage","eval(","new Function","console.",
 "entitlement_grant","is_premium =","customer_info","Authorization:"]){
   assert.ok(!source.includes(token),token);
 }
});

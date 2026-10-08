"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const dir=path.resolve(__dirname,"../../v2/scripts");
const fixtures={
  "soundcloud-go.js":{url:"https://api-mobile.soundcloud.com/configuration/ios",body:'{"original":"keep","plan":{"id":"free"},"features":[]}'},
  "alight-motion.js":{url:"https://us-central1-alight-creative.cloudfunctions.net/getAccountStatusAndLicenses",body:'{"result":{}}'},
  "picsart.js":{url:"https://api.picsart.com/gw-v2/shop/subscription/apple/purchases",body:"{}"},
  "wink.js":{url:"https://api-sub.meitu.com/v2/user/vip_info_by_group.json",body:'{"data":{}}'},
  "truecaller.js":{url:"https://premium-us.truecaller.com/v2/subscriptions/status",body:"{}"},
  "kinemaster.js":{url:"https://api-account.kinemasters.com/v1/user/subscribe",body:"{}"},
  "camscanner.js":{url:"https://api.intsig.net/purchase/cs/query_property",body:'{"data":{"unrelated":"keep"}}'},
  "beautyplus.js":{url:"https://api.mr.pixocial.com/v1/manual_unlock",body:"{}"},
  "locket-revenuecat.js":{url:"https://api.revenuecat.com/v1/subscribers/synthetic",body:'{"subscriber":{"entitlements":{},"subscriptions":{}}}',agent:"Locket iOS"},
  "spotify-json.js":{url:"https://spclient.wg.spotify.com/artistview/v1/artist/id?platform=iphone",body:"{}"}
};
function simulate(file,fixture){
 const source=fs.readFileSync(path.join(dir,file),"utf8");
 const cb=[];
 const context={
  $request:{url:fixture.url,method:"POST",headers:{"User-Agent":fixture.agent||"Test"}},
  $response:{status:200,statusCode:200,body:fixture.body},
  $done:v=>cb.push(v),
  Uint8Array,ArrayBuffer,TextEncoder,TextDecoder
 };
 vm.runInNewContext(source,context,{timeout:1000});
 assert.equal(cb.length,1,file+" must finish exactly once");
 return JSON.parse(JSON.stringify(cb[0]));
}
test("SoundCloud plan and exact nine feature-flag values match V1 documented schema",()=>{
 const v=simulate("soundcloud-go.js",fixtures["soundcloud-go.js"]);
 const o=JSON.parse(v.body);
 assert.equal(o.original,"keep");
 assert.equal(o.plan.id,"high_tier");
 assert.equal(o.plan.plan_id,"go-plus");
 assert.equal(o.features.length,9);
 const expected={offline_sync:true,no_audio_ads:true,hq_audio:true,system_playlist_in_library:true,
   ads_krux:false,new_home:true,spotlight:false,content_reporting:false,content_reporting_dsa:false};
 assert.deepEqual(Object.fromEntries(o.features.map(x=>[x.name,x.enabled])),expected);
});
test("Alight Motion selected license schema",()=>{
 const o=JSON.parse(simulate("alight-motion.js",fixtures["alight-motion.js"]).body);
 assert.equal(o.result.licenses[0].type,"subscription");
 assert.ok(o.result.licenses[0].benefits.includes("RemoveWatermark"));
});
test("PicsArt script produces structured response under request-phase contract",()=>{
 const v=simulate("picsart.js",fixtures["picsart.js"]);
 assert.equal(v.response.status,200);
 const o=JSON.parse(v.response.body);
 assert.equal(o.status,"success");
 assert.ok(o.response[0].plan_meta.permissions.includes("premium_tools_standard"));
});
test("Wink has expected VIP fields and preserves unrelated top-level JSON",()=>{
 const o=JSON.parse(simulate("wink.js",fixtures["wink.js"]).body);
 assert.equal(o.data.is_vip,true);assert.equal(o.data.membership.level,1);
});
test("Truecaller subscription and product inventory remain independent schema routes",()=>{
 const first=JSON.parse(simulate("truecaller.js",fixtures["truecaller.js"]).body);
 assert.equal(first.subscriptionStatus,"SUBSCRIBED");
 const f={...fixtures["truecaller.js"],url:"https://premium-us.truecaller.com/v2/products/apple"};
 const second=JSON.parse(simulate("truecaller.js",f).body);
 assert.equal(second.tier[0].id,"goldfamily");
});
test("KineMaster matches known response shape",()=>{
 const o=JSON.parse(simulate("kinemaster.js",fixtures["kinemaster.js"]).body);
 assert.equal(o.is_valid_device,true);assert.equal(o.subscription_product_id,"com.kinemaster.sub.annual.ia2");
});
test("CamScanner only changes recognized fields, keeps unrelated payload",()=>{
 const o=JSON.parse(simulate("camscanner.js",fixtures["camscanner.js"]).body);
 assert.equal(o.data.unrelated,"keep");
 assert.equal(o.data.psnl_vip_property.vip_type,"svip");
});
test("BeautyPlus keeps documented JSON shape",()=>{
 const o=JSON.parse(simulate("beautyplus.js",fixtures["beautyplus.js"]).body);
 assert.equal(o.vip_expires_date,4071600000);
 assert.equal(o.data.balance,999999999);
});
test("Locket response is scoped by User-Agent and unrelated app is not modified",()=>{
 const old=fixtures["locket-revenuecat.js"];
 const yes=JSON.parse(simulate("locket-revenuecat.js",old).body);
 assert.ok(yes.subscriber.entitlements.Gold);
 const no=simulate("locket-revenuecat.js",{...old,agent:"Another RevenueCat App"});
 assert.deepEqual(no,{});
});
test("Spotify URL mutation preserves endpoint while changing platform",()=>{
 const v=simulate("spotify-json.js",fixtures["spotify-json.js"]);
 assert.ok(v.url.includes("platform=ipad"));
 assert.ok(!v.url.includes("platform=iphone"));
});
test("JSON-based scripts fail open for an unrelated broken body where parsing is required",()=>{
 for(const file of ["soundcloud-go.js","alight-motion.js","wink.js","kinemaster.js","camscanner.js","beautyplus.js","locket-revenuecat.js"]){
  const v=simulate(file,{...fixtures[file],body:"{broken JSON"});
  assert.deepEqual(v,{},file);
 }
});
test("no imported third-party network clients or dynamic code in active first-party V2 JSON scripts",()=>{
 for(const file of Object.keys(fixtures)){
   const src=fs.readFileSync(path.join(dir,file),"utf8");
   for(const api of ["$httpClient","$task.fetch","XMLHttpRequest","eval(","new Function(","require(","import("]){
     assert.equal(src.includes(api),false,file+" has unexpected "+api);
   }
 }
});

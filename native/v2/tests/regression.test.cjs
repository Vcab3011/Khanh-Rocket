"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const folder=path.resolve(__dirname,"../scripts");
function run(file,req={},resp={body:"{}"}){
  let calls=[];
  const ctx={$request:req,$response:resp,$done:(value)=>calls.push(value),
             Uint8Array,ArrayBuffer,Date,Number,Object,JSON,String,Math,URL};
  vm.runInNewContext(fs.readFileSync(path.join(folder,file),"utf8"),ctx,{timeout:2000,filename:file});
  assert.equal(calls.length,1,file+" must call $done exactly once");
  const result=calls[0];
  // vm-created object literals have foreign prototypes; normalize for value tests.
  if(result&&result.body instanceof Uint8Array)return {body:result.body};
  return JSON.parse(JSON.stringify(result || {}));
}
function body(file,req,resp){const v=run(file,req,resp);return v.body?JSON.parse(v.body):null;}
function vi(n){const a=[];do{let x=n%128;n=Math.floor(n/128);a.push(n?x+128:x)}while(n);return Uint8Array.from(a);}
function join(...arr){let l=0;arr.forEach(x=>l+=x.length);let b=new Uint8Array(l),p=0;arr.forEach(x=>{b.set(x,p);p+=x.length});return b;}
function field(n,wire,content){return join(vi(n*8+wire),wire===2?vi(content.length):new Uint8Array(),content);}
function fbytes(n,s){return field(n,2,Uint8Array.from(Buffer.from(s)));}
function findField(b,no){let p=0,out=[];function varAt(){let n=0,m=1;while(true){let c=b[p++];if(c===undefined)throw Error("truncated");n+=(c&127)*m;if(!(c&128))return n;m*=128;}}
  while(p<b.length){let id=varAt(),num=Math.floor(id/8),wire=id%8,content;
    if(wire===0){let val=varAt();content=vi(val);}
    else if(wire===2){let len=varAt();content=b.slice(p,p+len);p+=len;}
    else if(wire===1){content=b.slice(p,p+8);p+=8;}
    else if(wire===5){content=b.slice(p,p+4);p+=4;}
    else throw Error("unsupported wire");
    if(num===no)out.push(content);
  }return out;
}
test("SoundCloud: transforms only plan/features, preserves unrelated keys",()=>{
  const result=body("soundcloud-go.js",{}, {body:JSON.stringify({keep:"yes"})});
  assert.equal(result.keep,"yes");
  assert.equal(result.plan.plan_id,"go-plus");
  assert.equal(result.features.length,9);
  assert.deepEqual(run("soundcloud-go.js",{}, {body:"not-json"}),{});
});
test("AlightMotion, KineMaster, BeautyPlus replace only well-formed successful objects",()=>{
  assert.equal(body("alight-motion.js",{}, {body:"{}"}).result.licenses[0].valid,true);
  assert.equal(body("kinemaster.js",{}, {body:"{}"}).has_valid_subscription,true);
  assert.equal(body("beautyplus.js",{}, {body:"{}"}).data.balance,999999999);
  for(const name of ["alight-motion.js","kinemaster.js","beautyplus.js"]){
    assert.deepEqual(run(name,{}, {body:"broken"}),{});
    assert.deepEqual(run(name,{}, {body:"{}",status:500}),{});
  }
});
test("Wink: only JSON modification; no post-done alerts",()=>{
  let x=body("wink.js",{}, {body:JSON.stringify({keep:true})});
  assert.equal(x.keep,true);assert.equal(x.data.is_vip,true);assert.equal(x.data.membership.level,1);
});
test("PicsArt: request hook emits a synthetic HTTP response",()=>{
  let x=run("picsart.js",{url:"https://api.picsart.com/gw-v2/shop/subscription/apple/purchases"},{});
  assert.equal(x.response.status,200);
  assert.equal(JSON.parse(x.response.body).response[0].status,"SUBSCRIPTION_RENEWED");
});
test("Spotify URL: preserve explicit :443 normalization and platform compatibility",()=>{
  const x=run("spotify-json.js",{url:"https://spclient.wg.spotify.com:443/artistview/v1/artist/abc?platform=iphone"},{});
  assert.match(x.url,/platform=ipad/);assert.ok(!x.url.includes("com:443"));
  assert.deepEqual(run("spotify-json.js",{url:"https://example.com/a?platform=iphone"},{}),{});
});
test("RevenueCat: header guard; Locket isolation and schema guard",()=>{
  let r=run("revenuecat-header.js",{url:"https://api.revenuecat.com/v1/subscribers/abc",headers:{"X-RevenueCat-ETag":"tag"}},{});
  assert.equal(r.headers["X-RevenueCat-ETag"],"");
  assert.deepEqual(run("revenuecat-header.js",{url:"https://api.revenuecat.com/v1/subscribers/abc",headers:{}},{}),{});
  const url="https://api.revenuecat.com/v1/subscribers/id";
  const json=JSON.stringify({subscriber:{subscriptions:{},entitlements:{}}});
  assert.deepEqual(run("locket-revenuecat.js",{url,headers:{"User-Agent":"OtherApp"}},{body:json}),{});
  const data=body("locket-revenuecat.js",{url,headers:{"User-Agent":"Locket/5.0"}},{body:json});
  assert.equal(data.subscriber.entitlements.Gold.product_identifier,"locket_1600_1y");
  assert.deepEqual(run("locket-revenuecat.js",{url,headers:{"User-Agent":"Locket"}},{body:"{}"}),{});
});
test("Truecaller: status, products, and unknown URL guarded",()=>{
  const host="https://premium-us.truecaller.com/v4/";
  const status=body("truecaller.js",{url:host+"subscriptions/status"});
  assert.equal(status.subscriptionStatus,"SUBSCRIBED");assert.equal(status.tier.feature.length,28);
  const products=body("truecaller.js",{url:host+"products/apple"});
  assert.equal(products.tier[0].id,"goldfamily");
  assert.deepEqual(run("truecaller.js",{url:host+"other"}),{});
});
test("CamScanner nested schema validation and first reachable endpoint",()=>{
  const host="https://api.intsig.net";
  let v=body("camscanner.js",{url:host+"/purchase/cs/query_property"},{body:'{"data":{"other":1}}'});
  assert.equal(v.data.other,1);assert.equal(v.data.psnl_vip_property.svip,1);
  assert.deepEqual(run("camscanner.js",{url:host+"/purchase/cs/query_property"},{body:'{}'}),{});
  assert.deepEqual(run("camscanner.js",{url:host+"/other"},{body:'{"data":{}}'}),{});
});
test("Spotify: independent wire codec rewrites customize map, preserving unknown fields",()=>{
  const oldAttr=fbytes(4,"free"),entry=join(fbytes(1,"type"),field(2,2,oldAttr));
  const attrs=field(1,2,entry);
  const ucs=field(3,2,attrs);
  const unknown=fbytes(99,"preserve-this-unknown");
  const input=join(field(1,2,ucs),unknown);
  const resp=run("spotify-protobuf.js",{url:"https://spclient.wg.spotify.com/user-customization-service/v1/customize",method:"POST"},{body:input,status:200});
  assert.ok(resp.body instanceof Uint8Array);
  assert.equal(findField(resp.body,99).length,1);
  const outUcs=findField(resp.body,1)[0],outAttrs=findField(outUcs,3)[0];
  const mapEntries=findField(outAttrs,1);
  const mapped=Object.fromEntries(mapEntries.map(e=>{
     const key=Buffer.from(findField(e,1)[0]).toString();
     const attr=findField(e,2)[0];return [key,attr];
  }));
  assert.equal(Buffer.from(findField(mapped.type,4)[0]).toString(),"premium");
  assert.equal(findField(mapped.ads,2)[0][0],0);
  assert.ok(mapEntries.length>=37);
  assert.deepEqual(run("spotify-protobuf.js",{url:"https://spclient.wg.spotify.com/user-customization-service/v1/customize",method:"GET"},{body:input,status:200}),{});
});
test("Spotify: bootstrap nested path and unknown/noop responses",()=>{
  const entry=join(fbytes(1,"ads"),field(2,2,field(2,0,vi(1))));
  const inner=field(3,2,field(1,2,entry));
  const payload=field(2,2,field(1,2,field(1,2,field(1,2,inner))));
  const out=run("spotify-protobuf.js",{url:"https://spclient.wg.spotify.com/bootstrap/v1/bootstrap",method:"POST"},{body:payload,status:200});
  assert.ok(out.body instanceof Uint8Array);
  assert.deepEqual(run("spotify-protobuf.js",{url:"https://spclient.wg.spotify.com/bootstrap/v1/bootstrap",method:"POST"},{body:Uint8Array.from([255])}),{});
});
test("YouTube: Player protobuf removes ad fields, keeps unknown fields and enables background",()=>{
  const mini=field(21,2,field(151635310,2,field(1,0,vi(0))));
  const playback=field(9,2,join(fbytes(18,"adTracker"),fbytes(1,"keepPlayback")));
  const input=join(fbytes(7,"adPlacement"),fbytes(68,"adSlot"),field(2,2,mini),playback,fbytes(99,"unknown"));
  const out=run("youtube-player-protobuf.js",{url:"https://youtubei.googleapis.com/youtubei/v1/player"},{body:input,status:200});
  assert.ok(out.body instanceof Uint8Array);
  assert.equal(findField(out.body,7).length,0);assert.equal(findField(out.body,68).length,0);
  assert.equal(Buffer.from(findField(out.body,99)[0]).toString(),"unknown");
  const tracking=findField(out.body,9)[0];assert.equal(findField(tracking,18).length,0);
  const status=findField(out.body,2)[0];
  const miniOut=findField(findField(status,21)[0],151635310)[0];
  assert.equal(findField(miniOut,1)[0][0],1);
  const background=findField(findField(status,11)[0],64657230)[0];
  assert.equal(findField(background,1)[0][0],1);
});
test("YouTube: Watch wraps player under contents[1].player[2]; unsupported routes noop",()=>{
  const inner=field(2,2,fbytes(7,"ad"));
  const source=field(1,2,inner);
  const out=run("youtube-player-protobuf.js",{url:"https://youtubei.googleapis.com/youtubei/v1/get_watch"},{body:source});
  assert.ok(out.body instanceof Uint8Array);
  assert.equal(findField(findField(findField(out.body,1)[0],2)[0],7).length,0);
  assert.deepEqual(run("youtube-player-protobuf.js",{url:"https://youtubei.googleapis.com/youtubei/v1/browse"},{body:source}),{});
});

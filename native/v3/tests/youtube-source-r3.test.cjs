"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const source=fs.readFileSync(path.resolve(__dirname,"../scripts/youtube-response-r3.js"),"utf8");
const old=fs.readFileSync(path.resolve(__dirname,"../scripts/youtube-player-feed.js"),"utf8");
const referenceBytes=fs.readFileSync("/tmp/khanh-youtube-reference.js");
assert.equal(crypto.createHash("sha256").update(referenceBytes).digest("hex"),"5762e310cd546084f172828d827e16b1db36d1677a692c5de4f1a476c3bd89e6");
const reference=referenceBytes.toString();
function vi(n){const a=[];do{const c=n%128;n=Math.floor(n/128);a.push(n?c+128:c);}while(n);return Uint8Array.from(a);}
function join(...parts){const out=new Uint8Array(parts.reduce((n,b)=>n+b.length,0));let p=0;for(const b of parts){out.set(b,p);p+=b.length;}return out;}
function field(n,b){return join(vi(n*8+2),vi(b.length),b);}
function scalar(n,v){return join(vi(n*8),vi(v));}
const text=s=>Uint8Array.from(Buffer.from(s));
function wrap(p,b){for(const n of [...p].reverse())b=field(n,b);return b;}
function scan(b){let p=0,out=[];function read(){let n=0,m=1;while(true){assert.ok(p<b.length);const c=b[p++];n+=(c&127)*m;if(!(c&128))return n;m*=128;}}
 while(p<b.length){const k=read(),id=Math.floor(k/8),wire=k%8;let value;
  if(wire===0)value=read();else if(wire===2){const n=read();value=b.slice(p,p+n);p+=n;}else if(wire===1)p+=8;else if(wire===5)p+=4;else throw Error("fixture wire");
  assert.ok(p<=b.length);out.push({id,wire,value});}return out;}
function vals(b,n){return scan(b).filter(f=>f.id===n).map(f=>f.value);}
function at(b,p){for(const n of p)b=vals(b,n)[0];return b;}
const homePath=[9,49399797,1,50195462],nextPath=[7,51779735,1,49399797,1,50195462];
const normal=wrap([153515154,172660663,2,183314536,1],text("watch_video_layout.eml"));
const ad=wrap([153515154,172660663,2,183314536,1],text("inline_injection_entrypoint_layout.eml"));
const list=(...items)=>join(...items.map(b=>field(1,b)));
const home=wrap(homePath,list(normal,ad,normal));
const player=join(field(7,text("synthetic-ad")),field(68,text("synthetic-slot")),field(2,scalar(999,0)),field(99,text("synthetic-metadata")));
const settings=field(6,field(66930374,scalar(4,10135)));
async function run(code,route,body,options={}){
 return await new Promise((resolve,reject)=>{
  const calls=[],logs=[],stored=new Map();let attempts=0;
  const timer=setTimeout(()=>reject(Error("script did not complete")),3000);
  const ctx={$request:{url:options.url||"https://youtubei.googleapis.com/youtubei/v1/"+route},
   $response:{[options.bodyKey||"body"]:body},$argument:JSON.stringify({lyricLang:"off",captionLang:"off",debug:false}),
   $persistentStore:{read:k=>stored.get(k)||null,write:(v,k)=>{stored.set(k,v);return true}},
   $httpClient:new Proxy({},{get:()=>()=>{attempts++;throw Error("network forbidden")}}),
   $notification:{post:()=>{attempts++;throw Error("notification forbidden")}},console:{log:v=>logs.push(v)},
   Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,
   $done:answer=>{calls.push(answer);clearTimeout(timer);resolve({answer,body:answer?.body??answer?.bodyBytes??body,logs,calls,attempts});}};
  if(options.metadata!==false){ctx.$request.method="POST";ctx.$response.status=options.status??200;}
  if(options.statusCode!==undefined)ctx.$response.statusCode=options.statusCode;
  if(options.method!==undefined)ctx.$request.method=options.method;
  try{vm.runInNewContext(code,ctx,{timeout:1500,contextCodeGeneration:{strings:false,wasm:false}});}catch(e){clearTimeout(timer);reject(e);}
 });
}
test("source comparison: Home typed banners match original removal and order",async()=>{
 const a=await run(reference,"browse",home),b=await run(source,"browse",home);
 assert.deepEqual([...b.body],[...a.body]);assert.equal(b.calls.length,1);assert.equal(b.attempts,0);
});
test("source comparison: absent method/status reproduces r2 miss and R3 follows original typed transform",async()=>{
 const a=await run(reference,"browse",home,{metadata:false});
 const r2=await run(old,"browse",home,{metadata:false});assert.deepEqual([...r2.body],[...home]);
 const r3=await run(source,"browse",home,{metadata:false});assert.deepEqual([...r3.body],[...a.body]);
 assert.ok(r3.logs.some(s=>s.includes("status=unknown")));
});
test("source comparison: raw opaque canonical ad tracker reproduces r2 miss and R3 matches original",async()=>{
 const raw=join(Uint8Array.from([0,255,0]),text("https://googleads.g.doubleclick.net/pagead/adview?synthetic=1"),new Uint8Array(1500));
 const input=wrap(homePath,list(normal,field(999,raw),normal));
 const a=await run(reference,"browse",input),r2=await run(old,"browse",input),r3=await run(source,"browse",input);
 assert.deepEqual([...r2.body],[...input]);assert.deepEqual([...r3.body],[...a.body]);
});
test("source comparison: Watch nested Next ad cards and player background/ad fields",async()=>{
 const watch=field(1,join(field(2,player),field(3,wrap(nextPath,list(normal,ad)))));
 const a=await run(reference,"get_watch",watch),b=await run(source,"get_watch",watch);
 assert.equal(vals(at(b.body,[1,2]),7).length,0);assert.equal(vals(at(b.body,[1,2]),68).length,0);
 assert.equal(vals(at(b.body,[1,2,2,11,64657230]),1)[0],1);
 assert.deepEqual([...at(b.body,[1,3,...nextPath])],[...at(a.body,[1,3,...nextPath])]);
});
test("source comparison: Settings includes original background flag and client toggle without fake download flags",async()=>{
 const a=await run(reference,"account/get_setting",settings),r2=await run(old,"account/get_setting",settings),b=await run(source,"account/get_setting",settings);
 assert.deepEqual([...r2.body],[...settings]);
 const bg=out=>vals(out,6).flatMap(item=>vals(item,88478200));
 assert.equal(vals(bg(a.body)[0],2)[0],1);assert.equal(vals(bg(b.body)[0],2)[0],1);
 for(const n of [3,9,10])assert.equal(vals(bg(b.body)[0],n).length,0);
 const toggle=at(b.body,[6,66930374,3,61331416,5,81212182,1]);
 assert.equal(vals(at(toggle,[1]),1)[0],151);assert.equal(vals(toggle,3)[0],1);
});
test("Settings are idempotent and preserve labels, unrelated booleans and unknown bytes",async()=>{
 const input=join(settings,field(6,field(88478200,join(scalar(2,0),scalar(3,0),field(99,text("synthetic-label"))))),field(99,text("synthetic-root")));
 const a=await run(source,"account/get_setting",input),b=await run(source,"account/get_setting",a.body);
 assert.deepEqual([...a.body],[...b.body]);assert.deepEqual([...vals(a.body,99)[0]],[...vals(input,99)[0]]);
 const bg=vals(a.body,6).flatMap(x=>vals(x,88478200))[0];assert.equal(vals(bg,3)[0],0);
 assert.equal(Buffer.from(vals(bg,99)[0]).toString(),"synthetic-label");
});
test("unknown runtime headers do not authorize known errors, GET, conflicting codes or unrelated routes",async()=>{
 for(const opts of [{status:403},{status:"HTTP/1.1 500 Error"},{status:200,statusCode:403},{method:"GET"}]){
  const result=await run(source,"browse",home,opts);assert.deepEqual([...result.body],[...home]);
 }
 const result=await run(source,"browse",home,{url:"https://example.com/youtubei/v1/browse"});assert.deepEqual([...result.body],[...home]);
});
test("bodyBytes, ArrayBuffer, byte arrays and sliced views return Shadowrocket body Uint8Array",async()=>{
 const padded=join(text("prefix"),home,text("suffix"));
 for(const input of [home,home.buffer,Array.from(home),padded.subarray(6,6+home.length),new DataView(home.buffer)]){
  const result=await run(source,"browse",input,{bodyKey:"bodyBytes"});
  assert.ok(result.answer.body instanceof Uint8Array);assert.equal(result.answer.bodyBytes,undefined);
  assert.deepEqual([...result.body],[...wrap(homePath,list(normal,normal))]);assert.equal(result.calls.length,1);
 }
});
test("malformed and oversized bodies preserve original response",async()=>{
 for(const input of [Uint8Array.from([0]),Uint8Array.from([31,139,8]),new Uint8Array(5242881)]){
  const result=await run(source,"browse",input);assert.deepEqual([...result.body],[...input]);
 }
});
test("arbitrary pagead text, wrong domains, known titles and ordinary Shorts are retained",async()=>{
 for(const str of ["pagead","https://example.com/pagead/adview","https://googleads.g.doubleclick.net.evil/pagead/adview","prefixhttps://googleads.g.doubleclick.net/pagead/adview"]){
  const input=wrap(homePath,list(field(999,join(text(str),new Uint8Array(1500))),normal));
  const result=await run(source,"browse",input);assert.deepEqual([...result.body],[...input]);
 }
 const shorts=wrap([153515154,172660663,2,183314536,1],text("shorts_video_layout.eml"));
 const input=wrap(homePath,list(shorts,normal));assert.deepEqual([...(await run(source,"browse",input)).body],[...input]);
});
test("R3 logs contain only route/status/type/count summaries and no source can make network requests",async()=>{
 const secret="SYNTHETIC_SECRET_MUST_NOT_LOG";
 const input=wrap(homePath,list(join(normal,field(99,text(secret))),ad));
 const result=await run(source,"browse",input,{url:"https://youtubei.googleapis.com/youtubei/v1/browse?token="+secret});
 assert.equal(result.attempts,0);assert.ok(result.logs.length);
 for(const log of result.logs){assert.ok(log.startsWith("KR-YT "));assert.ok(!log.includes(secret));assert.ok(!log.includes("https://"));}
 for(const pattern of [/\$httpClient/,/\$persistentStore/,/\$prefs/,/\$task/,/\b(?:fetch|eval|Function|require)\s*\(/])assert.ok(!pattern.test(source));
});
test("source comparison: Next, Search and Home continuation schema routes retain ordinary cards",async()=>{
 for(const [route,p] of [["browse",[10,49399797,1,50195462]],["next",nextPath],
  ["next",[8,49399797,1,50195462]],["search",[4,49399797,1,50195462]]]){
  const input=wrap(p,list(normal,ad,normal));
  const original=await run(reference,route,input),result=await run(source,route,input);
  assert.deepEqual([...at(result.body,p)],[...at(original.body,p)]);
  assert.deepEqual([...at(result.body,p)],[...list(normal,normal)]);
 }
});
test("R3 cancels malformed typed siblings, preserves unknown fixed-width fields and enforces aggregate budget",async()=>{
 const malformed=join(home,field(9,Uint8Array.from([0])));
 assert.deepEqual([...(await run(source,"browse",malformed)).body],[...malformed]);
 const unknown=join(vi(999*8+5),Uint8Array.from([1,2,3,4]));
 const input=join(home,unknown),result=await run(source,"browse",input);
 assert.deepEqual([...result.body.slice(-unknown.length)],[...unknown]);
 const fields=Array.from({length:100001},()=>scalar(999,0));
 const overBudget=join(home,...fields);
 assert.deepEqual([...(await run(source,"browse",overBudget)).body],[...overBudget]);
});
test("unknown settings schema is preserved without injecting a background preference",async()=>{
 const input=field(999,text("synthetic-unrecognized-settings"));
 assert.deepEqual([...(await run(source,"account/get_setting",input)).body],[...input]);
});
const scReferenceBytes=fs.readFileSync("/tmp/khanh-soundcloud-source-reference.js");
assert.equal(crypto.createHash("sha256").update(scReferenceBytes).digest("hex"),"08421be74ff6ce5f4fc17714d92899a7765f1b0254b78246c58580d284cec05e");
const scNative=fs.readFileSync(path.resolve(__dirname,"../../v2/scripts/soundcloud-go.js"),"utf8");
function runSoundCloud(code,body,status=200){
 const calls=[];vm.runInNewContext(code,{$response:{body,status},$done:v=>calls.push(v)},
  {timeout:1000,contextCodeGeneration:{strings:false,wasm:false}});
 assert.equal(calls.length,1);return calls[0].body?JSON.parse(calls[0].body):null;
}
test("SoundCloud source audit: plan and all nine features exactly match current original on successful JSON",()=>{
 for(const body of ["{}",JSON.stringify({plan:{id:"free"},features:[],unknown:{synthetic:"preserved"}})]){
  const original=runSoundCloud(scReferenceBytes.toString(),body),ours=runSoundCloud(scNative,body);
  assert.deepEqual(ours,original);assert.equal(ours.features.find(f=>f.name==="no_audio_ads").enabled,true);
 }
});
test("SoundCloud rejects malformed/error responses; feature equality is not a device ad-blocking assertion",()=>{
 assert.equal(runSoundCloud(scNative,"invalid JSON"),null);
 assert.equal(runSoundCloud(scNative,"{}",403),null);
});

"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.resolve(__dirname,"../scripts/youtube-feed-filter.js"),"utf8");
const legacy=fs.readFileSync(path.resolve(__dirname,"fixtures/youtube-banner-filter-legacy.js"),"utf8");
function vi(n){const a=[];do{const c=n%128;n=Math.floor(n/128);a.push(n?c+128:c);}while(n);return Uint8Array.from(a);}
function join(...parts){const out=new Uint8Array(parts.reduce((n,b)=>n+b.length,0));let p=0;for(const b of parts){out.set(b,p);p+=b.length;}return out;}
function field(n,b){return join(vi(n*8+2),vi(b.length),b);}
function text(s){return Uint8Array.from(Buffer.from(s));}
function wrap(path,body){for(const n of [...path].reverse())body=field(n,body);return body;}
function fields(b){
 let p=0;const out=[];
 function read(){let n=0n,m=1n;for(let i=0;i<10;i++){assert.ok(p<b.length);const c=b[p++];n+=BigInt(c&127)*m;if(!(c&128))return n;m*=128n;}throw Error("invalid fixture");}
 while(p<b.length){const start=p,key=Number(read()),id=Math.floor(key/8),wire=key%8;let begin=p;
  if(wire===0)read();else if(wire===1)p+=8;else if(wire===5)p+=4;
  else if(wire===2){const length=Number(read());begin=p;p+=length;}else throw Error("fixture wire");
  assert.ok(p<=b.length);out.push({id,wire,value:b.slice(begin,p),raw:b.slice(start,p)});
 }return out;
}
function values(b,n){return fields(b).filter(f=>f.id===n&&f.wire===2).map(f=>f.value);}
function at(b,path){for(const n of path)b=values(b,n)[0];return b;}
function invoke(bytes,options={}){
 const {kind="browse",method="POST",status=200,statusCode,mode="body",url,code=source,doneThrows=false}=options;
 const outputs=[];const response={status:Object.prototype.hasOwnProperty.call(options,"status")?options.status:status};
 if(statusCode!==undefined)response.statusCode=statusCode;
 response[mode]=bytes;
 const ctx={$request:{url:url||"https://youtubei.googleapis.com/youtubei/v1/"+kind,method},$response:response,
  $done:value=>{outputs.push(value);if(doneThrows)throw Error("synthetic callback failure");},Uint8Array,ArrayBuffer,Number,Math,Object,String};
 if(options.logSink)ctx.console={log:value=>options.logSink(value)};
 if(doneThrows)assert.throws(()=>vm.runInNewContext(code,ctx,{timeout:2000}),/callback failure/);
 else vm.runInNewContext(code,ctx,{timeout:2000});
 assert.equal(outputs.length,1);
 const result=outputs[0];
 return result.bodyBytes?{body:new Uint8Array(result.bodyBytes),binary:true}:result.body?{body:result.body,binary:false}:{};
}
const marker="inline_injection_entrypoint_layout.eml";
function element(eml){return wrap([172660663,2,183314536,1],text(eml));}
function item(eml){return field(153515154,element(eml));}
const normal=item("watch_video_layout.eml|synthetic-normal"),ad=item(marker+"|synthetic-banner");
function items(...values){return join(...values.map(v=>field(1,v)));}
const homePath=[9,49399797,1,50195462];
const nextPath=[7,51779735,1,49399797,1,50195462];
function checkList(bytes,path,expected,options){
 const result=invoke(bytes,options);assert.ok(result.body,"filter should rewrite this fixture");
 assert.deepEqual(values(at(result.body,path),1).map(b=>[...b]),expected.map(b=>[...b]));return result;
}
test("iPhone Home banner fixture: remove ad card and keep recommendations in original order",()=>{
 const before=wrap(homePath,items(normal,ad,normal));
 checkList(before,homePath,[normal,normal]);
});
test("below-video recommendations fixture: Next retains video cards and removes only ad card",()=>{
 checkList(wrap(nextPath,items(ad,normal)),nextPath,[normal],{kind:"next"});
});
test("Home and Next continuation responses remove banners on subsequent loads",()=>{
 for(const [kind,path] of [["browse",[10,49399797,1,50195462]],["next",[8,49399797,1,50195462]]])
  checkList(wrap(path,items(normal,ad)),path,[normal],{kind});
});
test("Search initial, direct commands and append-continuation commands are covered",()=>{
 for(const path of [[4,49399797,1,50195462],[7,50195462],[7,49399797,1,50195462]])
  checkList(wrap(path,items(ad,normal)),path,[normal],{kind:"search"});
});
test("single-column tabs retain tab metadata and filter only their content",()=>{
 const path=[9,58173949,1,58174010,4,49399797,1,50195462];
 const tabUnknown=field(999,text("synthetic-tab"));
 const tab=join(tabUnknown,wrap([4,49399797,1,50195462],items(ad,normal)));
 const b=wrap([9,58173949,1,58174010],tab);
 const out=checkList(b,path,[normal]);
 assert.deepEqual([...values(at(out.body,[9,58173949,1,58174010]),999)[0]],[...text("synthetic-tab")]);
});
test("Shorts shelves retain ordinary Shorts tiles, pivot items and shelf metadata",()=>{
 const path=[9,49399797,1,51845067,5,51431404];
 const shorts=item("shorts_video_layout.eml"),pivot=item("shorts_pivot_item.eml");
 checkList(wrap(path,items(shorts,ad,pivot)),path,[shorts,pivot]);
});
test("all-ad lists retain their container and continuation metadata",()=>{
 const continuation=field(77,text("synthetic-continuation"));
 const out=invoke(wrap(homePath,join(items(ad,ad),continuation)));
 assert.ok(out.body);assert.equal(values(at(out.body,homePath),1).length,0);
 assert.deepEqual([...values(at(out.body,homePath),77)[0]],[...text("synthetic-continuation")]);
});
test("direct content element banners are filtered without touching other content",()=>{
 const opaque=field(999,text("synthetic-metadata"));
 const out=invoke(field(9,join(field(153515154,element(marker)),opaque)));
 assert.ok(out.body);assert.equal(values(at(out.body,[9]),153515154).length,0);
 assert.deepEqual([...values(at(out.body,[9]),999)[0]],[...text("synthetic-metadata")]);
});
test("duplicated singular EML follows last-value protobuf semantics",()=>{
 const layouts=wrap([153515154,172660663,2,183314536],join(field(1,text(marker)),field(1,text("normal.eml"))));
 const b=wrap(homePath,items(layouts));
 assert.deepEqual(invoke(b),{});
 assert.ok(invoke(b,{code:legacy}).body,"old banner script incorrectly removes the overwritten ad marker");
 const reversed=wrap([153515154,172660663,2,183314536],join(field(1,text("normal.eml")),field(1,text(marker))));
 checkList(wrap(homePath,items(reversed,normal)),homePath,[normal]);
});
test("serialized singular renderer fragments merge rather than trusting the first fragment",()=>{
 const merged=join(item("normal.eml"),item(marker));
 checkList(wrap(homePath,items(merged,normal)),homePath,[normal]);
 const ordinary=join(item(marker),item("normal.eml"));
 assert.deepEqual(invoke(wrap(homePath,items(ordinary))),{});
 assert.deepEqual(invoke(field(9,join(field(153515154,element(marker)),field(153515154,element("normal.eml"))))),{});
});
test("opaque renderer tracking evidence needs a complete structured canonical ad URL",()=>{
 const tracker="https://googleads.g.doubleclick.net/pagead/adview?synthetic=1";
 const opaque=field(909,join(field(1,text(tracker)),field(2,new Uint8Array(1100))));
 checkList(wrap(homePath,items(opaque,normal)),homePath,[normal]);
});
test("typed VideoContent unknown ad tracker is detected without scanning known lyrics",()=>{
 const tracker=join(field(1,text("https://www.googleadservices.com/pagead/viewthroughconversion?synthetic=1")),field(2,new Uint8Array(1100)));
 const opaque=wrap([153515154,172660663,1,168777401,5,909],tracker);
 checkList(wrap(nextPath,items(opaque,normal)),nextPath,[normal],{kind:"next"});
 const lyrics=wrap([153515154,172660663,1,168777401,5,465160965],tracker);
 assert.deepEqual(invoke(wrap(homePath,items(lyrics))),{});
});
test("plain pagead mentions and marker-like titles are preserved (legacy false positive regression)",()=>{
 const ordinary=field(909,text("a video about pagead "+"x".repeat(1200)));
 const b=wrap(homePath,items(ordinary,normal));
 assert.deepEqual(invoke(b),{});
 assert.ok(invoke(b,{code:legacy}).body,"old heuristic removed a pagead word without structured evidence");
 for(const eml of ["ordinary.eml|"+marker,marker+"_not_an_ad","shorts_video_layout.eml"])
  assert.deepEqual(invoke(wrap(homePath,items(item(eml)))),{});
});
test("unrelated hosts, noncanonical trackers, small opaque fields and arbitrary roots stay unchanged",()=>{
 for(const url of ["https://googleads.g.doubleclick.net.evil.invalid/pagead/adview", "http://googleads.g.doubleclick.net/pagead/adview",
  "https://example.invalid/pagead/adview","synthetic text https://googleads.g.doubleclick.net/pagead/adview"]){
  const opaque=field(909,join(field(1,text(url)),field(2,new Uint8Array(1100))));
  assert.deepEqual(invoke(wrap(homePath,items(opaque))),{});
 }
 const small=field(909,field(1,text("https://googleads.g.doubleclick.net/pagead/adview")));
 assert.deepEqual(invoke(wrap(homePath,items(small))),{});
 assert.deepEqual(invoke(field(999,wrap(homePath,items(ad)))),{});
});
test("unknown varints/fixed32/fixed64 and binary metadata survive an adjacent ad removal exactly",()=>{
 const varint=join(vi(888*8),Uint8Array.from([255,255,255,255,255,255,255,255,255,1]));
 const fixed32=join(vi(889*8+5),Uint8Array.from([1,2,3,4]));
 const fixed64=join(vi(890*8+1),new Uint8Array(8));
 const unknown=join(varint,fixed32,fixed64,field(891,Uint8Array.from([0,255,128,7])));
 const b=join(unknown,wrap(homePath,items(ad,normal)),unknown);
 const out=invoke(b);assert.ok(out.body);
 const originals=fields(b).filter(f=>f.id!==9).map(f=>[...f.raw]);
 assert.deepEqual(fields(out.body).filter(f=>f.id!==9).map(f=>[...f.raw]),originals);
});
test("HTTP status lines and statusCode are accepted without assuming an absent status means success",()=>{
 const b=wrap(homePath,items(ad));
 assert.ok(invoke(b,{status:"HTTP/1.1 200 OK"}).body);
 assert.deepEqual(invoke(b,{status:"HTTP/1.1 200 OK",code:legacy}),{});
 assert.ok(invoke(b,{status:undefined,statusCode:200}).body);
 for(const status of [undefined,0,204,304,401,503,"unrecognized","HTTP/1.1 500 Error"])
  assert.deepEqual(invoke(b,{status}),{});
});
test("only POST on exact feed routes is rewritten; unrelated Player/Guide bodies remain untouched",()=>{
 const b=wrap(homePath,items(ad));
 for(const method of ["GET","HEAD","DELETE",null])assert.deepEqual(invoke(b,{method}),{});
 for(const kind of ["player","get_watch","reel/reel_watch_sequence","guide","account/get_setting","browse/more"])
  assert.deepEqual(invoke(b,{kind}),{});
 for(const url of ["https://youtubei.googleapis.com.evil.invalid/youtubei/v1/browse","http://youtubei.googleapis.com/youtubei/v1/browse"])
  assert.deepEqual(invoke(b,{url}),{});
 assert.ok(invoke(b,{url:"https://youtubei.googleapis.com/youtubei/v1/browse?synthetic=1"}).body);
});
test("bodyBytes ArrayBuffer, number array, Buffer and sliced Uint8Array retain the same output",()=>{
 const b=wrap(homePath,items(ad,normal)),expected=invoke(b).body;
 const padded=join(new Uint8Array(9),b,new Uint8Array(7));
 for(const input of [b.buffer,[...b],Buffer.from(b),padded.subarray(9,9+b.length)]){
  const out=invoke(input,{mode:"bodyBytes"});assert.equal(out.binary,true);
  assert.deepEqual([...out.body],[...expected]);
 }
 for(const input of ["protobuf is not text",[257,1],[1.5,2],[-1,2]])assert.deepEqual(invoke(input),{});
});
test("a malformed sibling cancels the entire transformation rather than returning a partial feed",()=>{
 const b=join(wrap(homePath,items(ad,normal)),field(9,Uint8Array.from([0x80])));
 assert.deepEqual(invoke(b),{});
});
test("malformed tag/length/scalar/wire fields fail open with one completion",()=>{
 for(const b of [[0],[255],[10,10,1],[13,1],[9,1],[11],
  [255,255,255,255,31], [10,255,255,255,255,31],
  [8,255,255,255,255,255,255,255,255,255,2],
  [...vi(9*8),1]])assert.deepEqual(invoke(Uint8Array.from(b)),{});
});
test("empty, oversized, gzip and JSON byte bodies are passed through",()=>{
 for(const b of [new Uint8Array(0),new Uint8Array(5242881),Uint8Array.from([31,139,8,0]),text('{"synthetic":"json"}')])
  assert.deepEqual(invoke(b),{});
});
test("depth and global field budgets preserve the complete original response",()=>{
 let nested=wrap([49399797,1,50195462],items(ad));
 for(let i=0;i<9;i++)nested=wrap([58173949,1,58174010,4],nested);
 assert.deepEqual(invoke(field(9,nested)),{});
 const raw=join(vi(999*8),vi(0));const chunks=[wrap(homePath,items(ad))];
 for(let i=0;i<100001;i++)chunks.push(raw);
 assert.deepEqual(invoke(join(...chunks)),{});
});
test("hundreds of synthetic feed tiles preserve order, unknown metadata and all normal tiles",()=>{
 const original=[],expected=[];
 for(let i=0;i<600;i++){
  const tile=join(item(i%7===0?marker:"normal.eml"),field(71,text("synthetic-tile-"+i)));
  original.push(tile);if(i%7!==0)expected.push(tile);
 }
 checkList(wrap(homePath,items(...original)),homePath,expected);
});
test("deterministic negative fixtures preserve arbitrary opaque payloads",()=>{
 for(let seed=1;seed<=80;seed++){
  const bytes=Uint8Array.from({length:seed*17},(_,i)=>(i*73+seed*19)%256);
  const ordinary=field(999,bytes);
  assert.deepEqual(invoke(wrap(homePath,items(ordinary,normal))),{});
 }
});
test("runtime callback exceptions do not invoke done twice",()=>{
 invoke(wrap(homePath,items(ad)),{doneThrows:true});
});
test("feed script cannot make requests, persist identifiers or dynamically load code",()=>{
 for(const pattern of [/\bfetch\s*\(/,/\$httpClient/,/\$task/,/\$persistentStore/,/\$prefs/,
  /\beval\s*\(/,/\bFunction\s*\(/,/\brequire\s*\(/,/\bimport\s*\(/,/\$notify/,/\$notification/])
  assert.ok(!pattern.test(source));
});

const bundle=fs.readFileSync(path.resolve(__dirname,"../scripts/youtube-player-feed.js"),"utf8");
const originalPlayer=fs.readFileSync(path.resolve(__dirname,"../../v2/scripts/youtube-player-protobuf.js"),"utf8");
const watchPath=[1,3,...nextPath];
const playerFixture=join(field(7,text("synthetic-ad")),field(68,text("synthetic-slot")),
 field(2,new Uint8Array()),field(9,join(field(18,text("synthetic-ad-tracker")),field(1,text("synthetic-playback")))),
 field(99,text("synthetic-player-metadata")));
const nextFixture=wrap(nextPath,items(normal,ad,normal));
function watchFixture(next=nextFixture){
 return join(field(1,join(field(2,playerFixture),field(3,next),field(90,text("synthetic-content-metadata")))),
  field(77,text("synthetic-watch-metadata")));
}
test("get_watch recommendations were skipped by the old player and are now filtered",()=>{
 const input=watchFixture();
 const old=invoke(input,{kind:"get_watch",code:originalPlayer});
 assert.equal(values(at(old.body,watchPath),1).length,3);
 const out=checkList(input,watchPath,[normal,normal],{kind:"get_watch",code:bundle});
 assert.deepEqual([...at(out.body,[1,2])],[...at(old.body,[1,2])],"player output must equal original player bytes");
 assert.deepEqual([...at(out.body,[1,90])],[...at(input,[1,90])]);
 assert.deepEqual([...at(out.body,[77])],[...at(input,[77])]);
});
test("get_watch filter can remove next cards without altering its player bytes",()=>{
 const input=watchFixture();
 const out=checkList(input,watchPath,[normal,normal],{kind:"get_watch"});
 assert.deepEqual([...at(out.body,[1,2])],[...playerFixture]);
});
test("HTTP status-line player response reproduces skipped background/ad edit and adapter fixes it",()=>{
 assert.deepEqual(invoke(playerFixture,{kind:"player",status:"HTTP/1.1 200 OK",code:originalPlayer}),{});
 const expected=invoke(playerFixture,{kind:"player",code:originalPlayer}).body;
 const result=invoke(playerFixture,{kind:"player",status:"HTTP/1.1 200 OK",code:bundle}).body;
 assert.deepEqual([...result],[...expected]);
 assert.equal(values(result,7).length,0);assert.equal(values(result,68).length,0);
 assert.equal(at(result,[2,11,64657230]).length,2,"background active flag present");
});
test("adapter preserves the original numeric-status Player, Watch and Shorts outputs",()=>{
 const shorts=join(wrap([2,1,139608561,8],field(1,text("synthetic-overlay"))),
  wrap([2,1,139608561],field(2,text("synthetic-no-overlay"))));
 for(const [kind,input] of [["player",playerFixture],["get_watch",watchFixture(wrap(nextPath,items(normal)))],
  ["reel/reel_watch_sequence",shorts]]){
  const before=invoke(input,{kind,code:originalPlayer});
  const after=invoke(input,{kind,code:bundle});
  assert.deepEqual(after,before);
 }
});
test("single Watch callback preserves player edit when its Next body is malformed",()=>{
 const input=watchFixture(Uint8Array.from([0]));
 const old=invoke(input,{kind:"get_watch",code:originalPlayer});
 const after=invoke(input,{kind:"get_watch",code:bundle});
 assert.deepEqual(after,old);
});
test("adapter supports binary-body ArrayBuffer responses and callback exceptions once",()=>{
 const input=watchFixture();
 checkList(input.buffer,watchPath,[normal,normal],{kind:"get_watch",mode:"bodyBytes",status:"HTTP/2 200",code:bundle});
 invoke(input,{kind:"get_watch",code:bundle,doneThrows:true});
});
test("adapter does not turn error status lines or conflicting statuses into success",()=>{
 for(const options of [{status:"HTTP/1.1 403 Forbidden"},{status:"HTTP/1.1 200 OK",statusCode:403}]){
  assert.deepEqual(invoke(playerFixture,{...options,kind:"player",code:bundle}),{});
  assert.deepEqual(invoke(watchFixture(),{...options,kind:"get_watch",code:bundle}),{});
 }
});
test("diagnostics explain unmatched schema, unknown binary type and valid recognized Home without ads",()=>{
 const cases=[
  [wrap(homePath,items(ad)),{},"filtered"],
  [wrap(homePath,items(normal)),{},"no_ad_match"],
  [field(999,text("synthetic-unknown-root")),{},"schema_unmatched"],
  ["synthetic-string-body",{},"body_unavailable"],
  [wrap(homePath,items(ad)),{status:undefined},"status_skip"],
  [wrap(homePath,items(ad)),{method:"GET"},"method_skip"],
  [Uint8Array.from([0]),{},"parse_error"],
  [Uint8Array.from([31,139,8,0]),{},"gzip_body"]
 ];
 for(const [bytes,options,result] of cases){
  const logs=[];invoke(bytes,{...options,logSink:s=>logs.push(s)});
  assert.equal(logs.length,1);assert.ok(logs[0].includes("result="+result));
 }
});
test("diagnostics never disclose request/query, byte content, marker, tokens or error messages",()=>{
 const secret="SYNTHETIC_PRIVATE_DO_NOT_LOG";
 const input=wrap(homePath,items(join(normal,field(999,text(secret))),ad));
 const logs=[];
 invoke(input,{url:"https://youtubei.googleapis.com/youtubei/v1/browse?token="+secret,logSink:s=>logs.push(s)});
 assert.equal(logs.length,1);
 assert.match(logs[0],/^KR-YT feed-r2 route=browse status=200 body=bytes size=(small|normal) result=filtered lists=\d+ removed=1$/);
 assert.ok(!logs[0].includes(secret));assert.ok(!logs[0].includes(marker));assert.ok(!logs[0].includes("https"));
 const result=invoke(input,{logSink:()=>{throw Error(secret);}});
 assert.ok(result.body,"a failing logger must not disrupt the transformation");
});
test("bundle embeds exact original player and reviewed feed; no runtime downloads or dynamic eval",()=>{
 assert.ok(bundle.includes(originalPlayer));assert.ok(bundle.includes(source));
 for(const pattern of [/\bfetch\s*\(/,/\$httpClient/,/\$task/,/\$persistentStore/,/\$prefs/,
  /\beval\s*\(/,/\bFunction\s*\(/,/\brequire\s*\(/,/\bimport\s*\(/,/\$notify/,/\$notification/])
  assert.ok(!pattern.test(bundle));
});

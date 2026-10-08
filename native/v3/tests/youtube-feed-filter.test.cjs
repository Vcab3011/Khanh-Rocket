"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.resolve(__dirname,"../scripts/youtube-feed-filter.js"),"utf8");
const legacy=fs.readFileSync(path.resolve(__dirname,"../scripts/youtube-banner-filter.js"),"utf8");
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
test("only POST on exact Browse/Next/Search routes is rewritten; Player/Watch/Guide remain untouched",()=>{
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
test("feed script cannot make requests, persist identifiers, log traffic or dynamically load code",()=>{
 for(const pattern of [/\bfetch\s*\(/,/\$httpClient/,/\$task/,/\$persistentStore/,/\$prefs/,
  /console\s*[.[]/,/\beval\s*\(/,/\bFunction\s*\(/,/\brequire\s*\(/,/\bimport\s*\(/,/\$notify/,/\$notification/])
  assert.ok(!pattern.test(source));
});

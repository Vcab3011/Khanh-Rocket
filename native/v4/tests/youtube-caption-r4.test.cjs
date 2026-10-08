"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.resolve(__dirname,"../scripts/youtube-response-r4.js"),"utf8");
function enc(n){const a=[];do{let b=n%128;n=Math.floor(n/128);a.push(n?b+128:b);}while(n);return Buffer.from(a);}
function join(...x){return Buffer.concat(x);}
function field(id,value){return join(enc(id*8+2),value?enc(value.length):enc(0),value||Buffer.alloc(0));}
function scalar(id,value){return join(enc(id*8),enc(value));}
function decoded(input){
 const b=Buffer.from(input),out=[];let p=0;function read(){let n=0,m=1;for(let k=0;k<10;k++){if(p>=b.length)throw Error("end");let c=b[p++];n+=(c&127)*m;if(!(c&128))return n;m*=128;}throw Error("varint");}
 while(p<b.length){let id=read(),wire=id%8,val;if(wire===2){let len=read();val=b.slice(p,p+len);p+=len;}else if(wire===0)val=read();else throw Error("unsupported");
 out.push({id:Math.floor(id/8),wire,value:val});}
 return out;
}
const vals=(b,id)=>decoded(b).filter(x=>x.id===id).map(x=>x.value);
function capsule(){
 const caption=join(field(1,Buffer.from("https://www.youtube.com/api/timedtext?v=abc&lang=en")),
  field(4,Buffer.from("en")),scalar(7,1));
 const audio=join(scalar(2,0),scalar(3,0),scalar(11,1));
 return field(10,field(51621377,join(field(1,caption),field(2,audio),field(99,Buffer.from("keep-safe")))));
}
function run(raw,{route="player",arg='{"captionLang":"vi"}',status=200,method="POST"}={}){
 const received=[],ctx={$request:{url:"https://youtubei.googleapis.com/youtubei/v1/"+route,method},
  $response:{status,body:Uint8Array.from(raw)},
  $argument:arg,
  $done:x=>received.push(x),
  console:{log:()=>{}},
  Uint8Array,ArrayBuffer
 };
 vm.runInNewContext(source,ctx,{timeout:1600});
 assert.equal(received.length,1,"one callback");
 return JSON.parse(JSON.stringify({...received[0],body:received[0].body?Array.from(received[0].body):undefined}));
}
function trackList(player){return vals(vals(player,10)[0],51621377)[0];}
test("R4 adds a Vietnamese translated timedtext track without altering known existing one",()=>{
 const original=capsule();const out=run(original);
 assert.ok(out.body,"R4 must emit new binary bytes");
 const list=trackList(Buffer.from(out.body));
 assert.equal(vals(list,1).length,2);
 const target=vals(list,1)[1];
 assert.ok(vals(target,1)[0].toString().includes("tlang=vi"));
 assert.equal(vals(target,4)[0].toString(),"vi");
 assert.equal(vals(target,3)[0].toString(),".vi");
 assert.ok(Buffer.from(list).includes(Buffer.from("keep-safe")));
 const audio=vals(list,2)[0];
 assert.ok(decoded(audio).some(x=>x.id===11&&x.value===3));
 assert.ok(decoded(audio).some(x=>x.id===2&&x.value===1));
});
test("does not create duplicate translated track on subsequent response processing",()=>{
 const first=run(capsule());
 const second=run(Buffer.from(first.body));
 assert.ok(second.body===undefined || vals(trackList(Buffer.from(second.body)),1).length===2);
});
test("response nested inside get_watch is supported",()=>{
 const watch=field(1,field(2,capsule()));
 const result=run(watch,{route:"get_watch"});
 assert.ok(result.body);
 const p=vals(vals(Buffer.from(result.body),1)[0],2)[0];
 assert.equal(vals(trackList(p),1).length,2);
});
test("disable captions, reject non-200, non-POST and unsafe timing",()=>{
 for(const options of [{arg:'{"captionLang":"off"}'},{method:"GET"},{status:404},{status:"HTTP/1.1 500 Internal Server Error"}]){
  const r=run(capsule(),options);
  assert.ok(!r.body,"should not modify response "+JSON.stringify(options));
 }
});
test("untrusted caption origins are not used to build translated-track URLs",()=>{
 const track=field(10,field(51621377,field(1,join(field(1,Buffer.from("https://malicious.example/path")),field(4,Buffer.from("en"))))));
 assert.ok(!run(track).body);
});
test("V4 caption injection does not include off-device translation, storage or remote calls",()=>{
 for(const term of ["translate.google.com","$httpClient","$task.fetch","fetch(","$persistentStore","eval(","new Function("]){
  assert.ok(!source.includes(term),term);
 }
});

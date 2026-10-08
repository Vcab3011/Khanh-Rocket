"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,"../scripts");
const files={
  guide:fs.readFileSync(path.join(root,"youtube-guide.js"),"utf8"),
  caption:fs.readFileSync(path.join(root,"youtube-response-r4.js"),"utf8"),
  local:fs.readFileSync(path.join(root,"subscriptions-convert.js"),"utf8")
};
let state=0x12ab34cd;
function rand(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state;}
function randomBytes(count){const b=new Uint8Array(count);for(let i=0;i<count;i++)b[i]=rand()%256;return b;}
function run(code,ctx){
 let answers=[];
 vm.runInNewContext(code,{...ctx,$done:(v)=>answers.push(v),console:{log:()=>{}}},{timeout:350});
 assert.equal(answers.length,1,"exactly one callback");
 return answers[0];
}
test("V4 protobuf filters fail open on deterministic malformed input stream",()=>{
 for(let i=0;i<100;i++){
  let body=randomBytes(rand()%1024),response={status:200,body};
  const guide=run(files.guide,{$request:{url:"https://youtubei.googleapis.com/youtubei/v1/guide",method:"POST"},$response:response});
  assert.equal(Object.keys(guide).length,0,"Guide must keep unknown binary untouched");
  const caption=run(files.caption,{$request:{url:"https://youtubei.googleapis.com/youtubei/v1/player",method:"POST"},$response:response,$argument:'{"captionLang":"vi"}'});
  assert.equal(Object.keys(caption).length,0,"Caption must keep unknown binary untouched");
 }
});
test("local parser never returns raw malformed input in error on random untrusted share URI",()=>{
 for(let i=0;i<150;i++){
  const junk=Buffer.from(randomBytes(1+rand()%80)).toString("hex");
  const request={$request:{url:"https://khanh.invalid/v2/convert",method:"POST",
   headers:{"Content-Type":"application/json"},body:JSON.stringify({links:["untrusted://"+junk],output:"json"})}};
  const response=run(files.local,request);
  const raw=response.response.body;
  assert.equal(response.response.status,422);
  assert.equal(JSON.parse(raw).error,"invalid_subscription");
  assert.ok(!raw.includes(junk));
 }
});

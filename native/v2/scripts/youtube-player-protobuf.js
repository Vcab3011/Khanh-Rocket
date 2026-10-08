/* Khanh Rocket Native V2 — independent YouTube Player/Watch protobuf editor.
 * From observed protobuf field-number schema, NOT copied from third-party runtime.
 * Implements: remove player.adPlacements(7), adSlots(68),
 * playbackTracking.pageadViewthroughconversion(18), enable background player,
 * enable existing mini-player render. Unknown protobuf fields preserved raw.
 *
 * Does NOT implement Browse/Next ad classification, caption translation,
 * lyrics translation, Shorts/Guide or account settings. Not feature parity.
 * Shadowrocket CANARY only, no network/storage/external JS.
 */
(function(){
 "use strict";
 function done(v){return $done(v||{});}
 try{
  var req=(typeof $request==="object"&&$request)||{};
  var resp=(typeof $response==="object"&&$response)||{};
  var url=String(req.url||"");
  var player=/^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/player(?:[?#]|$)/.test(url);
  var watch=/^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/get_watch(?:[?#]|$)/.test(url);
  if(!player&&!watch)return done({});
  if(Number(resp.status||resp.statusCode||200)!==200)return done({});
  var value=resp.bodyBytes!==undefined?resp.bodyBytes:resp.body;
  var original=toBytes(value);
  if(!original||!original.length||original.length>5242880)return done({});
  var result=watch?rewriteNested(original,[1,2],rewritePlayer):rewritePlayer(original);
  if(!result.changed)return done({});
  if(resp.bodyBytes!==undefined)return done({bodyBytes:result.bytes.buffer.slice(result.bytes.byteOffset,result.bytes.byteOffset+result.bytes.byteLength)});
  return done({body:result.bytes});
 }catch(_){return done({});}

 function toBytes(v) {
  if(v instanceof Uint8Array)return v;
  if(typeof ArrayBuffer!=="undefined"&&v instanceof ArrayBuffer)return new Uint8Array(v);
  if(Array.isArray(v))return new Uint8Array(v);
  return null;
 }
 function vint(b,p){
  var x=0,m=1;
  for(var n=0;n<10;n++){
   if(p>=b.length)throw Error("varint end");
   var c=b[p++];if(n<8)x+=(c&127)*m;
   if(!(c&128))return {value:x,end:p};
   m*=128;
  }
  throw Error("varint too long");
 }
 function intBytes(v){
  if(!Number.isSafeInteger(v)||v<0)throw Error("int");
  var a=[];do{var n=v%128;v=Math.floor(v/128);a.push(v?n+128:n);}while(v);
  return new Uint8Array(a);
 }
 function join(items){
  var l=0;for(var i=0;i<items.length;i++)l+=items[i].length;
  if(l>6291456)throw Error("result oversize");
  var b=new Uint8Array(l),offset=0;
  for(var j=0;j<items.length;j++){b.set(items[j],offset);offset+=items[j].length;}return b;
 }
 function field(no,wire,bytes){return join([intBytes(no*8+wire),wire===2?intBytes(bytes.length):new Uint8Array(0),bytes]);}
 function scan(bytes){
  var list=[],p=0;
  while(p<bytes.length){
   if(list.length>=20000)throw Error("field count");
   var start=p,key=vint(bytes,p);p=key.end;
   var no=Math.floor(key.value/8),wire=key.value%8,offset=p,end=p;
   if(no<1||no>536870911)throw Error("field tag");
   if(wire===0){end=vint(bytes,p).end;p=end;}
   else if(wire===1){end=p+8;p=end;}
   else if(wire===2){
    var length=vint(bytes,p);p=length.end;offset=p;end=p+length.value;p=end;
   }else if(wire===5){end=p+4;p=end;}
   else throw Error("wire type");
   if(p>bytes.length)throw Error("out of bounds");
   list.push({no:no,wire:wire,raw:bytes.slice(start,end),value:bytes.slice(offset,end)});
  }
  return list;
 }
 function rewriteNested(data,path,cb){
  if(!path.length)return cb(data);
  var f=scan(data),chunks=[],changed=false;
  for(var i=0;i<f.length;i++){
   var a=f[i];
   if(a.no===path[0]&&a.wire===2){
    var result=rewriteNested(a.value,path.slice(1),cb);
    if(result.changed){chunks.push(field(a.no,2,result.bytes));changed=true;continue;}
   }
   chunks.push(a.raw);
  }
  return {changed:changed,bytes:changed?join(chunks):data};
 }
 function setActive(data){
  var attrs=scan(data),chunks=[],changed=false;
  for(var i=0;i<attrs.length;i++){
   if(attrs[i].no===1&&attrs[i].wire===0){
    chunks.push(field(1,0,intBytes(1)));changed=true;
   }else chunks.push(attrs[i].raw);
  }
  if(!changed)return {bytes:data,changed:false};
  return {bytes:join(chunks),changed:true};
 }
 function rewriteMini(mini){
  return rewriteNested(mini,[151635310],setActive);
 }
 function rewriteStatus(data){
  var fs=scan(data),chunks=[],found=false,changed=false;
  for(var i=0;i<fs.length;i++){
   var f=fs[i];
   if(f.no===11&&f.wire===2){found=true;changed=true;continue;}
   if(f.no===21&&f.wire===2){
    var result=rewriteMini(f.value);
    if(result.changed){chunks.push(field(21,2,result.bytes));changed=true;continue;}
   }
   chunks.push(f.raw);
  }
  // Same binary field schema as upstream backgroundPlayer.backgroundPlayerRender.active.
  var background=field(64657230,2,field(1,0,intBytes(1)));
  chunks.push(field(11,2,background));
  return {changed:true,bytes:join(chunks)};
 }
 function rewriteTracking(data){
  var fields=scan(data),out=[],changed=false;
  for(var i=0;i<fields.length;i++){
   if(fields[i].no===18){changed=true;continue;}
   out.push(fields[i].raw);
  }
  return {bytes:changed?join(out):data,changed:changed};
 }
 function rewritePlayer(data){
  var fs=scan(data),out=[],changed=false;
  for(var i=0;i<fs.length;i++){
   var f=fs[i];
   if(f.no===7||f.no===68){changed=true;continue;}
   if(f.no===2&&f.wire===2){
    var s=rewriteStatus(f.value);
    if(s.changed){out.push(field(2,2,s.bytes));changed=true;continue;}
   }
   if(f.no===9&&f.wire===2){
    var t=rewriteTracking(f.value);
    if(t.changed){out.push(field(9,2,t.bytes));changed=true;continue;}
   }
   out.push(f.raw);
  }
  return {bytes:changed?join(out):data,changed:changed};
 }
})();

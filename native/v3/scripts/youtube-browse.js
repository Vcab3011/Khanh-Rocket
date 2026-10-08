/*
 * Khanh Rocket V3 - independent YouTube Browse/Next/Search protobuf filter.
 * Uses field paths recovered by analyzing upstream message schemas, not their JS.
 * Removes only high-confidence advertisement placeholders in rich-item lists.
 * Preserves unknown fields and all unrelated messages byte-for-byte.
 * NO network calls, persistent lists, URL logging, account state or imports.
 *
 * Coverage is deliberately conservative and NOT equivalent to the full
 * upstream dynamic ad classifier, captions, Guide or lyrics translation.
 */
(function () {
 "use strict";
 function done(v){return $done(v||{});}
 try{
  var req=(typeof $request==="object"&&$request)||{};
  var resp=(typeof $response==="object"&&$response)||{};
  var url=String(req.url||"");
  var match=url.match(/^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/(browse|next|search)(?:[?#]|$)/);
  if(!match||Number(resp.status||resp.statusCode||200)!==200)return done({});
  var incoming=resp.bodyBytes!==undefined?resp.bodyBytes:resp.body;
  var b=asBytes(incoming);
  if(!b||b.length<1||b.length>5242880)return done({});
  var result=transform(b,match[1],0);
  if(!result.changed)return done({});
  if(resp.bodyBytes!==undefined)
   return done({bodyBytes:result.bytes.buffer.slice(result.bytes.byteOffset,result.bytes.byteOffset+result.bytes.byteLength)});
  return done({body:result.bytes});
 }catch(_){return done({});}

 function asBytes(x){
  if(x instanceof Uint8Array)return x;
  if(typeof ArrayBuffer!=="undefined"&&x instanceof ArrayBuffer)return new Uint8Array(x);
  if(Array.isArray(x))return new Uint8Array(x);
  return null;
 }
 function vread(b,p){
  var n=0,m=1;
  for(var i=0;i<10;i++){
   if(p>=b.length)throw Error("truncated varint");
   var a=b[p++];if(i<8)n+=(a&127)*m;
   if(!(a&128))return {n:n,end:p};
   m*=128;
  }
  throw Error("varint exceeds 10 bytes");
 }
 function vwrite(n){
  if(!Number.isSafeInteger(n)||n<0)throw Error("invalid number");
  var a=[];do{var r=n%128;n=Math.floor(n/128);a.push(n?r+128:r);}while(n);
  return new Uint8Array(a);
 }
 function concat(parts){
  var size=0;for(var i=0;i<parts.length;i++)size+=parts[i].length;
  if(size>6291456)throw Error("message too large");
  var out=new Uint8Array(size),cursor=0;
  for(var j=0;j<parts.length;j++){out.set(parts[j],cursor);cursor+=parts[j].length;}
  return out;
 }
 function field(n,b){return concat([vwrite(n*8+2),vwrite(b.length),b]);}
 function scan(b){
  var fields=[],p=0;
  while(p<b.length){
   if(fields.length>=20000)throw Error("field limit");
   var start=p,tag=vread(b,p);p=tag.end;
   var n=Math.floor(tag.n/8),wire=tag.n%8,begin=p,end=p;
   if(n<1||n>536870911)throw Error("invalid protobuf tag");
   if(wire===0){end=vread(b,p).end;p=end;}
   else if(wire===1){end=p+8;p=end;}
   else if(wire===2){
    var len=vread(b,p);p=len.end;begin=p;end=p+len.n;p=end;
   }else if(wire===5){end=p+4;p=end;}
   else throw Error("unsupported wire type");
   if(p>b.length||p<start)throw Error("invalid protobuf size");
   fields.push({id:n,wire:wire,raw:b.slice(start,p),value:b.slice(begin,end)});
  }
  return fields;
 }
 function hasASCII(b,needle){
  // Deliberately matches a literal ASCII marker, not arbitrary low-entropy byte runs.
  var marker=[];
  for(var k=0;k<needle.length;k++)marker.push(needle.charCodeAt(k));
  for(var i=0;i<=b.length-marker.length;i++){
   var equal=true;
   for(var j=0;j<marker.length;j++)if(b[i+j]!==marker[j]){equal=false;break;}
   if(equal)return true;
  }
  return false;
 }
 function isAdItem(body){
  var fields=scan(body);
  if(hasASCII(body,"inline_injection_entrypoint_layout.eml"))return true;
  for(var i=0;i<fields.length;i++){
   var f=fields[i];
   // Mirrors upstream's known-field vs unknown-field heuristic with a
   // stronger guard: do NOT delete small opaque fields on a substring match.
   if(f.id!==153515154&&f.wire===2&&f.value.length>=1000&&
      hasASCII(f.value,"pagead"))return true;
  }
  return false;
 }
 // Field-number schema recovered for Browse/Next/Search subtrees.
 var routes={
  browse:{9:"content",10:"content"},
  next:{7:"next_content",8:"content"},
  search:{4:"content"},
  next_content:{51779735:"next_result"},
  next_result:{1:"content"},
  content:{58173949:"single_column",49399797:"section_list"},
  single_column:{1:"tab_supported"},
  tab_supported:{58174010:"tab"},
  tab:{4:"content"},
  section_list:{1:"section_supported"},
  section_supported:{50195462:"rich_items",51845067:"shelf"},
  shelf:{5:"rich_section"},
  rich_section:{51431404:"rich_items"}
 };
 function transform(bytes,type,depth){
  if(depth>16)throw Error("maximum protobuf depth exceeded");
  var spec=routes[type]||{},fs=scan(bytes),out=[],changed=false;
  for(var i=0;i<fs.length;i++){
   var f=fs[i],child=spec[f.id];
   if(f.wire===2&&type==="rich_items"&&f.id===1){
    if(isAdItem(f.value)){changed=true;continue;}
   }
   if(f.wire===2&&child){
    var result=transform(f.value,child,depth+1);
    if(result.changed){out.push(field(f.id,result.bytes));changed=true;continue;}
   }
   out.push(f.raw);
  }
  return {changed:changed,bytes:changed?concat(out):bytes};
 }
})();

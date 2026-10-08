/* Khanh Rocket: first-party Shadowrocket YouTube feed/search canary.
 * Typed paths reviewed against Module_IOS at 34865755c1aee7ba770c1afa364254d8924cfd85.
 * No upstream runtime code, network, persistence or player modifications.
 * Diagnostic summaries contain enums and aggregate counts only, never traffic.
 * Exact EML layouts and structured ad-tracker evidence only; unknown schemas pass.
 */
(function () {
 "use strict";
 var MAX_BODY=5242880, MAX_DEPTH=24, MAX_FIELDS=100000, MAX_WORK=33554432;
 var visited=0,work=0,exhausted=false,lists=0,removed=0;
 var diagnostic={route:"other",status:"unknown",body:"none",size:"none",result:"skip"};
 var routes={
  browse:{9:"content",10:"content"},
  next:{7:"next_content",8:"content"},
  search:{4:"content",7:"search_command"},
  get_watch:{1:"watch_contents"},watch_contents:{3:"next"},
  search_command:{50195462:"rich_items",49399797:"section_list"},
  next_content:{51779735:"next_result"},next_result:{1:"content"},
  content:{58173949:"single_column",49399797:"section_list"},
  single_column:{1:"tab_supported"},tab_supported:{58174010:"tab"},tab:{4:"content"},
  section_list:{1:"section_supported"},
  section_supported:{50195462:"rich_items",51845067:"shelf"},
  shelf:{5:"rich_section"},rich_section:{51431404:"rich_items"}
 };
 var answer;
 try {answer=run();}catch(_){answer={};diagnostic.result="parse_error";}
 report();
 // Complete exactly once, even if the runtime callback itself throws.
 $done(answer);

 function run(){
  var req=(typeof $request==="object"&&$request)||{},resp=(typeof $response==="object"&&$response)||{};
  var route=typeof req.url==="string" && req.url.match(/^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/(browse|next|search|get_watch)(?:\?|$)/);
  if(!route)return {};
  diagnostic.route=route[1];
  var status=responseStatus(resp);diagnostic.status=status===null?"unknown":String(status);
  if(req.method!=="POST"){diagnostic.result="method_skip";return {};}
  if(status!==200){diagnostic.result="status_skip";return {};}
  var binary=resp.bodyBytes!==undefined,b=asBytes(binary?resp.bodyBytes:resp.body);
  diagnostic.body=b?"bytes":typeof (binary?resp.bodyBytes:resp.body)==="string"?"string":"unsupported";
  if(!b){diagnostic.result="body_unavailable";return {};}
  diagnostic.size=b.length===0?"empty":b.length<65536?"small":b.length<=MAX_BODY?"normal":"oversize";
  if(!b.length || b.length>MAX_BODY){diagnostic.result="size_skip";return {};}
  if(b[0]===31 && b[1]===139){diagnostic.result="gzip_body";return {};}
  var result=transform(b,route[1],0);
  if(exhausted){diagnostic.result="budget_skip";return {};}
  if(!result.changed){diagnostic.result=lists?"no_ad_match":"schema_unmatched";return {};}
  diagnostic.result="filtered";
  if(binary)return {bodyBytes:result.bytes.buffer.slice(result.bytes.byteOffset,result.bytes.byteOffset+result.bytes.byteLength)};
  return {body:result.bytes};
 }
 function report(){
  if(diagnostic.route==="other")return;
  try {
   if(typeof console!=="undefined" && typeof console.log==="function")
    console.log("KR-YT feed-r2 route="+diagnostic.route+" status="+diagnostic.status+
     " body="+diagnostic.body+" size="+diagnostic.size+" result="+diagnostic.result+
     " lists="+lists+" removed="+(diagnostic.result==="filtered"?removed:0));
  }catch(_){}
 }
 function responseStatus(resp){
  var s=resp.statusCode!==undefined?resp.statusCode:resp.status;
  if(typeof s==="number")return Number.isInteger(s)?s:null;
  if(typeof s!=="string")return null;
  var m=s.match(/^(?:HTTP\/\d(?:\.\d)?\s+)?([1-5]\d\d)(?:\s[^\r\n]*)?$/);
  return m?Number(m[1]):null;
 }
 function asBytes(value){
  if(value instanceof Uint8Array)return value;
  if(typeof ArrayBuffer!=="undefined" && value instanceof ArrayBuffer)return new Uint8Array(value);
  if(Array.isArray(value)){
   for(var i=0;i<value.length;i++)if(!Number.isInteger(value[i]) || value[i]<0 || value[i]>255)return null;
   return new Uint8Array(value);
  }
  return null;
 }
 function uint32(b,p){
  var value=0,m=1;
  for(var i=0;i<5;i++){
   if(p>=b.length)throw Error("truncated uint32");
   var c=b[p++];
   if(i===4 && c>15)throw Error("uint32 overflow");
   value+=(c&127)*m;
   if(!(c&128))return {value:value,end:p};
   m*=128;
  }
  throw Error("uint32 overflow");
 }
 function skipVarint(b,p){
  for(var i=0;i<10;i++){
   if(p>=b.length)throw Error("truncated scalar");
   var c=b[p++];
   if(i===9 && c>1)throw Error("uint64 overflow");
   if(!(c&128))return p;
  }
  throw Error("uint64 overflow");
 }
 function scan(b){
  work+=b.length;
  if(work>MAX_WORK){exhausted=true;throw Error("work budget");}
  var fields=[],p=0;
  while(p<b.length){
   if(++visited>MAX_FIELDS){exhausted=true;throw Error("field budget");}
   var start=p,tag=uint32(b,p);p=tag.end;
   var id=Math.floor(tag.value/8),wire=tag.value%8,begin=p;
   if(id<1 || id>536870911)throw Error("invalid tag");
   if(wire===0)p=skipVarint(b,p);
   else if(wire===1)p+=8;
   else if(wire===5)p+=4;
   else if(wire===2){var len=uint32(b,p);begin=len.end;p=begin+len.value;}
   else throw Error("unsupported wire type");
   if(p>b.length)throw Error("invalid length");
   fields.push({id:id,wire:wire,raw:b.subarray(start,p),value:b.subarray(begin,p)});
  }
  return fields;
 }
 function encode(n){
  var parts=[];do{var a=n%128;n=Math.floor(n/128);parts.push(n?a+128:a);}while(n);
  return new Uint8Array(parts);
 }
 function concat(parts){
  var size=0;for(var i=0;i<parts.length;i++)size+=parts[i].length;
  if(size>MAX_BODY)throw Error("output too large");
  var out=new Uint8Array(size),p=0;
  for(var j=0;j<parts.length;j++){out.set(parts[j],p);p+=parts[j].length;}
  return out;
 }
 function field(id,b){return concat([encode(id*8+2),encode(b.length),b]);}
 function pathValues(messages,path){
  var next=[];
  for(var i=0;i<messages.length;i++){
   var fs=scan(messages[i]);
   for(var j=0;j<fs.length;j++)if(fs[j].id===path[0]){
    if(fs[j].wire!==2)throw Error("typed field wire mismatch");
    next.push(fs[j].value);
   }
  }
  return path.length===1?next:(next.length?pathValues(next,path.slice(1)):[]);
 }
 function banner(elements){
  // Singular message fields merge; the last serialized scalar EML wins.
  var values=pathValues(elements,[172660663,2,183314536,1]);
  if(!values.length)return false;
  var eml=values[values.length-1],marker="inline_injection_entrypoint_layout.eml";
  if(eml.length<marker.length)return false;
  for(var i=0;i<marker.length;i++)if(eml[i]!==marker.charCodeAt(i))return false;
  return eml.length===marker.length || eml[marker.length]===124;
 }
 function trackerURL(b){
  if(b.length>8192)return false;
  var text="";
  for(var i=0;i<b.length;i++){
   if(b[i]<33 || b[i]>126)return false;
   text+=String.fromCharCode(b[i]);
  }
  return /^https:\/\/(?:googleads\.g\.doubleclick\.net|www\.googleadservices\.com)\/pagead\/(?:adview|viewthroughconversion|interaction|conversion)(?:[/?]|$)/.test(text);
 }
 function opaqueTracker(b,depth){
  if(depth>6)return false;
  var fs;
  // Unknown fields can be strings or binary data, not necessarily messages.
  try {fs=scan(b);}catch(_){return false;}
  for(var i=0;i<fs.length;i++)if(fs[i].wire===2){
   if(trackerURL(fs[i].value) || opaqueTracker(fs[i].value,depth+1))return true;
  }
  return false;
 }
 function adItem(item){
  var fs=scan(item),elements=[];
  for(var i=0;i<fs.length;i++)if(fs[i].id===153515154){
   if(fs[i].wire!==2)throw Error("renderer wire mismatch");
   elements.push(fs[i].value);
  }
  if(elements.length && banner(elements))return true;
  // Unknown opaque renderers need a structured, complete tracker URL.
  // A word such as "pagead" or an EML mention in a title is insufficient.
  for(var j=0;j<fs.length;j++)if(fs[j].id!==153515154 && fs[j].wire===2 &&
      fs[j].value.length>=1000 && opaqueTracker(fs[j].value,0))return true;
  // Also inspect only unknown fields of typed VideoInfo.VideoContext.VideoContent.
  var content=elements.length?pathValues(elements,[172660663,1,168777401,5]):[];
  for(var k=0;k<content.length;k++){
   var inner=scan(content[k]);
   for(var t=0;t<inner.length;t++)if(inner[t].id!==465160965 && inner[t].wire===2 &&
       inner[t].value.length>=1000 && opaqueTracker(inner[t].value,0))return true;
  }
  return false;
 }
 function transform(bytes,type,depth){
  if(depth>MAX_DEPTH)throw Error("depth limit");
  var fs=scan(bytes),spec=routes[type]||{},out=[],changed=false;
  if(type==="rich_items")lists++;
  // For a direct singular ElementRenderer, decide from all serialized fragments.
  var direct=[];
  if(type==="content")for(var d=0;d<fs.length;d++)if(fs[d].id===153515154){
   if(fs[d].wire!==2)throw Error("element wire mismatch");
   direct.push(fs[d].value);
  }
  var dropDirect=direct.length && banner(direct);
  for(var i=0;i<fs.length;i++){
   var f=fs[i],child=spec[f.id];
   if(dropDirect && f.id===153515154){changed=true;removed++;continue;}
   if(type==="rich_items" && f.id===1){
    if(f.wire!==2)throw Error("item wire mismatch");
    if(adItem(f.value)){changed=true;removed++;continue;}
   }
   if(child){
    if(f.wire!==2)throw Error("container wire mismatch");
    var result=transform(f.value,child,depth+1);
    if(result.changed){out.push(field(f.id,result.bytes));changed=true;continue;}
   }
   out.push(f.raw);
  }
  return {changed:changed,bytes:changed?concat(out):bytes};
 }
})();

/* Khanh Rocket Shadowrocket YouTube response engine, source-behavior revision 3.
 * Independently implemented typed transformations; original V2 player preserved.
 * One hook handles Player/Watch/feed/settings. No provider runtime dependency.
 */
(function(){
 "use strict";
 var request=(typeof $request==="object"&&$request)||{};
 var response=(typeof $response==="object"&&$response)||{};
 var answer={};
 var route=typeof request.url==="string" && request.url.match(/^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/(player|get_watch|browse|next|search|reel\/reel_watch_sequence|account\/get_setting)(?:\?|$)/);
 try {
  if(route && (request.method===undefined||request.method==="POST")){
   var bytes=asBytes(response.bodyBytes!==undefined?response.bodyBytes:response.body);
   if(bytes && bytes.length && bytes.length<=5242880){
    var input=copy(response);input.body=bytes;delete input.bodyBytes;
    var s=response.statusCode!==undefined?response.statusCode:response.status;
    var m=typeof s==="string" && s.match(/^(?:HTTP\/\d(?:\.\d)?\s+)?([1-5]\d\d)(?:\s[^\r\n]*)?$/);
    var known=typeof s==="number"?s:m?Number(m[1]):null;
    var conflict=response.status!==undefined && response.statusCode!==undefined &&
     String(response.status)!==String(response.statusCode) &&
     !(known===200 && /^HTTP\/\d(?:\.\d)?\s+200(?:\s[^\r\n]*)?$/.test(String(response.status)));
    if(!conflict && (known===200 || (s===undefined && known===null))){
     if(known===200)input.status=200;
     var p;
     if(/^(player|get_watch|reel\/reel_watch_sequence)$/.test(route[1])){
      player(request,input,function(v){if(p===undefined)p=v;});answer=p||{};
     }
     if(answer.body!==undefined)input.body=answer.body;
     var f;
     try{feed(request,input,function(v){if(f===undefined)f=v;});}catch(_){}
     if(f && f.body!==undefined)answer=f;
    }
   }
  }
 }catch(_){}
 try {
  if(route && typeof console!=="undefined" && typeof console.log==="function")
   console.log("KR-YT response-r3 route="+route[1]+" result="+(answer.body!==undefined?"changed":"pass"));
 }catch(_){}
 // Shadowrocket/Surge contract used by the reference adapter: body Uint8Array.
 $done(answer);
 function copy(o){var out={};Object.keys(o).forEach(function(k){out[k]=o[k];});return out;}
 function asBytes(v){
  if(v instanceof Uint8Array)return v;
  if(typeof ArrayBuffer!=="undefined" && v instanceof ArrayBuffer)return new Uint8Array(v);
  if(typeof ArrayBuffer!=="undefined" && ArrayBuffer.isView(v))return new Uint8Array(v.buffer,v.byteOffset,v.byteLength);
  if(Array.isArray(v)){
   for(var i=0;i<v.length;i++)if(!Number.isInteger(v[i])||v[i]<0||v[i]>255)return null;
   return new Uint8Array(v);
  }
  return null;
 }
 function player($request,$response,$done){
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
  var shorts=/^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/reel\/reel_watch_sequence(?:[?#]|$)/.test(url);
  if(!player&&!watch&&!shorts)return done({});
  if(Number(resp.status||resp.statusCode||200)!==200)return done({});
  var value=resp.bodyBytes!==undefined?resp.bodyBytes:resp.body;
  var original=toBytes(value);
  if(!original||!original.length||original.length>5242880)return done({});
  var result=shorts?rewriteShorts(original):(watch?rewriteNested(original,[1,2],rewritePlayer):rewritePlayer(original));
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
 function rewriteShorts(data){
  var fields=scan(data),out=[],changed=false;
  for(var i=0;i<fields.length;i++){
   var entry=fields[i];
   if(entry.no!==2||entry.wire!==2){out.push(entry.raw);continue;}
   var hasOverlay=false;
   var ef=scan(entry.value);
   for(var j=0;j<ef.length;j++)if(ef[j].no===1&&ef[j].wire===2){
    var commands=scan(ef[j].value);
    for(var k=0;k<commands.length;k++)if(commands[k].no===139608561&&commands[k].wire===2){
     var reel=scan(commands[k].value);
     for(var z=0;z<reel.length;z++)if(reel[z].no===8&&reel[z].wire===2)hasOverlay=true;
    }
   }
   if(hasOverlay)out.push(entry.raw);
   else changed=true;
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

 }
 function feed($request,$response,$done){
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
  "account/get_setting":{6:"setting_item",7:"setting_item"},
  setting_item:{88478200:"background_setting",66930374:"setting_category"},
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
  var route=typeof req.url==="string" && req.url.match(/^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/(browse|next|search|get_watch|account\/get_setting)(?:\?|$)/);
  if(!route)return {};
  diagnostic.route=route[1];
  var status=responseStatus(resp);diagnostic.status=status===null?"unknown":String(status);
  // Response metadata can be absent in runtime adapters. The upstream classifier
  // inspects typed bytes in that case. Missing metadata is not asserted as 200.
  if(req.method!==undefined && req.method!=="POST"){diagnostic.result="method_skip";return {};}
  if((status!==null && status!==200)||
     (status===null && (resp.status!==undefined||resp.statusCode!==undefined))){diagnostic.result="status_skip";return {};}
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
    console.log("KR-YT feed-r3 route="+diagnostic.route+" status="+diagnostic.status+
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
  // Opaque renderers may contain framing bytes rather than nested protobuf.
  // Match a complete canonical ad URL, not the upstream's arbitrary pagead word.
  if(rawTracker(b))return true;
  if(depth>6)return false;
  var fs;
  // Unknown fields can be strings or binary data, not necessarily messages.
  try {fs=scan(b);}catch(_){return false;}
  for(var i=0;i<fs.length;i++)if(fs[i].wire===2){
   if(trackerURL(fs[i].value) || opaqueTracker(fs[i].value,depth+1))return true;
  }
  return false;
 }
 function rawTracker(b){
  work+=b.length;if(work>MAX_WORK){exhausted=true;return false;}
  var prefix="https://",hosts=["googleads.g.doubleclick.net/pagead/","www.googleadservices.com/pagead/"];
  var actions=["adview","viewthroughconversion","interaction","conversion","paralleladview","aclk"];
  for(var i=0;i<=b.length-prefix.length;i++){
   if(b[i]!==104)continue;
   var j=0;for(;j<prefix.length && b[i+j]===prefix.charCodeAt(j);j++){}
   if(j!==prefix.length)continue;
   // Reject a URL embedded in another printable URL or identifier.
   if(i && ((b[i-1]>=48 && b[i-1]<=57)||(b[i-1]>=65 && b[i-1]<=90)||
      (b[i-1]>=97 && b[i-1]<=122)||b[i-1]===47||b[i-1]===95))continue;
   for(var h=0;h<hosts.length;h++){
    var at=i+prefix.length,k=0;
    for(;k<hosts[h].length && b[at+k]===hosts[h].charCodeAt(k);k++){}
    if(k!==hosts[h].length)continue;
    at+=k;
    for(var a=0;a<actions.length;a++){
     var t=0;for(;t<actions[a].length && b[at+t]===actions[a].charCodeAt(t);t++){}
     var end=at+t,c=b[end];
     if(t===actions[a].length && (end===b.length||c===63||c===47||c<33||c>126))return true;
    }
   }
  }
  return false;
 }
 function scalar(id,n){return concat([encode(id*8),encode(n)]);}
 function setBoolean(b,id){
  var fs=scan(b),parts=[];
  for(var i=0;i<fs.length;i++)if(fs[i].id!==id)parts.push(fs[i].raw);
  parts.push(scalar(id,1));return concat(parts);
 }
 function clientToggle(){
  // Category 10135's client-setting 151 toggle, from the source schema.
  var data=field(1,scalar(1,151));
  var enable=field(81212182,field(1,concat([data,scalar(3,1)])));
  var disable=field(81212182,field(1,data));
  return field(61331416,concat([field(5,enable),field(6,disable)]));
 }
 function settingsCategory(bytes){
  var fs=scan(bytes),category=0,found=false;
  for(var i=0;i<fs.length;i++){
   if(fs[i].id===4){if(fs[i].wire!==0)throw Error("category wire");category=uint32(fs[i].value,0).value;}
   if(fs[i].id===3 && fs[i].wire===2){
    var values=pathValues([fs[i].value],[61331416,5,81212182,1,1]);
    for(var j=0;j<values.length;j++){
     var fields=scan(values[j]);
     for(var k=0;k<fields.length;k++)if(fields[k].id===1 && fields[k].wire===0 &&
       uint32(fields[k].value,0).value===151)found=true;
    }
   }
  }
  if(category!==10135||found)return {changed:false,bytes:bytes};
  return {changed:true,bytes:concat([bytes,field(3,clientToggle())])};
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
  if(type==="background_setting")return {changed:true,bytes:setBoolean(bytes,2)};
  if(type==="setting_category")return settingsCategory(bytes);
  var fs=scan(bytes),spec=routes[type]||{},out=[],changed=false;
  var backgroundFound=false,settingFound=false;
  if(type==="account/get_setting")for(var s=0;s<fs.length;s++)if((fs[s].id===6||fs[s].id===7)&&fs[s].wire===2){
   settingFound=true;
   if(pathValues([fs[s].value],[88478200]).length)backgroundFound=true;
  }
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
  if(type==="account/get_setting" && settingFound && !backgroundFound){
   // Only background playback: never fabricate download/purchase entitlement.
   out.push(field(6,field(88478200,scalar(2,1))));changed=true;
  }
  return {changed:changed,bytes:changed?concat(out):bytes};
 }
})();

 }
})();

/* Khanh Rocket Native V2 — independently implemented Spotify protobuf transformer.
 * Original-compatible field IDs derived from observed protobuf message schema.
 * No protobufjs, eval, remote scripts, network, persistence or logs.
 * Strict binary wire parser preserves unknown fields and returns original on errors.
 * Caution: client-side apparent premium status is not genuine server entitlement.
 * Canary only; does NOT guarantee live Spotify feature parity.
 */
(function() {
 "use strict";
 function done(v){return $done(v||{});}
 try {
  var req=(typeof $request==="object"&&$request)||{};
  var resp=(typeof $response==="object"&&$response)||{};
  if(typeof req.url!=="string"||String(req.method||"").toUpperCase()!=="POST")return done({});
  var bootstrap=/^https:\/\/[^/]+\/bootstrap\/v1\/bootstrap(?:\?|$)/.test(req.url);
  var customize=/^https:\/\/[^/]+\/user-customization-service\/v1\/customize(?:\?|$)/.test(req.url);
  if(!bootstrap&&!customize)return done({});
  if(Number(resp.status||resp.statusCode||200)!==200)return done({});
  var incoming=resp.bodyBytes!==undefined?resp.bodyBytes:resp.body;
  var bytes=asBytes(incoming);
  if(!bytes||bytes.length<1||bytes.length>5242880)return done({});
  // Protobuf path: BootstrapResponse.ucsResponseV0.success.customization
  // .success.accountAttributesSuccess.accountAttributes
  // OR UcsResponseWrapper.success.accountAttributesSuccess.accountAttributes.
  var path=bootstrap?[2,1,1,1,3]:[1,3];
  var result=patchPath(bytes,path,modifyMap);
  if(!result.changed)return done({});
  if(resp.bodyBytes!==undefined)return done({bodyBytes:result.bytes.buffer.slice(result.bytes.byteOffset,result.bytes.byteOffset+result.bytes.byteLength)});
  return done({body:result.bytes});
 } catch(_){ return done({}); }

 function asBytes(b){
  if(b instanceof Uint8Array)return b;
  if(typeof ArrayBuffer!=="undefined"&&b instanceof ArrayBuffer)return new Uint8Array(b);
  if(Array.isArray(b))return new Uint8Array(b);
  return null;
 }
 function takeVar(b,p){
  var v=0,m=1,start=p;
  for(var i=0;i<10;i++){
   if(p>=b.length)throw Error("truncated varint");
   var x=b[p++];
   if(i<8)v+=(x&127)*m;
   if(!(x&128))return {value:v,next:p,length:p-start};
   m*=128;
  }
  throw Error("overlong varint");
 }
 function varBytes(num){
  if(!Number.isSafeInteger(num)||num<0)throw Error("bad integer");
  var out=[];
  do{var d=num%128;num=Math.floor(num/128);out.push(num?d+128:d);}while(num);
  return new Uint8Array(out);
 }
 function join(parts){
  var size=0;for(var i=0;i<parts.length;i++)size+=parts[i].length;
  if(size>6291456)throw Error("oversize output");
  var out=new Uint8Array(size),p=0;
  for(var j=0;j<parts.length;j++){out.set(parts[j],p);p+=parts[j].length;}
  return out;
 }
 function wireField(n,wire,payload){
  return join([varBytes(n*8+wire),wire===2?varBytes(payload.length):new Uint8Array(0),payload]);
 }
 function scan(b){
  var fields=[],p=0;
  while(p<b.length){
   if(fields.length>20000)throw Error("too many fields");
   var start=p,tag=takeVar(b,p);p=tag.next;
   var field=Math.floor(tag.value/8),wire=tag.value%8;
   if(field<1||field>536870911)throw Error("invalid field");
   var valStart=p,valEnd;
   if(wire===0){p=takeVar(b,p).next;valEnd=p;}
   else if(wire===1){p+=8;valEnd=p;}
   else if(wire===2){
    var len=takeVar(b,p);p=len.next;valStart=p;valEnd=p+len.value;p=valEnd;
   }else if(wire===5){p+=4;valEnd=p;}
   else throw Error("unsupported wire");
   if(p>b.length||p<start)throw Error("invalid field size");
   fields.push({id:field,wire:wire,raw:b.slice(start,p),value:b.slice(valStart,valEnd)});
  }
  return fields;
 }
 function patchPath(data,path,transform) {
  if(!path.length)return transform(data);
  var fields=scan(data),chunks=[],changed=false;
  for(var i=0;i<fields.length;i++){
   var f=fields[i];
   if(f.id===path[0]&&f.wire===2){
    var result=patchPath(f.value,path.slice(1),transform);
    if(result.changed){chunks.push(wireField(f.id,2,result.bytes));changed=true;continue;}
   }
   chunks.push(f.raw);
  }
  return {bytes:changed?join(chunks):data,changed:changed};
 }
 function utf8(txt){
  var bytes=[],t=unescape(encodeURIComponent(txt));
  for(var i=0;i<t.length;i++)bytes.push(t.charCodeAt(i));
  return new Uint8Array(bytes);
 }
 function ascii(b){
  var s="";for(var i=0;i<b.length;i++){if(b[i]>127)throw Error("nonascii map key");s+=String.fromCharCode(b[i]);}
  return s;
 }
 function rawValue(kind,value){
  return kind==="bool"?wireField(2,0,varBytes(value?1:0)):wireField(4,2,utf8(value));
 }
 function modifyMap(data){
  var date=new Date();date.setMonth(date.getMonth()+1);
  var expiry=date.toISOString().split(".")[0]+"Z";
  // Key -> [protobuf attribute oneof, value]. Matches baseline observable values.
  var vals={
   "smart-shuffle":["str","AVAILABLE"],"is-euterpe":["bool",true],
   "has-audiobooks-subscription":["bool",true],"type":["str","premium"],
   "payments-initial-campaign":["str","prepaid"],"subscription-enddate":["str",expiry],
   "social-session-free-tier":["bool",false],"can_use_superbird":["bool",true],
   "jam-social-session":["str","EXPANDED"],"offline":["bool",true],
   "audio-quality":["str","1"],"shuffle-algorithm":["str","RANDOM"],
   "is-thalia":["bool",true],"shuffle":["bool",false],"is-pigeon":["bool",true],
   "nft-disabled":["str","1"],"libspotify":["bool",true],
   "high-bitrate":["bool",true],"unrestricted":["bool",true],
   "catalogue":["str","premium"],"your-library-tags":["bool",true],
   "ads":["bool",false],"on-demand":["bool",true],
   "name":["str","Spotify Premium"],"loudness-levels":["str","1:-5.0,0.0,3.0:-2.0"],
   "product-expiry":["str",expiry],"social-session":["bool",true],
   "pick-and-shuffle":["bool",false],"offline-backup":["str","UNRESTRICTED"],
   "lyrics-offline":["bool",true],"financial-product":["str","pr:premium,tc:0"],
   "streaming-rules":["str",""],"mixing-tools":["str","EDIT"],
   "mobile":["bool",true],"player-license":["str","premium"],
   "com.spotify.madprops.use.ucs.product.state":["bool",true],
   "com.spotify.madprops.delivered.by.ucs":["bool",true]
  };
  var fields=scan(data),output=[],seen={};
  for(var i=0;i<fields.length;i++){
   var field=fields[i];
   if(field.id!==1||field.wire!==2){output.push(field.raw);continue;}
   var entry=scan(field.value),key=null;
   for(var j=0;j<entry.length;j++)if(entry[j].id===1&&entry[j].wire===2){key=ascii(entry[j].value);break;}
   if(key===null||!Object.prototype.hasOwnProperty.call(vals,key)){
    output.push(field.raw);continue;
   }
   seen[key]=true;
   var replaced=false,parts=[];
   for(var j=0;j<entry.length;j++){
    var f=entry[j];
    if(f.id===2&&f.wire===2){
     var attrs=scan(f.value),keep=[];
     for(var k=0;k<attrs.length;k++){
      if(attrs[k].id!==2&&attrs[k].id!==3&&attrs[k].id!==4)keep.push(attrs[k].raw);
     }
     keep.push(rawValue(vals[key][0],vals[key][1]));
     parts.push(wireField(2,2,join(keep)));replaced=true;
    }else parts.push(f.raw);
   }
   if(!replaced)parts.push(wireField(2,2,rawValue(vals[key][0],vals[key][1])));
   output.push(wireField(1,2,join(parts)));
  }
  var keys=Object.keys(vals);
  for(var a=0;a<keys.length;a++){
   var key=keys[a];if(seen[key])continue;
   output.push(wireField(1,2,join([
    wireField(1,2,utf8(key)),
    wireField(2,2,rawValue(vals[key][0],vals[key][1]))
   ])));
  }
  return {bytes:join(output),changed:true};
 }
})();

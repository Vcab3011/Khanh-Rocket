/* Khanh Rocket YouTube Guide V4 — first-party typed protobuf filter.
 * Clean-room field paths independently reconstructed from the upstream public
 * protobuf schema, without embedding upstream runtime or requesting the network.
 * Excludes only explicitly selected known menu entries.
 * Shadowrocket http-response binary body, guide endpoint only.
 */
(function () {
  "use strict";
  var LIMIT=5242880,MAX_FIELDS=20000,MAX_DEPTH=10,visited=0;
  var result={};
  try {
    var req=typeof $request==="object"&&$request?$request:{};
    var resp=typeof $response==="object"&&$response?$response:{};
    if(!/^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/guide(?:[?#]|$)/.test(String(req.url||"")))return $done({});
    if(req.method!==undefined && req.method!=="POST")return $done({});
    var status=resp.statusCode!==undefined?resp.statusCode:resp.status;
    if(status!==undefined){
      if(typeof status==="string"){
        var m=status.match(/^(?:HTTP\/\d(?:\.\d)?\s+)?([1-5]\d\d)(?:\s[^\r\n]*)?$/);
        status=m?Number(m[1]):null;
      }
      if(status!==200)return $done({});
    }
    var incoming=resp.bodyBytes!==undefined?resp.bodyBytes:resp.body;
    var bytes=toBytes(incoming);
    if(!bytes||!bytes.length||bytes.length>LIMIT||bytes[0]===31&&bytes[1]===139)return $done({});
    var opts={blockUpload:true,blockImmersive:true,blockShorts:false};
    if(typeof $argument==="string"&&$argument.length<2048){
      try {
        var parsed=JSON.parse($argument);
        if(parsed&&typeof parsed==="object"){
          ["blockUpload","blockImmersive","blockShorts"].forEach(function(k){
            if(typeof parsed[k]==="boolean")opts[k]=parsed[k];
          });
        }
      }catch(_){}
    }
    var drop={SPunlimited:true};
    if(opts.blockUpload)drop.FEuploads=true;
    if(opts.blockImmersive)drop.FEmusic_immersive=true;
    if(opts.blockShorts)drop.FEshorts=true;
    var changed=walkGuide(bytes,drop);
    if(changed.changed)result={body:changed.body};
  }catch(_){}
  return $done(result);

  function toBytes(value){
    if(value instanceof Uint8Array)return value;
    if(typeof ArrayBuffer!=="undefined"&&value instanceof ArrayBuffer)return new Uint8Array(value);
    if(typeof ArrayBuffer!=="undefined"&&ArrayBuffer.isView(value))
      return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
    if(Array.isArray(value)&&value.every(function(x){return Number.isInteger(x)&&x>=0&&x<256;}))return new Uint8Array(value);
    return null;
  }
  function readVar(b,p){
    var n=0,mul=1;
    for(var i=0;i<10;i++){
      if(p>=b.length)throw Error("truncated varint");
      var v=b[p++];
      if(i<8)n+=(v&127)*mul;
      if(!(v&128)){
        if(!Number.isSafeInteger(n))throw Error("unsafe varint");
        return {value:n,end:p};
      }
      mul*=128;
    }
    throw Error("overlong varint");
  }
  function fields(b){
    var a=[],p=0;
    while(p<b.length){
      if(++visited>MAX_FIELDS)throw Error("too many fields");
      var start=p,tag=readVar(b,p);p=tag.end;
      var n=Math.floor(tag.value/8),wire=tag.value%8,val=p;
      if(n<=0||n>536870911)throw Error("invalid field id");
      if(wire===0)p=readVar(b,p).end;
      else if(wire===1)p+=8;
      else if(wire===5)p+=4;
      else if(wire===2){
        var length=readVar(b,p);p=length.end;val=p;
        if(!Number.isSafeInteger(length.value)||length.value>LIMIT)throw Error("bad field size");
        p+=length.value;
      }else throw Error("unsupported wire");
      if(p>b.length)throw Error("overflow");
      a.push({id:n,wire:wire,raw:b.subarray(start,p),value:b.subarray(val,p)});
    }
    return a;
  }
  function writeVar(n){
    if(!Number.isSafeInteger(n)||n<0)throw Error("bad varint write");
    var output=[];
    do{var rem=n%128;n=Math.floor(n/128);output.push(n?rem+128:rem);}while(n);
    return new Uint8Array(output);
  }
  function concat(parts){
    var len=0;for(var i=0;i<parts.length;i++)len+=parts[i].length;
    if(len>LIMIT)throw Error("output oversized");
    var output=new Uint8Array(len),cursor=0;
    for(var j=0;j<parts.length;j++){output.set(parts[j],cursor);cursor+=parts[j].length;}
    return output;
  }
  function field(id,b){return concat([writeVar(id*8+2),writeVar(b.length),b]);}
  function browseId(item){
    var itemFields=fields(item);
    for(var i=0;i<itemFields.length;i++)if(itemFields[i].wire===2 &&
      (itemFields[i].id===318370163||itemFields[i].id===117501096)){
      var render=fields(itemFields[i].value);
      for(var j=0;j<render.length;j++)if(render[j].id===1&&render[j].wire===2){
        var bytes=render[j].value,ascii="";
        if(bytes.length>96)continue;
        for(var k=0;k<bytes.length;k++){
          if(bytes[k]<32||bytes[k]>126){ascii="";break;}
          ascii+=String.fromCharCode(bytes[k]);
        }
        if(ascii)return ascii;
      }
    }
    return "";
  }
  function walkGuide(b,drop){
    var root=fields(b),out=[],changed=false;
    for(var i=0;i<root.length;i++){
      var part=root[i];
      if((part.id!==4&&part.id!==6)||part.wire!==2){out.push(part.raw);continue;}
      var wrapper=fields(part.value),inner=[],local=false;
      for(var j=0;j<wrapper.length;j++){
        var section=wrapper[j];
        if(section.id!==117866661||section.wire!==2){inner.push(section.raw);continue;}
        var group=fields(section.value),items=[],removed=false;
        for(var k=0;k<group.length;k++){
          var entry=group[k];
          if(entry.id===1&&entry.wire===2&&drop[browseId(entry.value)]){
            removed=true;continue;
          }
          items.push(entry.raw);
        }
        if(removed){inner.push(field(117866661,concat(items)));local=true;}
        else inner.push(section.raw);
      }
      if(local){out.push(field(part.id,concat(inner)));changed=true;}
      else out.push(part.raw);
    }
    return {changed:changed,body:changed?concat(out):b};
  }
})();
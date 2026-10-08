/* V4 clean-room optional YouTube caption-track metadata adapter.
 * Does not fetch or translate captions itself. Adds a translated-track URL
 * only when an existing trusted youtube.com timedtext track is available.
 * Source schema: Player[10].Captions[51621377].Tracklist[1/2].
 * Unknown protobuf fields preserved, errors fail open, no persistence.
 */
function khanhCaptionV4(src,route,lang) {
 "use strict";
 if(!/^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(lang||"")||!src||src.length>5242880)
   return {changed:false,bytes:src};
 var count=0,work=0,LIMIT=5242880;
 function v(b,p) {
   var n=0,mul=1;
   for(var i=0;i<10;i++){
     if(p>=b.length)throw Error("varint truncated");
     var c=b[p++];
     if(i<8)n+=(c&127)*mul;
     if(!(c&128)){
       if(!Number.isSafeInteger(n))throw Error("varint unsafe");
       return {number:n,end:p};
     }
     mul*=128;
   }
   throw Error("overlong varint");
 }
 function fields(b) {
   work+=b.length;if(work>33554432)throw Error("work budget");
   var out=[],p=0;
   while(p<b.length) {
     if(++count>20000)throw Error("field budget");
     var start=p,key=v(b,p);p=key.end;
     var n=Math.floor(key.number/8),wire=key.number%8,begin=p;
     if(n<1||n>536870911)throw Error("invalid field id");
     if(wire===0)p=v(b,p).end;
     else if(wire===1)p+=8;
     else if(wire===5)p+=4;
     else if(wire===2){
       var l=v(b,p);p=l.end;begin=p;
       if(l.number>LIMIT)throw Error("field length");
       p+=l.number;
     }else throw Error("wire");
     if(p>b.length)throw Error("field overflow");
     out.push({id:n,wire:wire,raw:b.subarray(start,p),value:b.subarray(begin,p)});
   }
   return out;
 }
 function vint(n){
   if(!Number.isSafeInteger(n)||n<0)throw Error("encode");
   var out=[];do{var a=n%128;n=Math.floor(n/128);out.push(n?a+128:a);}while(n);
   return new Uint8Array(out);
 }
 function concat(parts){
   var len=0;for(var i=0;i<parts.length;i++)len+=parts[i].length;
   if(len>LIMIT)throw Error("out too large");
   var b=new Uint8Array(len),p=0;
   for(var j=0;j<parts.length;j++){b.set(parts[j],p);p+=parts[j].length;}
   return b;
 }
 function field(id,b){return concat([vint(id*8+2),vint(b.length),b]);}
 function scalar(id,x){return concat([vint(id*8),vint(x)]);}
 function ascii(input){
   if(input.length>4096)return "";
   var result="";
   for(var i=0;i<input.length;i++){
     if(input[i]<32||input[i]>126)return "";
     result+=String.fromCharCode(input[i]);
   }
   return result;
 }
 function bytes(str) {
   var arr=new Uint8Array(str.length);
   for(var i=0;i<str.length;i++)arr[i]=str.charCodeAt(i);
   return arr;
 }
 function getText(fs,id){
   for(var i=0;i<fs.length;i++)if(fs[i].id===id&&fs[i].wire===2)return ascii(fs[i].value);
   return "";
 }
 function rewriteList(b){
   var fs=fields(b),trackEntries=[],audioEntries=[];
   for(var i=0;i<fs.length;i++){
     if(fs[i].id===1&&fs[i].wire===2)trackEntries.push(fs[i]);
     if(fs[i].id===2&&fs[i].wire===2)audioEntries.push(fs[i]);
   }
   if(!trackEntries.length||trackEntries.length>=64)return {changed:false,bytes:b};
   var sourceUrl="",sourceLanguage="";
   for(var t=0;t<trackEntries.length;t++) {
     var ts=fields(trackEntries[t].value),trLang=getText(ts,4),base=getText(ts,1);
     if(trLang===lang)return {changed:false,bytes:b}; // no duplicate synthetic track
     if(!/^https:\/\/(?:www\.)?youtube\.com\/api\/timedtext\?/.test(base)||
         /(?:[?&])tlang=/.test(base)||base.indexOf("#")>=0)continue;
     if(!sourceUrl || trLang==="en"){sourceUrl=base;sourceLanguage=trLang;}
   }
   if(!sourceUrl||sourceUrl.length+lang.length+7>4096)return {changed:false,bytes:b};
   var url=sourceUrl+"&tlang="+encodeURIComponent(lang);
   var captionName="@Khanh ("+lang+")";
   var label=field(1,field(1,bytes(captionName)));
   var newTrack=concat([
     field(1,bytes(url)),field(2,label),field(3,bytes("."+lang)),
     field(4,bytes(lang)),scalar(7,1)
   ]);
   var index=trackEntries.length,parts=[];
   for(var k=0;k<fs.length;k++){
     var f=fs[k];
     if(f.id===2&&f.wire===2){
       var inner=fields(f.value),preserved=[];
       for(var j=0;j<inner.length;j++) {
         var q=inner[j];
         if(q.id!==3&&q.id!==11)preserved.push(q.raw);
       }
       preserved.push(scalar(2,index),scalar(3,index),scalar(11,3));
       parts.push(field(2,concat(preserved)));
     }else parts.push(f.raw);
   }
   parts.push(field(1,newTrack));
   return {changed:true,bytes:concat(parts)};
 }
 function modifyField(data,id,handler){
   var fs=fields(data),result=[],changed=false;
   for(var i=0;i<fs.length;i++){
     var f=fs[i];
     if(f.id===id&&f.wire===2){
       var edited=handler(f.value);
       if(edited.changed){result.push(field(f.id,edited.bytes));changed=true;continue;}
     }
     result.push(f.raw);
   }
   return {changed:changed,bytes:changed?concat(result):data};
 }
 function modifyCaptions(b){return modifyField(b,51621377,rewriteList);}
 function modifyPlayer(b){return modifyField(b,10,modifyCaptions);}
 function modifyWatchContents(b){return modifyField(b,2,modifyPlayer);}
 try {
   if(src[0]===31&&src[1]===139)return {changed:false,bytes:src};
   return route==="player"?modifyPlayer(src):
     route==="get_watch"?modifyField(src,1,modifyWatchContents):
     {changed:false,bytes:src};
 }catch(_){return {changed:false,bytes:src};}
}

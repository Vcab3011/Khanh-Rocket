/* Khanh Rocket Local Subscription Converter V4 — first-party.
 * Narrow local Shadowrocket request hook for khanh.invalid/v2/convert.
 * Supports URL share formats SS, Trojan, VMess (modern AEAD only),
 * and output: normalized JSON, URI list, or basic Clash YAML.
 * No remote fetch, scheduled sync, persistent credentials, eval, logging,
 * telemetry or external JS. NOT a full Sub-Store clone.
 */
(function(){
 "use strict";
 var ORIGIN="https://khanh.invalid/v2/convert",MAX_BODY=131072,MAX_NODES=200,MAX_LINK=8192;
 var ALPHABET="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
 function reply(status,payload){
   return $done({response:{status:status,headers:{"Content-Type":"application/json; charset=utf-8",
     "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"},
     body:JSON.stringify(payload)}});
 }
 function invalid(status,code){return reply(status,{ok:false,error:code});}
 function validString(v,max){return typeof v==="string"&&v.length>0&&v.length<=max&&!/[\x00-\x1f\x7f]/.test(v);}
 function validHost(h){
   if(!validString(h,253)||!/^[A-Za-z0-9][A-Za-z0-9.\-]*[A-Za-z0-9]$/.test(h)&&!/^[A-Za-z0-9]$/.test(h)||h.indexOf("..")>=0)return false;
   var labels=h.split(".");
   for(var i=0;i<labels.length;i++)if(!labels[i]||labels[i].length>63||labels[i][0]==="-"||labels[i].slice(-1)==="-")return false;
   return true;
 }
 function validPort(n){var v=Number(n);return Number.isInteger(v)&&v>=1&&v<=65535?v:null;}
 function decodeUtf8(bytes){
   var encoded="";
   for(var i=0;i<bytes.length;i++)encoded+="%"+("0"+bytes[i].toString(16)).slice(-2);
   return decodeURIComponent(encoded);
 }
 function decode64(s){
   s=s.replace(/-/g,"+").replace(/_/g,"/");
   if(!/^[a-zA-Z0-9+/]*={0,2}$/.test(s)||s.length%4===1)throw Error("invalid base64");
   s=s.replace(/=+$/,"");
   var bytes=[],buffer=0,bits=0;
   for(var i=0;i<s.length;i++){
     var c=s.charCodeAt(i),val=c>=65&&c<=90?c-65:c>=97&&c<=122?c-71:c>=48&&c<=57?c+4:c===43?62:c===47?63:-1;
     if(val<0)throw Error("base64 char");
     buffer=(buffer<<6)|val;bits+=6;
     if(bits>=8){bits-=8;bytes.push((buffer>>bits)&255);buffer&=(1<<bits)-1;}
   }
   if(buffer)throw Error("noncanonical padding");
   return decodeUtf8(bytes);
 }
 function utf8(s){
   var encoded=encodeURIComponent(s),bytes=[];
   for(var i=0;i<encoded.length;i++){
     if(encoded[i]==="%"){bytes.push(parseInt(encoded.slice(i+1,i+3),16));i+=2;}
     else bytes.push(encoded.charCodeAt(i));
   }
   return bytes;
 }
 function encode64(s){
   var b=utf8(s),out="";
   for(var i=0;i<b.length;i+=3){
     var a=b[i],bb=i+1<b.length?b[i+1]:0,c=i+2<b.length?b[i+2]:0;
     var num=a*65536+bb*256+c;
     out+=ALPHABET[(num>>>18)&63]+ALPHABET[(num>>>12)&63];
     if(i+1<b.length)out+=ALPHABET[(num>>>6)&63];
     if(i+2<b.length)out+=ALPHABET[num&63];
   }
   return out;
 }
 function query(q){
   var result={},parts=q?q.split("&"):[];
   if(parts.length>20)throw Error("too many params");
   for(var i=0;i<parts.length;i++){
     var j=parts[i].indexOf("=");var key=decodeURIComponent(j<0?parts[i]:parts[i].slice(0,j));
     var val=decodeURIComponent(j<0?"":parts[i].slice(j+1));
     if(!/^[a-zA-Z0-9_-]{1,32}$/.test(key)||key==="__proto__"||key==="constructor"||Object.prototype.hasOwnProperty.call(result,key))throw Error("param");
     result[key]=val;
   }
   return result;
 }
 function label(v){var name=v?decodeURIComponent(v):"Khanh";if(!validString(name,100))throw Error("name");return name;}
 function parse(link){
   if(!validString(link,MAX_LINK))throw Error("link length");
   var m,proto,port,server,node;
   if((m=link.match(/^ss:\/\/([^@/?#]+)@([^:/?#]+):([0-9]+)(?:#([^?#]*))?$/))){
     var credentials=decode64(m[1]),colon=credentials.indexOf(":");
     if(colon<1)throw Error("ss credentials");
     var method=credentials.slice(0,colon),pass=credentials.slice(colon+1);
     if(["aes-128-gcm","aes-256-gcm","chacha20-ietf-poly1305"].indexOf(method)<0||!validString(pass,256))throw Error("ss method");
     server=m[2];port=validPort(m[3]);if(!validHost(server)||!port)throw Error("server");
     return {protocol:"ss",name:label(m[4]),server:server,port:port,method:method,password:pass};
   }
   if((m=link.match(/^trojan:\/\/([^@/?#]+)@([^:/?#]+):([0-9]+)(?:\?([^#]*))?(?:#([^#]*))?$/))){
     server=m[2];port=validPort(m[3]);if(!validHost(server)||!port)throw Error("server");
     var password=decodeURIComponent(m[1]),params=query(m[4]||"");
     if(!validString(password,256)||params.security&&params.security!=="tls"||params.allowInsecure!==undefined)throw Error("trojan");
     var sni=params.sni||server;if(!validHost(sni))throw Error("sni");
     return {protocol:"trojan",name:label(m[5]),server:server,port:port,password:password,sni:sni};
   }
   if((m=link.match(/^vmess:\/\/([A-Za-z0-9+/_=-]{8,8192})$/))){
     var obj=JSON.parse(decode64(m[1]));
     if(!obj||typeof obj!=="object"||Array.isArray(obj))throw Error("vmess shape");
     server=obj.add;port=validPort(obj.port);
     if(!validHost(server)||!port||!validString(obj.id,64)||!/^([0-9a-f]{8}-){1}[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(obj.id))throw Error("vmess identity");
     if(obj.aid!==undefined&&String(obj.aid)!=="0")throw Error("legacy alterId unsupported");
     var net=obj.net||"tcp";if(net!=="tcp"&&net!=="ws")throw Error("network");
     var tls=obj.tls==="tls";if(obj.tls!==""&&obj.tls!=="tls"&&obj.tls!==undefined)throw Error("tls");
     var wsHost=obj.host||server;if(!validHost(wsHost))throw Error("ws host");
     var route=obj.path||"/";if(!validString(route,512)||route[0]!=="/")throw Error("path");
     return {protocol:"vmess",name:validString(obj.ps,100)?obj.ps:"Khanh",server:server,port:port,
       uuid:obj.id,network:net,tls:tls,wsHost:wsHost,path:route};
   }
   throw Error("unsupported format");
 }
 function yamlQuote(s){return JSON.stringify(s);}
 function yaml(nodes){
   var out=["proxies:"];
   for(var i=0;i<nodes.length;i++){
     var n=nodes[i];
     out.push("  - name: "+yamlQuote(n.name));
     out.push("    type: "+n.protocol);
     out.push("    server: "+yamlQuote(n.server));
     out.push("    port: "+n.port);
     if(n.protocol==="ss"){
       out.push("    cipher: "+yamlQuote(n.method));
       out.push("    password: "+yamlQuote(n.password));
     }else if(n.protocol==="trojan"){
       out.push("    password: "+yamlQuote(n.password));
       out.push("    sni: "+yamlQuote(n.sni));
       out.push("    skip-cert-verify: false");
     }else if(n.protocol==="vmess"){
       out.push("    uuid: "+yamlQuote(n.uuid));
       out.push("    alterId: 0");
       out.push("    cipher: auto");
       out.push("    tls: "+n.tls);
       out.push("    network: "+n.network);
       if(n.network==="ws"){
         out.push("    ws-opts:");
         out.push("      path: "+yamlQuote(n.path));
         out.push("      headers:");
         out.push("        Host: "+yamlQuote(n.wsHost));
       }
     }
   }
   return out.join("\n")+"\n";
 }
 function outputLinks(nodes){
   var result=[];
   for(var i=0;i<nodes.length;i++){
     var n=nodes[i],name="#"+encodeURIComponent(n.name);
     if(n.protocol==="ss")result.push("ss://"+encode64(n.method+":"+n.password)+"@"+n.server+":"+n.port+name);
     else if(n.protocol==="trojan")result.push("trojan://"+encodeURIComponent(n.password)+"@"+n.server+":"+n.port+"?security=tls&sni="+encodeURIComponent(n.sni)+name);
     else if(n.protocol==="vmess")result.push("vmess://"+encode64(JSON.stringify({v:"2",ps:n.name,add:n.server,port:String(n.port),id:n.uuid,aid:"0",scy:"auto",net:n.network,type:"none",host:n.wsHost,path:n.path,tls:n.tls?"tls":""})));
   }
   return result.join("\n");
 }
 try {
   var req=typeof $request==="object"&&$request?$request:{};
   if(req.url!==ORIGIN)return $done({});
   if(String(req.method||"").toUpperCase()!=="POST")return invalid(405,"method");
   var headers=req.headers||{},type="";
   Object.keys(headers).forEach(function(k){if(k.toLowerCase()==="content-type")type=String(headers[k]).toLowerCase();});
   if(!/^application\/json(?:;|$)/.test(type))return invalid(415,"content_type");
   if(typeof req.body!=="string"||!req.body.length||req.body.length>MAX_BODY)return invalid(413,"body_size");
   var input=JSON.parse(req.body);
   if(!input||typeof input!=="object"||!Array.isArray(input.links)||input.links.length>MAX_NODES)throw Error("links");
   if(["json","clash","uri"].indexOf(input.output)<0)throw Error("output");
   var nodes=[],seen=Object.create(null);
   for(var j=0;j<input.links.length;j++){
     var n=parse(input.links[j]);
     var key=n.protocol+"\u0000"+n.server+"\u0000"+n.port+"\u0000"+(n.password||n.uuid);
     if(seen[key])continue;
     seen[key]=1;
     nodes.push(n);
   }
   var result=input.output==="json"?nodes:input.output==="clash"?yaml(nodes):outputLinks(nodes);
   if(typeof result==="string"&&result.length>MAX_BODY*2)return invalid(413,"output_size");
   return reply(200,{ok:true,count:nodes.length,format:input.output,data:result});
 } catch(_){return invalid(422,"invalid_subscription");}
})();
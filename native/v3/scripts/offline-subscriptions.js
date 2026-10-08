/*
 * Khanh Rocket V3 - Offline Subscription Normalizer (first-party source)
 *
 * An intentionally LIMITED, stateless alternative to Sub-Store.
 * Endpoint: https://khanh.invalid/v1/health (GET)
 * Endpoint: https://khanh.invalid/v1/normalize (POST application/json)
 * Body: {"nodes":[{"protocol":"ss","server":"example.org","port":443,
 *                 "method":"aes-256-gcm","password":"...", "name":"Node"}]}
 *
 * No outbound requests, imports, eval, persistent storage, cron or logging.
 * No remote URL fetching or Gist/GitLab upload. No cookies or account tokens.
 * .invalid is reserved and does not belong to an unrelated public website.
 * STRICTLY EXPERIMENTAL. Must be routed to local Shadowrocket request hook.
 */
(function () {
  "use strict";
  var PREFIX = "https://khanh.invalid/v1/";
  var MAX_BODY = 131072;
  var MAX_NODES = 200;
  var KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  function respond(code, object) {
    return $done({response:{
      status:code,
      headers:{
        "Content-Type":"application/json; charset=utf-8",
        "Cache-Control":"no-store",
        "X-Content-Type-Options":"nosniff"
      },
      body:JSON.stringify(object)
    }});
  }
  function reject(code, message) {
    return respond(code,{ok:false,error:message});
  }
  function str(value, max) {
    return typeof value === "string" && value.length > 0 && value.length <= max &&
      !/[\u0000-\u001f\u007f]/.test(value);
  }
  function host(value) {
    if(!str(value,253))return false;
    // Restrict to conservative DNS/IPv4 syntax. No IPv6 or URI authority here.
    if(!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(value))return false;
    if(value.indexOf("..")>=0)return false;
    var labels=value.split(".");
    for(var i=0;i<labels.length;i++){
      if(labels[i].length>63||labels[i][0]==="-"||labels[i][labels[i].length-1]==="-")return false;
    }
    return true;
  }
  function port(value) {
    var n=typeof value==="number"?value:Number(value);
    return Number.isInteger(n)&&n>=1&&n<=65535?n:null;
  }
  function utf8(text) {
    // Locally encode to UTF-8; do not leak values through network helpers.
    var escaped=encodeURIComponent(text),values=[];
    for(var i=0;i<escaped.length;i++){
      if(escaped[i]==="%"){values.push(parseInt(escaped.substr(i+1,2),16));i+=2;}
      else values.push(escaped.charCodeAt(i));
    }
    return values;
  }
  function base64url(text) {
    var bytes=utf8(text),output="";
    for(var i=0;i<bytes.length;i+=3){
      var a=bytes[i],b=i+1<bytes.length?bytes[i+1]:0,c=i+2<bytes.length?bytes[i+2]:0;
      var bits=a*65536+b*256+c;
      output+=KEYS[Math.floor(bits/262144)&63]+KEYS[Math.floor(bits/4096)&63];
      if(i+1<bytes.length)output+=KEYS[Math.floor(bits/64)&63];
      if(i+2<bytes.length)output+=KEYS[bits&63];
    }
    return output;
  }
  function nodeLink(node) {
    if(!node||typeof node!=="object"||Array.isArray(node))throw Error("invalid node");
    var protocol=node.protocol,server=node.server,nport=port(node.port),name=node.name||"Khanh";
    if(!host(server)||!nport||!str(name,100))throw Error("invalid host, port or node name");
    if(protocol==="ss"){
      if(!["aes-128-gcm","aes-256-gcm","chacha20-ietf-poly1305"].includes(node.method)||
         !str(node.password,256))throw Error("unsupported SS method or password");
      return "ss://"+base64url(node.method+":"+node.password)+"@"+
        server+":"+nport+"#"+encodeURIComponent(name);
    }
    if(protocol==="trojan"){
      if(!str(node.password,256))throw Error("invalid Trojan password");
      var sni=node.sni||server;
      if(!host(sni))throw Error("invalid TLS SNI");
      return "trojan://"+encodeURIComponent(node.password)+"@"+server+":"+nport+
        "?security=tls&sni="+encodeURIComponent(sni)+"#"+encodeURIComponent(name);
    }
    if(protocol==="vmess"){
      if(!str(node.uuid,64)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(node.uuid))
        throw Error("invalid VMess UUID");
      var net=node.network||"tcp";
      if(net!=="tcp"&&net!=="ws")throw Error("unsupported VMess network");
      var tls=node.tls===true?"tls":"";
      var path=node.path||"/";
      if(!str(path,512)||path[0]!=="/")throw Error("invalid transport path");
      var h=node.wsHost||server;
      if(!host(h))throw Error("invalid WS host");
      var obj={v:"2",ps:name,add:server,port:String(nport),id:node.uuid,aid:"0",
        scy:"auto",net:net,type:"none",host:net==="ws"?h:"",
        path:net==="ws"?path:"",tls:tls};
      return "vmess://"+base64url(JSON.stringify(obj));
    }
    throw Error("unsupported protocol");
  }
  try {
    var req=typeof $request==="object"&&$request?$request:{};
    var method=String(req.method||"GET").toUpperCase();
    var url=String(req.url||"");
    if(url!==PREFIX+"health"&&url!==PREFIX+"normalize")return $done({});
    if(url===PREFIX+"health"){
      return method==="GET"?
        respond(200,{ok:true,engine:"Khanh Native Offline Manager",version:"3",remoteFetch:false,storage:false}):
        reject(405,"method not allowed");
    }
    if(method!=="POST")return reject(405,"method not allowed");
    var headers=req.headers||{},ctype="";
    Object.keys(headers).forEach(function(k){
      if(k.toLowerCase()==="content-type")ctype=String(headers[k]).toLowerCase();
    });
    if(!/^application\/json(?:;|$)/.test(ctype))return reject(415,"application/json required");
    var body=typeof req.body==="string"?req.body:"";
    if(!body||body.length>MAX_BODY)return reject(413,"invalid request body size");
    var data=JSON.parse(body);
    if(!data||!Array.isArray(data.nodes)||data.nodes.length>MAX_NODES)
      return reject(422,"invalid nodes list");
    var links=[];
    // All-or-nothing: never return a partly normalized sensitive subscription.
    for(var j=0;j<data.nodes.length;j++)links.push(nodeLink(data.nodes[j]));
    return respond(200,{ok:true,count:links.length,format:"share-uris",subscription:links.join("\n")});
  } catch (_error) {
    return reject(422,"invalid subscription payload");
  }
})();

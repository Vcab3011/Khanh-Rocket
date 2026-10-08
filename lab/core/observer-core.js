/* Khanh Rocket Multi-App Lab v1: pure, read-only, zero-network analysis.
 * Only supplied response bodies are inspected. No token, user ID, receipt,
 * URL path, content snippet, title, subscriber object or payload is returned.
 * No dependency on either Egern or Shadowrocket globals.
 */
(function () {
  "use strict";
  var SCHEMA = 1, MAX_EVENTS = 32, MAX_AGE_MS = 86400000, MAX_JSON = 262144;
  var SIGNALS = {locket:["customer-info","product-mapping"],soundcloud:["feature-config"],
    youtube:["browse","next","search","player","get_watch","shorts"]};
  var OUTCOMES = ["http-non200","opaque-protobuf","body-unavailable","body-too-large",
    "invalid-json","unexpected-json","schema-mismatch","observed","encoded-body-skipped",
    "invalid-utf8","content-type-skipped"];
  var BODY_OUTCOMES = ["body-unavailable","body-too-large","encoded-body-skipped",
    "invalid-utf8","content-type-skipped"];
  function classify(url, ua, method) {
    if (typeof url !== "string") return null;
    // Inspect only documented paths; hostname is case-insensitive, path is not.
    var parts=url.match(/^https:\/\/([^/?#]+)(\/[^?#]*)(?:\?[^#]*)?(?:#.*)?$/i);
    if(!parts)return null;
    var host=parts[1].toLowerCase(),path=parts[2];
    method=method===undefined?"GET":method;
    if (host==="api.revenuecat.com" && /^\/v1\/(?:subscribers\/[^/]+|receipts)$/.test(path)) {
      if(method!==(path==="/v1/receipts"?"POST":"GET"))return null;
      return typeof ua === "string" && /^Locket(?:\/|\s|$)/i.test(ua)
        ? {app:"locket", signal:"customer-info", kind:"json"} : null;
    }
    if (host==="api.revenuecat.com" && path==="/v1/product_entitlement_mapping" && method==="GET") {
      return typeof ua === "string" && /^Locket(?:\/|\s|$)/i.test(ua)
        ? {app:"locket", signal:"product-mapping", kind:"json"} : null;
    }
    if (host==="api-mobile.soundcloud.com" && path==="/configuration/ios" && method==="GET")
      return {app:"soundcloud", signal:"feature-config", kind:"json"};
    var match=path.match(/^\/youtubei\/v1\/(browse|next|search|player|get_watch|reel\/reel_watch_sequence)$/);
    if(host==="youtubei.googleapis.com" && method==="POST" && match)
      return {app:"youtube",signal:match[1]==="reel/reel_watch_sequence"?"shorts":match[1],kind:"protobuf"};
    return null;
  }
  function object(v){return !!v && typeof v==="object" && !Array.isArray(v);}
  function number(n){return Number.isFinite(n) && n>=0 && n<=1e15;}
  function inspect(input) {
    if (!input || !object(input)) return null;
    var route=classify(input.url,input.userAgent,input.method);
    if (!route) return null;
    var status=Number(input.status);
    if (!Number.isInteger(status) || status<100 || status>599) return null;
    var now=Number(input.now);
    if (!number(now)) return null;
    var event={v:SCHEMA,app:route.app,signal:route.signal,status:status,observedAt:now,format:route.kind};
    if (status!==200) {event.outcome="http-non200";return event;}
    if (route.kind==="protobuf") {event.outcome="opaque-protobuf";return event;}
    if(BODY_OUTCOMES.indexOf(input.bodyOutcome)>=0){event.outcome=input.bodyOutcome;return event;}
    if (typeof input.body!=="string") {event.outcome="body-unavailable";return event;}
    if(input.body.length>MAX_JSON) {event.outcome="body-too-large";return event;}
    // A character limit alone understates the size of multi-byte UTF-8 JSON.
    var bytes=0;
    for(var c=0;c<input.body.length;c++){
      var ch=input.body.charCodeAt(c);
      if(ch<128)bytes++;
      else if(ch<2048)bytes+=2;
      else if(ch>=0xd800 && ch<=0xdbff && c+1<input.body.length &&
              input.body.charCodeAt(c+1)>=0xdc00 && input.body.charCodeAt(c+1)<=0xdfff){bytes+=4;c++;}
      else bytes+=3;
      if(bytes>MAX_JSON){event.outcome="body-too-large";return event;}
    }
    var payload;
    try {payload=JSON.parse(input.body);}catch(_){event.outcome="invalid-json";return event;}
    if(!object(payload)) {event.outcome="unexpected-json";return event;}
    if(route.signal==="customer-info"){
      var sub=payload.subscriber, ents=sub&&sub.entitlements;
      if(!object(sub)||!object(ents)) {event.outcome="schema-mismatch";return event;}
      event.outcome="observed";
      event.entitlementCount=Math.min(Object.keys(ents).length,4096);
      event.goldFieldPresent=Object.prototype.hasOwnProperty.call(ents,"Gold");
      if(event.goldFieldPresent) {
        var gold=ents.Gold;
        event.goldExpiryFieldPresent=object(gold) && typeof gold.expires_date==="string";
      }else event.goldExpiryFieldPresent=false;
      return event;
    }
    if(route.signal==="product-mapping") {
      var mapping=payload.product_entitlement_mapping;
      if(!object(mapping)) {event.outcome="schema-mismatch";return event;}
      event.outcome="observed";
      var entries=Object.keys(mapping).slice(0,4096);
      event.productCount=entries.length;
      var entCount=0;
      for(var i=0;i<entries.length;i++){
        var m=mapping[entries[i]];
        if(object(m)&&Array.isArray(m.entitlements)) entCount+=Math.min(64,m.entitlements.length);
      }
      event.mappingEntryCount=Math.min(entCount,8192);
      return event;
    }
    if(route.signal==="feature-config") {
      if(!object(payload.plan)||!Array.isArray(payload.features)){
        event.outcome="schema-mismatch";return event;
      }
      event.outcome="observed";
      event.planFieldPresent=object(payload.plan);
      event.featureCount=Array.isArray(payload.features)?Math.min(payload.features.length,4096):0;
      event.enabledFeatureCount=Array.isArray(payload.features)
        ? Math.min(payload.features.filter(function(v){return object(v)&&v.enabled===true;}).length,4096):0;
      return event;
    }
    return null;
  }
  function compactEvent(e) {
    if (!object(e)||e.v!==SCHEMA||!number(e.observedAt))return null;
    if(!Object.prototype.hasOwnProperty.call(SIGNALS,e.app)||SIGNALS[e.app].indexOf(e.signal)<0)return null;
    if(OUTCOMES.indexOf(e.outcome)<0)return null;
    if(e.format!==(e.app==="youtube"?"protobuf":"json"))return null;
    if(!Number.isInteger(e.status)||e.status<100||e.status>599)return null;
    var result={v:1,app:e.app,signal:e.signal,status:e.status,observedAt:e.observedAt,
      format:e.format,outcome:e.outcome};
    var flags=e.outcome!=="observed"?[]:e.app==="locket" && e.signal==="customer-info"
      ? ["goldFieldPresent","goldExpiryFieldPresent"]:e.app==="soundcloud"?["planFieldPresent"]:[];
    for(var i=0;i<flags.length;i++)if(typeof e[flags[i]]==="boolean")result[flags[i]]=e[flags[i]];
    var counts=e.outcome!=="observed"?[]:e.app==="locket"
      ? (e.signal==="customer-info"?["entitlementCount"]:["productCount","mappingEntryCount"])
      :e.app==="soundcloud"?["featureCount","enabledFeatureCount"]:[];
    for(var j=0;j<counts.length;j++)if(Number.isInteger(e[counts[j]])&&e[counts[j]]>=0)
      result[counts[j]]=Math.min(8192,e[counts[j]]);
    return result;
  }
  function append(history,event,now) {
    if(!number(now))return [];
    var entries=Array.isArray(history)?history:[];
    var result=[];
    for(var i=0;i<entries.length;i++) {
      var e=compactEvent(entries[i]);
      if(e && e.observedAt<=now+300000 && e.observedAt>=now-MAX_AGE_MS)result.push(e);
    }
    var added=compactEvent(event);
    if(added && added.observedAt<=now+300000 && added.observedAt>=now-MAX_AGE_MS)
      result.push(added);
    return result.slice(-MAX_EVENTS);
  }
  function summary(history,now) {
    var rows=append(history,null,now),apps={locket:0,soundcloud:0,youtube:0};
    var latest=null,bodyUnavailable=0,schemaDrift=0;
    for(var i=0;i<rows.length;i++){
      apps[rows[i].app]++;
      if(!latest || rows[i].observedAt>=latest.observedAt)latest=rows[i];
      if(rows[i].outcome==="body-unavailable")bodyUnavailable++;
      if(["schema-mismatch","unexpected-json"].indexOf(rows[i].outcome)>=0)schemaDrift++;
    }
    return {eventCount:rows.length,apps:apps,lastObservedAt:latest?latest.observedAt:null,
      lastApp:latest?latest.app:null,lastOutcome:latest?latest.outcome:null,
      bodyUnavailable:bodyUnavailable,schemaDrift:schemaDrift};
  }
  return {classify:classify,inspect:inspect,compactEvent:compactEvent,append:append,
    summary:summary,MAX_JSON:MAX_JSON,MAX_EVENTS:MAX_EVENTS,MAX_AGE_MS:MAX_AGE_MS};
})()

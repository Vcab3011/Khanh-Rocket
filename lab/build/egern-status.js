/* Generated read-only Egern status widget. No network or purchase claims. */
const Core = /* Khanh Rocket Multi-App Lab v1: pure, read-only, zero-network analysis.
 * Only supplied response bodies are inspected. No token, user ID, receipt,
 * URL path, content snippet, title, subscriber object or payload is returned.
 * No dependency on either Egern or Shadowrocket globals.
 */
(function () {
  "use strict";
  var SCHEMA = 1, MAX_EVENTS = 32, MAX_AGE_MS = 86400000, MAX_JSON = 262144;
  function classify(url, ua) {
    if (typeof url !== "string") return null;
    if (/^https:\/\/api\.revenuecat\.com\/v\d+\/(?:subscribers\/[^/?#]+|receipts)(?:[?#]|$)/i.test(url)) {
      return typeof ua === "string" && /\bLocket\b/i.test(ua)
        ? {app:"locket", signal:"customer-info", kind:"json"} : null;
    }
    if (/^https:\/\/api\.revenuecat\.com\/v\d+\/product_entitlement_mapping(?:[?#]|$)/i.test(url)) {
      return typeof ua === "string" && /\bLocket\b/i.test(ua)
        ? {app:"locket", signal:"product-mapping", kind:"json"} : null;
    }
    if (/^https:\/\/api-mobile\.soundcloud\.com\/configuration\/ios(?:[?#]|$)/i.test(url))
      return {app:"soundcloud", signal:"feature-config", kind:"json"};
    var match=url.match(/^https:\/\/youtubei\.googleapis\.com\/youtubei\/v1\/(browse|next|search|player|get_watch|reel\/reel_watch_sequence)(?:[?#]|$)/i);
    if(match) return {app:"youtube",signal:match[1].toLowerCase()==="reel/reel_watch_sequence"?"shorts":match[1].toLowerCase(),kind:"protobuf"};
    return null;
  }
  function object(v){return !!v && typeof v==="object" && !Array.isArray(v);}
  function number(n){return Number.isFinite(n) && n>=0 && n<=1e15;}
  function inspect(input) {
    if (!input || !object(input)) return null;
    var route=classify(input.url,input.userAgent);
    if (!route) return null;
    var status=Number(input.status);
    if (!Number.isInteger(status) || status<100 || status>599) return null;
    var now=Number(input.now);
    if (!number(now)) return null;
    var event={v:SCHEMA,app:route.app,signal:route.signal,status:status,observedAt:now,format:route.kind};
    if (status!==200) {event.outcome="http-non200";return event;}
    if (route.kind==="protobuf") {event.outcome="opaque-protobuf";return event;}
    if (typeof input.body!=="string") {event.outcome="body-unavailable";return event;}
    if(input.body.length>MAX_JSON) {event.outcome="body-too-large";return event;}
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
    if (["locket","youtube","soundcloud"].indexOf(e.app)<0)return null;
    if(typeof e.signal!=="string"||!/^[-a-z_]{1,40}$/.test(e.signal))return null;
    if(!Number.isInteger(e.status)||e.status<100||e.status>599)return null;
    var result={v:1,app:e.app,signal:e.signal,status:e.status,observedAt:e.observedAt,
      format:e.format==="json"?"json":"protobuf",outcome:String(e.outcome||"unknown").slice(0,40)};
    var flags=["goldFieldPresent","goldExpiryFieldPresent","planFieldPresent"];
    for(var i=0;i<flags.length;i++)if(typeof e[flags[i]]==="boolean")result[flags[i]]=e[flags[i]];
    var counts=["entitlementCount","productCount","mappingEntryCount","featureCount","enabledFeatureCount"];
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
    for(var i=0;i<rows.length;i++)apps[rows[i].app]++;
    var latest=rows.length?rows[rows.length-1]:null;
    return {eventCount:rows.length,apps:apps,lastObservedAt:latest?latest.observedAt:null,
      lastApp:latest?latest.app:null,lastOutcome:latest?latest.outcome:null};
  }
  return {classify:classify,inspect:inspect,compactEvent:compactEvent,append:append,
    summary:summary,MAX_JSON:MAX_JSON,MAX_EVENTS:MAX_EVENTS,MAX_AGE_MS:MAX_AGE_MS};
})();
const KEY = "khanh.multiapp.events.v1";
export default async function(ctx) {
  let previous=[];
  try {
    if(ctx && ctx.storage && typeof ctx.storage.getJSON==="function")
      previous=ctx.storage.getJSON(KEY);
  }catch(_){}
  const report=Core.summary(previous,Date.now());
  const last=report.lastObservedAt
    ? new Date(report.lastObservedAt).toISOString().slice(0,16)+"Z":"No captures";
  const lines=[
    "Locket: "+report.apps.locket+"  |  SoundCloud: "+report.apps.soundcloud,
    "YouTube endpoint calls: "+report.apps.youtube,
    "Last observed: "+last,
    "VPN-off status must be tested manually.",
    "No server-side entitlements are granted."
  ];
  return {
    type:"widget",backgroundColor:"#152337",padding:14,
    children:[
      {type:"text",text:"Khanh Rocket Multi-App Lab",font:{size:"headline",weight:"semibold"},textColor:"#FFFFFF"},
      ...lines.map(line=>({type:"text",text:line,font:{size:"caption"},textColor:"#E1E6EE"}))
    ]
  };
}

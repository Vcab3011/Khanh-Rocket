/* Khanh Rocket Native V2 — RevenueCat ETag compatibility.
 * Independently written and experimental; no third-party runtime dependencies.
 * Returns original data on errors. Changes are local and not genuine purchases.
 */
(function(){
  function done(change){ return $done(change || {}); }
  try {
    var req = typeof $request === "object" && $request ? $request : {};
    var resp = typeof $response === "object" && $response ? $response : {};
    
    if(typeof req.url!=="string"||!/^https:\/\/api\.revenuecat\.com\/.+\/(?:receipts|subscribers)(?:\/|$|\?)/.test(req.url)||!req.headers||typeof req.headers!=="object")return done({});
var headers=Object.assign({},req.headers),key=Object.keys(headers).find(function(k){return k.toLowerCase()==="x-revenuecat-etag";});
if(key===undefined)return done({});
headers[key]="";
return done({headers:headers});
  }catch(_){ return done({}); }
})();

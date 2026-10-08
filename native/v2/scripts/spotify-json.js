/* Khanh Rocket Native V2 — Spotify request URL compatibility.
 * Independently written and experimental; no third-party runtime dependencies.
 * Returns original data on errors. Changes are local and not genuine purchases.
 */
(function(){
  function done(change){ return $done(change || {}); }
  try {
    var req = typeof $request === "object" && $request ? $request : {};
    var resp = typeof $response === "object" && $response ? $response : {};
    
    if(typeof req.url!=="string")return done({});
var url=req.url;
if(!/^https:\/\/(?:spclient\.wg\.spotify\.com|[^/]*-spclient\.spotify\.com)(?::443)?\/(?:artistview\/v1\/artist|album-entity-view\/v2\/album)\//i.test(url))return done({});
url=url.replace(/com:443/,"com").replace(/platform=iphone/,"platform=ipad");
return url===req.url?done({}):done({url:url});
  }catch(_){ return done({}); }
})();

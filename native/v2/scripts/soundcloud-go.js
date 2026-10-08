/* Khanh Rocket Native V2 — SoundCloud feature configuration.
 * Independently implemented from observed response schema and side effects.
 * Canary only. No network, storage, logs, dynamic code, or third-party JS.
 * A locally simulated entitlement is not a genuine purchase.
 */
(function () {
  var finish = function(result) { return $done(result || {}); };
  try {
    var resp = (typeof $response === "object" && $response) || {};
    if (typeof resp.body !== "string" || !resp.body) return finish({});
    if (resp.status >= 400 || resp.statusCode >= 400) return finish({});
    var data = JSON.parse(resp.body);
    if (!data || typeof data !== "object" || Array.isArray(data)) return finish({});
    data.plan = {vendor:"apple",id:"high_tier",manageable:true,plan_upsells:[],plan_id:"go-plus",upsells:[],plan_name:"SoundCloud Go+"};
    data.features = [
      {name:"offline_sync",enabled:true,plans:["mid_tier","high_tier"]},
      {name:"no_audio_ads",enabled:true,plans:["mid_tier","high_tier"]},
      {name:"hq_audio",enabled:true,plans:["high_tier"]},
      {name:"system_playlist_in_library",enabled:true,plans:[]},
      {name:"ads_krux",enabled:false,plans:[]},
      {name:"new_home",enabled:true,plans:[]},
      {name:"spotlight",enabled:false,plans:[]},
      {name:"content_reporting",enabled:false,plans:[]},
      {name:"content_reporting_dsa",enabled:false,plans:[]}
    ];
    return finish({body:JSON.stringify(data)});
  } catch (_error) {
    return finish({});
  }
})();

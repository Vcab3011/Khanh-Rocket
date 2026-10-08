/* Khanh Rocket Native V2 — Locket-specific RevenueCat response.
 * Independently written and experimental; no third-party runtime dependencies.
 * Returns original data on errors. Changes are local and not genuine purchases.
 */
(function(){
  function done(change){ return $done(change || {}); }
  try {
    var req = typeof $request === "object" && $request ? $request : {};
    var resp = typeof $response === "object" && $response ? $response : {};
    if (typeof resp.body !== "string" || !resp.body || resp.status >= 400 || resp.statusCode >= 400) return done({});
    var ua=(req.headers&&(req.headers["User-Agent"]||req.headers["user-agent"]))||"";
if(typeof ua!=="string"||!/Locket/i.test(ua))return done({});
var data=JSON.parse(resp.body);
if(!data||typeof data!=="object"||!data.subscriber||typeof data.subscriber!=="object")return done({});
var sub=data.subscriber;
if(!sub.subscriptions||typeof sub.subscriptions!=="object"||!sub.entitlements||typeof sub.entitlements!=="object")return done({});
var purchased={auto_resume_date:null,display_name:"locket_1600_1y",is_sandbox:true,ownership_type:"PURCHASED",
billing_issues_detected_at:null,management_url:"https://apps.apple.com/account/subscriptions",
period_type:"normal",price:{amount:399000,currency:"VND"},expires_date:"9999-01-09T10:10:14Z",
grace_period_expires_date:null,refunded_at:null,unsubscribe_detected_at:null,
original_purchase_date:"2005-01-09T10:10:15Z",purchase_date:"2005-01-09T10:10:14Z",store:"app_store",
store_transaction_id:"2000001108724193"};
var entitlement={grace_period_expires_date:null,purchase_date:"2005-01-09T10:10:14Z",
product_identifier:"locket_1600_1y",expires_date:"9999-01-09T10:10:14Z"};
sub.subscriptions["locket_1600_1y"]=purchased;sub.entitlements.Gold=entitlement;
data.Attention="Chúc mừng bạn! Vui lòng không bán hoặc chia sẻ cho người khác!";
return done({body:JSON.stringify(data)});
  }catch(_){ return done({}); }
})();

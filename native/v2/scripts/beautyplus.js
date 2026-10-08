/* Khanh Rocket Native V2 — BeautyPlus balance response.
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
    var original = JSON.parse(resp.body);
    if (!original || typeof original !== "object") return finish({});
    return finish({body:JSON.stringify({vip_expires_date:4071600000,message:"success",data:{
      points:999999999,next_claim:1,gid:"2641810920",balance:999999999,created_at:1707331696
    }})});
  } catch (_error) {
    return finish({});
  }
})();

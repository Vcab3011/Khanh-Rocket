/* Khanh Rocket Native V2 — KineMaster subscription response.
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
    return finish({body:JSON.stringify({
      is_valid_device:true,has_valid_subscription:true,expiration_date_ms:4071600000000,
      is_table_resettable:true,subscription_product_id:"com.kinemaster.sub.annual.ia2",state_code:0
    })});
  } catch (_error) {
    return finish({});
  }
})();

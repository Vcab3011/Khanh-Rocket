/* Khanh Rocket Native V2 — Alight Motion licenses.
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
    var data = {result:{result:"success",msTime:1704758400000,accountCreatedMillis:null,licenses:[{
      benefits:["RemoveWatermark","MemberEffects","ProjectPackageSharing","FutureMemberFeatures","AdvancedEasing","CameraObjects","LayerParenting","CloudStorageLowTier"],
      type:"subscription",store:"apple_app_store",autoRenewing:true,orderNumber:"730002548422566",
      productId:"alightcreative.motion.1y_t60_1w_choose_your_bundle",period:"1y",label:null,details:null,
      expires:32662137600000,valid:true,linkStatus:"linked-current"
    }],warnings:[]}};
    return finish({body:JSON.stringify(data)});
  } catch (_error) {
    return finish({});
  }
})();

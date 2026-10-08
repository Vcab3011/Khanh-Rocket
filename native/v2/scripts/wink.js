/* Khanh Rocket Native V2 — Wink VIP response without obfuscated popup.
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
    data.data = {
      active_sub_type:2,account_type:1,sub_type_name:"续期",
      active_sub_order_id:"7069961436604422668",trial_period_invalid_time:"",
      current_order_invalid_time:"32662173600000",active_order_id:"7069961436340181123",
      limit_type:0,active_sub_type_name:"续期",use_vip:true,have_valid_contract:true,
      derive_type_name:"普通会员",derive_type:1,in_trial_period:false,is_vip:true,
      membership:{id:"4",display_name:"Wink会员",level:1,level_name:"普通会员"},
      active_promotion_status_list:[2],sub_type:2,account_id:"1230010086",
      invalid_time:"32662195199000",valid_time:"1546992000000",active_product_id:"0",
      active_promotion_status:2,show_renew_flag:true
    };
    return finish({body:JSON.stringify(data)});
  } catch (_error) {
    return finish({});
  }
})();

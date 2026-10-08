/* Khanh Rocket Native V2 — Truecaller response compatibility.
 * Independently implemented; local response only, no network/storage or logs.
 * Synthetic status is not a genuine purchase. Test profile only.
 */
(function(){
 function done(v){return $done(v||{});}
 try{
  var req=typeof $request==="object"&&$request?$request:{};
  var u=typeof req.url==="string"?req.url:"";
  if(!/^https:\/\/premium-[^/]+\.truecaller\.com\/v\d+\//.test(u))return done({});
  var features=[
   ["live_lookup",1,1],["auto_spam_block",2,1],["series_blocking",3,1],["no_ads",4,1],
   ["extended_spam_blocking",5,1],["advanced_caller_id",6,1],["verified_badge",7,1],
   ["spam_stats",8,1],["call_alert",9,1],["premium_feature",12,1],["identifai",15,1],
   ["siri_search",16,1],["who_viewed_my_profile",17,1],["who_searched_for_me",18,1],
   ["contact_request",19,1],["incognito_mode",20,1],["premium_badge",21,1],
   ["premium_app_icon",22,1],["ghost_call",23,1],["live_chat_support",24,1],
   ["call_recording",25,0],["premium_support",25,0],["family_sharing",26,1],
   ["gold_caller_id",27,1],["announce_call",28,0],["caller_id",29,1,1],
   ["spam_blocking",30,1,1],["whatsapp_caller_id",31,0]
  ].map(function(e){return {id:e[0],rank:e[1],status:e[2]?"Included":"Excluded",isFree:!!e[3]};});
  var tier={id:"goldfamily",feature:features},data;
  if(/\/subscriptions\/status(?:[?#]|$)/.test(u)){
   data={expire:"9999-01-09T01:01:01Z",start:"2024-01-09T02:32:04Z",
    paymentProvider:"Apple",isExpired:false,isGracePeriodExpired:false,
    subscriptionStatus:"SUBSCRIBED",inAppPurchaseAllowed:true,
    product:{id:"apple_gold_family_yearly_v0_shop-0176",sku:"apple_gold_family_yearly_v0",
    contentType:"subscription",productType:"SubsYearly",isFreeTrial:false},
    tier:tier};
  }else if(/\/products\/apple(?:[/?#]|$)/.test(u)){
   data={tier:[{id:"goldfamily",product:[{
    productType:"SubsYearly",id:"apple_gold_family_yearly_v0_shop-0176",
    sku:"apple_gold_family_yearly_v0",contentType:"subscription",rank:6,
    paymentProvider:"Apple",clientProductMetadata:{selectionRank:5,displayOrder:5,isEntitledPremiumScreenProduct:true}
   }],feature:features,rank:5}]};
  }else return done({});
  return done({body:JSON.stringify(data)});
 }catch(_){return done({});}
})();

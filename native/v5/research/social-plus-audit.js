/* Khanh Rocket V5 — pure, consented Snapchat+ / Instagram Plus research.
 * Offline audit only; no network, MITM, entitlement synthesis, receipts,
 * authorization headers, device identifiers, storage or logging.
 * Feature data comes from a separate versioned, public matrix.
 */
"use strict";
(function (root) {
 const APPS=Object.freeze(["snapchat_plus","instagram_plus"]);
 const STATUS=Object.freeze(["visible","hidden","unknown"]);
 const ACTION=Object.freeze(["worked","blocked","not_tested"]);
 const MAX=32;
 function owns(obj,key) {return Object.prototype.hasOwnProperty.call(obj,key);}
 function isObject(obj){return obj!==null && typeof obj==="object" && !Array.isArray(obj);}
 function buildIndex(manifest) {
   if(!isObject(manifest)||manifest.schema_version!==1||!isObject(manifest.apps))throw Error("bad manifest");
   const result=Object.create(null);
   for(const app of APPS){
     const entry=manifest.apps[app];
     if(!isObject(entry)||!Array.isArray(entry.features)||entry.features.length>64)throw Error("bad app features");
     const features=Object.create(null);
     for(const f of entry.features){
       if(!isObject(f)||typeof f.key!=="string"||! /^[a-z][a-z0-9_]{0,48}$/.test(f.key) ||
           !["ui-with-account-gate","server-social","server-account","server-storage","server-privacy"].includes(f.control) ||
           owns(features,f.key))throw Error("bad feature descriptor");
       features[f.key]=f.control;
     }
     result[app]=features;
   }
   return result;
 }
 function normalize(manifest, records) {
   const index=buildIndex(manifest);
   if(!Array.isArray(records)||records.length>MAX)throw Error("invalid observation count");
   const out=[];
   for(const observation of records){
     if(!isObject(observation)||typeof observation.app!=="string"||
         !APPS.includes(observation.app)||typeof observation.feature!=="string"||
         !owns(index[observation.app],observation.feature))throw Error("unknown observation");
     if(!STATUS.includes(observation.ui)||!ACTION.includes(observation.action))throw Error("invalid observation states");
     // Drop every unrecognized input key; never return an account name, token,
     // receipt, device identifier, raw URL, or HTTP body.
     out.push({
       app:observation.app,feature:observation.feature,
       control:index[observation.app][observation.feature],
       ui:observation.ui,action:observation.action
     });
   }
   return out;
 }
 function assess(manifest, records) {
   const observations=normalize(manifest,records), apps=Object.create(null);
   for(const app of APPS){
     apps[app]={total:0,visible:0,worked:0,blocked:0,needsDeviceCheck:0};
   }
   let falsePositive=0;
   for(const row of observations){
     const group=apps[row.app];
     group.total++;
     if(row.ui==="visible")group.visible++;
     if(row.action==="worked")group.worked++;
     if(row.action==="blocked")group.blocked++;
     if(row.ui==="visible"&&row.action==="blocked")falsePositive++;
     if(row.action==="not_tested"||row.ui==="unknown")group.needsDeviceCheck++;
   }
   return {
     version:1,
     totalObservations:observations.length,
     apps:{
       snapchat_plus:apps.snapchat_plus,
       instagram_plus:apps.instagram_plus
     },
     visibleButBlocked:falsePositive,
     conclusions:{
       clientVisibleDoesNotProveSubscription:true,
       serverEntitlementVerified:false,
       vpnOffPersistenceVerified:false
     },
     observations
   };
 }
 const API=Object.freeze({buildIndex,normalize,assess});
 if(typeof module!=="undefined"&&module.exports)module.exports=API;
 else root.KhanhSocialPlus=API;
})(typeof globalThis!=="undefined"?globalThis:this);

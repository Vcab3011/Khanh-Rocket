/*
 * Khanh Rocket Egern: locally display diagnostics previously observed by
 * the optional read-only response probe. Does not connect to RevenueCat.
 */
export default async function (ctx) {
  let result=null;
  try {
    result=ctx.storage && typeof ctx.storage.getJSON==="function"
      ? ctx.storage.getJSON("khanh.egern.locket.probe") : null;
  } catch (_) {}
  const observed=result && Number.isFinite(result.seenAt)
    ? new Date(result.seenAt).toISOString().slice(0,19)+"Z" : "No capture yet";
  const state=!result?"Unknown":result.goldFieldPresent?"Gold field observed":"No Gold field";
  return {
    type:"widget",
    backgroundColor:"#101d2b",
    padding:16,
    gap:8,
    children:[
      {type:"text",text:"Khanh Rocket - Egern",font:{size:"headline",weight:"semibold"},textColor:"#FFFFFF"},
      {type:"text",text:state,font:{size:"body"},textColor:"#D5E6F1"},
      {type:"text",text:"Last local observation: "+observed,font:{size:"caption"},textColor:"#B0C7D3"},
      {type:"text",text:"A cache observation is not a valid purchase.",font:{size:"caption"},textColor:"#B0C7D3"}
    ]
  };
}

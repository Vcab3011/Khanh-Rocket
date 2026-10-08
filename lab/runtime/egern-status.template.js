/* Generated read-only Egern status widget. No network or purchase claims. */
const Core = __KHANH_CORE__;
const KEY = "khanh.multiapp.events.v1";
export default async function(ctx) {
  let previous=[];
  try {
    if(ctx && ctx.storage && typeof ctx.storage.getJSON==="function")
      previous=ctx.storage.getJSON(KEY);
  }catch(_){}
  const report=Core.summary(previous,Date.now());
  const last=report.lastObservedAt
    ? new Date(report.lastObservedAt).toISOString().slice(0,16)+"Z":"No captures";
  const lines=[
    "Locket: "+report.apps.locket+"  |  SoundCloud: "+report.apps.soundcloud,
    "YouTube endpoint calls: "+report.apps.youtube,
    "Last observed: "+last,
    "VPN-off status must be tested manually.",
    "No server-side entitlements are granted."
  ];
  return {
    type:"widget",backgroundColor:"#152337",padding:14,
    children:[
      {type:"text",text:"Khanh Rocket Multi-App Lab",font:{size:"headline",weight:"semibold"},textColor:"#FFFFFF"},
      ...lines.map(line=>({type:"text",text:line,font:{size:"caption"},textColor:"#E1E6EE"}))
    ]
  };
}

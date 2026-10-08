/* One-shot Lab: explicit manual local retention reset, no network. */
const STORAGE_KEY = "khanh.multiapp.events.v1";
export default async function(ctx) {
  let cleared=false;
  try {
    if(ctx && ctx.storage && typeof ctx.storage.delete==="function") {
      ctx.storage.delete(STORAGE_KEY);
      cleared=true;
    }
  }catch(_) {}
  return {
    type:"widget",backgroundColor:"#16243A",padding:14,
    children:[
      {type:"text",text:"Khanh Rocket - Clear Local History",
       font:{size:"headline",weight:"semibold"},textColor:"#FFFFFF"},
      {type:"text",text:cleared?"Local observation history cleared.":"Local storage unavailable.",
       font:{size:"caption"},textColor:"#E1E6EE"}
    ]
  };
}

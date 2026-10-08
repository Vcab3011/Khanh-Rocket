/* Khanh Rocket Native V2 — CamScanner response compatibility.
 * Only touches recognized paths; nested schema validated; no external code.
 * Original 10in1 config only intercepts /purchase/cs/query_prop*.
 */
(function(){
 function done(v){return $done(v||{});}
 try{
  var req=typeof $request==="object"&&$request?$request:{};
  var resp=typeof $response==="object"&&$response?$response:{};
  var u=typeof req.url==="string"?req.url:"";
  if(!/^https:\/\/(?:api|api-cs[^/]*)\.intsig\.net\//.test(u)||
     typeof resp.body!=="string"||!resp.body||resp.status>=400||resp.statusCode>=400)return done({});
  var value=JSON.parse(resp.body);
  if(!value||typeof value!=="object"||!value.data||typeof value.data!=="object")return done({});
  var vip={group1_paid:1,ms_first_pay:0,vip_type:"svip",auto_renewal:true,in_trial:1,
   members_page:0,pc_vip:1,renew_type:"year",renew_method:"appstore",ys_first_pay:0,
   initial_tm:"32662137600",product_id:"com.intsig.camscanner.premiums.oneyear.autorenewable.free.test1",
   vip_level_info:{score:0,level:0,next_score:1,start_score:0,create_time:0},
   nxt_renew_tm:"32662137600",last_payment_method:"appstore",grade:2,svip:1,expiry:32662137600,
   pending:0,level_info:{level:1,end_days:30,days:1},inherited_flag:0,group2_paid:0};
  if(u.indexOf("/purchase/cs/query_property")>=0){
   value.data.psnl_vip_property=vip;
   var balances={fax_balance:"99999",used_points:"99999",points:"99999",
    pdfword_balance:"100010",bookmode_balance:100010,immt_expy_points:"99999",
    ocr_balance:99999,no_login_ocr_balance:"99999",CamScanner_RoadMap:100000};
   Object.keys(balances).forEach(function(k){value.data[k]=balances[k];});
  }else if(u.indexOf("/queryProperty")>=0){
   if(!value.data.ar_property||typeof value.data.ar_property!=="object")return done({});
   value.data.ar_property.psnl_vip_property=vip;
  }else if(u.indexOf("/getPrivilegeItem")>=0){
   var item=function(name,balance){return {item:name,balance:balance};};
   value.data.data={
    document:[item("CamScanner_Pic2pdf",-1),item("CamScanner_PdfCompress",-1),
      item("CamScanner_PdfEncrypt",-1),item("CamScanner_FileMerge",-1),
      item("CamScanner_PdfExtract",-1),item("CamScanner_PdfWatermark",-1),
      item("CamScanner_PdfSign",-1),item("CamScanner_Intellect_Erase",99999)],
    transfer:[item("CamScanner_ExcelRecoginze",-1),item("CamScanner_RoadMap",-1),
      item("CamScanner_Pdf2ppt",-1),item("CamScanner_CloudOCR",99999)],
    other:[item("CamScanner_Translation",99999),item("CamScanner_DirNum",-1),
      item("CamScanner_IP_REMOVEAD",-1),item("CamScanner_PingTu",-1),
      item("CamScanner_Points",99999),item("CamScanner_Fax_Balance",99999)],
    scaner:[item("CamScanner_ImageRestore",99999),item("CamScanner_Patting",-1),
      item("CamScanner_Profile_Card_Format",99999),item("CamScanner_BookMode",-1),
      item("CamScanner_CertMode",-1),item("CamScanner_HDScan",-1),
      item("CamScanner_CloudOCR",99999)],
    pure:[item("CamScanner_IP_REMOVEAD",-1)]
   };
  }else return done({});
  return done({body:JSON.stringify(value)});
 }catch(_){return done({});}
})();

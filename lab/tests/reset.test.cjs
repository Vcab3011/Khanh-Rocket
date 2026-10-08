"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const src=fs.readFileSync(path.resolve(__dirname,"../build/egern-reset.js"),"utf8");
async function load(){return (await import("data:text/javascript;base64,"+Buffer.from(src).toString("base64"))).default;}
test("manual reset only deletes lab diagnostic storage key",async()=>{
 const deleted=[],clear=await load();
 const widget=await clear({storage:{delete:(key)=>deleted.push(key)}});
 assert.deepEqual(deleted,["khanh.multiapp.events.v1"]);
 assert.equal(widget.type,"widget");
 assert.ok(JSON.stringify(widget).includes("cleared"));
});
test("reset cannot access network, receipts or unrelated storage",async()=>{
 for(const name of ["ctx.http","fetch(","authorization","receipt","store_transaction_id","eval(","console."]){
   assert.equal(src.toLowerCase().includes(name.toLowerCase()),false,name);
 }
 const clear=await load();
 assert.equal((await clear({})).type,"widget");
});

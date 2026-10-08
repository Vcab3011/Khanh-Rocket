"use strict";
const {test} = require("node:test");
const assert = require("node:assert/strict");
const {dispatch} = require("../core/dispatcher.cjs");
const modules = require("../modules/index.cjs");

function run(url, phase="request", other={}) {
  return dispatch({url, phase, ...other}, modules);
}

test("intercepts only explicitly matched YouTube telemetry URL", () => {
  assert.deepEqual(run("https://www.youtube.com/api/stats/ads?event=1"),
    {action:"respond",status:200,body:""});
  assert.deepEqual(run("https://s.youtube.com/pagead/track"),{action:"respond",status:200,body:""});
  assert.equal(run("https://www.youtube.com/watch?v=123").action,"noop");
  assert.equal(run("https://www.youtube.com.evil.invalid/api/stats/ads").action,"noop");
  assert.equal(run("http://www.youtube.com/api/stats/ads").action,"noop");
  assert.equal(run("https://s.youtube.com/api/stats/qoe").action,"noop");
  assert.equal(run("https://s.youtube.com/api/stats/qoe?adcontext=1").action,"respond");
});

test("narrowly rewrites Spotify query, preserves all other parameters", () => {
  const url = "https://spclient.wg.spotify.com/artistview/v1/artist/abc?platform=iphone&locale=vi";
  assert.deepEqual(run(url), {action:"replace-url",url:url.replace("platform=iphone","platform=ipad")});
  assert.equal(run("https://spclient.wg.spotify.com/artistview/v1/artist/abc?platform=android").action,"noop");
  assert.equal(run("https://spclient.wg.spotify.com/bootstrap/v1/bootstrap?platform=iphone").action,"noop");
  assert.equal(run("https://notspotify.invalid/artistview/v1/artist/abc?platform=iphone").action,"noop");
});

test("unknown phases or events fail unchanged", () => {
  assert.equal(dispatch(null,modules).action,"noop");
  assert.equal(run("https://www.youtube.com/api/stats/ads","response").action,"noop");
  assert.equal(run("https://www.youtube.com/api/stats/ads","cron").action,"noop");
});

test("overlapping module policies never execute user callbacks", () => {
  let called = 0;
  const one = {id:"one",phase:"request",hostname:"test.example",handle:()=>{called++;return{action:"respond",status:200,body:""};}};
  const two = {...one,id:"two"};
  const result=dispatch({phase:"request",url:"https://test.example/"},[one,two]);
  assert.equal(result.reason,"ambiguous-modules");
  assert.equal(called,0);
});

test("exceptions and inappropriate handler output fail unchanged", () => {
  const origin={id:"test",phase:"request",hostname:"test.example"};
  const e={phase:"request",url:"https://test.example/"};
  assert.equal(dispatch(e,[{...origin,handle:()=>{throw Error("fail")}}]).reason,"handler-error");
  assert.equal(dispatch(e,[{...origin,handle:()=>({action:"replace-url",url:"https://evil.example/"})}]).reason,"rejected-result");
  assert.equal(dispatch({...e,phase:"response"},[{...origin,phase:"response",handle:()=>({action:"respond",status:200,body:""})}]).reason,"rejected-result");
});

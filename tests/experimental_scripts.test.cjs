/* Offline tests of experimental scripts, with fake Shadowrocket globals. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {test} = require("node:test");

const root = path.resolve(__dirname, "..");
function run(name, request, response) {
  const code = fs.readFileSync(path.join(root, "experimental/scripts", name), "utf8");
  const calls = [];
  const sandbox = {
    $request: request,
    $response: response,
    $done: value => calls.push(value),
  };
  vm.runInNewContext(code, sandbox, {timeout: 1000});
  assert.equal(calls.length, 1, "must call $done exactly once");
  return JSON.parse(JSON.stringify(calls[0]));
}

test("Spotify: only matched platform query is normalized", () => {
  const url = "https://spclient.wg.spotify.com/artistview/v1/artist/abc?platform=iphone&x=1";
  assert.deepEqual(run("spotify-platform.js", {url}), {url: url.replace("platform=iphone", "platform=ipad")});
  assert.deepEqual(run("spotify-platform.js", {url: "https://example.org/?platform=iphone"}), {});
  assert.deepEqual(run("spotify-platform.js", {url: "https://spclient.wg.spotify.com/artistview/v1/artist/abc?x=1"}), {});
  assert.deepEqual(run("spotify-platform.js", {}), {});
});

test("RevenueCat: only clears existing case-insensitive ETag", () => {
  const url = "https://api.revenuecat.com/v1/subscribers/abc";
  assert.deepEqual(run("revenuecat-etag.js", {url, headers: {"X-RevenueCat-ETag": "abc", Authorization: "redacted"}}),
    {headers: {"X-RevenueCat-ETag": "", Authorization: "redacted"}});
  assert.deepEqual(run("revenuecat-etag.js", {url, headers: {Authorization: "redacted"}}), {});
  assert.deepEqual(run("revenuecat-etag.js", {url: "https://example.com/v1/subscribers/abc", headers: {"X-RevenueCat-ETag": "abc"}}), {});
  assert.deepEqual(run("revenuecat-etag.js", {url, headers: null}), {});
});

test("Response guard: never modifies response, including errors", () => {
  for (const body of ['{"ok":true}', "{invalid", "[]", "", null]) {
    assert.deepEqual(run("response-guard-template.js", {}, {body}), {});
  }
  assert.deepEqual(run("response-guard-template.js", {}, undefined), {});
});

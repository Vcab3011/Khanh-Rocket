"use strict";

/* Independent YouTube telemetry-only blocker (request hook).
 * No decryption of protobuf, no app account modifications.
 * Only test in a canary; equivalent runtime mapping must be verified.
 */
const sites = ["www.youtube.com", "s.youtube.com"];
module.exports = sites.map((hostname) => ({
  id: "yt-telemetry-"+hostname,
  phase: "request",
  hostname,
  path: /^\/(?:api\/stats\/ads(?:\/|$)|pagead(?:\/|$)|ptracking(?:\/|$))/,
  handle: () => ({action:"respond", status:200, body:""})
})).concat([{
  id: "yt-adcontext",
  phase: "request",
  hostname: "s.youtube.com",
  path: /^\/api\/stats\/qoe$/,
  handle: ({url}) => url.searchParams.has("adcontext")
    ? {action:"respond", status:200, body:""} : {action:"noop"}
}]);

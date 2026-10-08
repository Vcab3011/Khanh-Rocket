"use strict";

/* Own request URL normalizer; does not fake Premium capabilities. */
const hosts = ["spclient.wg.spotify.com"];
module.exports = hosts.map(hostname => ({
  id: "spotify-platform-"+hostname,
  phase: "request",
  hostname,
  path: /^\/(?:artistview\/v1\/artist|album-entity-view\/v2\/album)\//,
  handle: ({url}) => {
    const existing = url.toString();
    // Preserve URL encoding and all unrelated parameters.
    const modified = existing.replace(/([?&]platform=)iphone(?=(&|#|$))/i, "$1ipad");
    return modified === existing ? {action:"noop"} : {action:"replace-url", url: modified};
  },
}));

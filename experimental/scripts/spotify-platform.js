/* Khanh Rocket experimental request rewrite.
 * Only normalizes Spotify's platform parameter on the matched endpoint.
 * No external network calls, persistent storage, or request-body access.
 * NOT connected to the working production profile.
 */
(function () {
  try {
    const request = typeof $request === "object" && $request ? $request : null;
    if (!request || typeof request.url !== "string") return $done({});
    const url = request.url;
    if (!/^https:\/\/(?:spclient\.wg\.spotify\.com|[a-z0-9.-]*-spclient\.spotify\.com)(?::443)?\/(?:artistview\/v1\/artist|album-entity-view\/v2\/album)\//i.test(url)) return $done({});
    const rewritten = url.replace(/([?&]platform=)iphone(?=(&|#|$))/i, "$1ipad");
    return $done(rewritten === url ? {} : {url: rewritten});
  } catch (_) {
    return $done({});
  }
})();

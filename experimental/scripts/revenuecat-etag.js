/* Khanh Rocket experimental request-header normalizer.
 * Scoped to RevenueCat receipt/subscriber endpoints only.
 * No network calls or body access. NOT active in production.
 * Warning: changes caching semantics; use only in controlled tests.
 */
(function () {
  try {
    const req = typeof $request === "object" && $request ? $request : null;
    if (!req || typeof req.url !== "string" || !req.headers || typeof req.headers !== "object") return $done({});
    if (!/^https:\/\/api\.revenuecat\.com\/.+\/(?:receipts|subscribers)(?:\/|$|\?)/i.test(req.url)) return $done({});
    const headers = Object.assign({}, req.headers);
    let changed = false;
    Object.keys(headers).forEach(function (key) {
      if (key.toLowerCase() === "x-revenuecat-etag") {
        headers[key] = "";
        changed = true;
      }
    });
    return $done(changed ? {headers: headers} : {});
  } catch (_) {
    return $done({});
  }
})();

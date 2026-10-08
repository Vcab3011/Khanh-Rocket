/*
 * Khanh Rocket - Egern Locket cache diagnostics.
 * Native Egern JS API (export default async function(ctx)).
 * Read-only: does NOT fabricate subscriptions, bypass app verification,
 * send traffic, modify headers, persist tokens, or report personal data.
 * Captures local diagnostic metadata only.
 */
const PATTERN = /^https:\/\/api\.revenuecat\.com\/v\d+\/(?:subscribers\/[^/?#]+|receipts)(?:[?#]|$)/i;

export default async function(ctx) {
  try {
    const req = ctx && ctx.request;
    const resp = ctx && ctx.response;
    if (!req || !resp || resp.status !== 200 ||
        typeof req.url !== "string" || !PATTERN.test(req.url)) return;
    const ua = req.headers && req.headers.get ? req.headers.get("user-agent") : null;
    if (!ua || !/\bLocket\b/i.test(ua)) return;
    const body = await resp.text();
    // Egern response bodies are streams consumed once. Return original exact
    // bytes as text even if diagnostics cannot parse the response.
    if (!body || body.length > 262144) return {body};
    try {
      const payload = JSON.parse(body);
      const ent = payload && payload.subscriber && payload.subscriber.entitlements;
      const gold = !!(ent && typeof ent === "object" && ent.Gold);
      // Only record a timestamp/status; no URL IDs, receipts, tokens or JSON body.
      if (ctx.storage && typeof ctx.storage.setJSON === "function") {
        ctx.storage.setJSON("khanh.egern.locket.probe", {
          v:1, seenAt:Date.now(), responseStatus:200,
          goldFieldPresent:gold,
          goldHasExpiry:!!(gold && typeof ent.Gold.expires_date === "string")
        });
      }
    } catch (_) {
      // Ignore unknown schema, preserve raw response.
    }
    return {body};
  } catch (_) {
    return;
  }
}

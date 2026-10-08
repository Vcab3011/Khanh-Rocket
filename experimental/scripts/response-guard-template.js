/* Khanh Rocket experimental defensive JSON response template.
 * Intentionally makes NO changes to subscription or entitlement fields.
 * For developer-controlled APIs only. Not connected to production.
 */
(function () {
  try {
    if (typeof $response !== "object" || !$response ||
        typeof $response.body !== "string" || !$response.body) return $done({});
    const data = JSON.parse($response.body);
    if (!data || typeof data !== "object" || Array.isArray(data)) return $done({});
    // Insert only a documented, authorized transformation here.
    return $done({});
  } catch (_) {
    // Preserve original response on parsing, schema or runtime failure.
    return $done({});
  }
})();

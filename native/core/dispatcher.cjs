"use strict";

/**
 * Khanh Native: pure, offline policy dispatcher.
 * No Shadowrocket globals, network calls, persistence or account state.
 * A separate host adapter can translate decisions to $done() after tests.
 */
function normalizeEvent(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.url !== "string") {
    throw new TypeError("event.url must be a string");
  }
  const url = new URL(raw.url);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new TypeError("only credential-free HTTPS URLs allowed");
  }
  const phase = raw.phase;
  if (!["request", "response"].includes(phase)) {
    throw new TypeError("unknown event phase");
  }
  const method = typeof raw.method === "string" ? raw.method.toUpperCase() : "GET";
  const body = typeof raw.body === "string" ? raw.body : null;
  const status = Number.isInteger(raw.status) ? raw.status : null;
  return {url, phase, method, status, body};
}

function matches(event, spec) {
  if (event.phase !== spec.phase || event.url.hostname !== spec.hostname) return false;
  if (spec.method && event.method !== spec.method) return false;
  if (spec.path && !spec.path.test(event.url.pathname)) return false;
  if (spec.status != null && event.status !== spec.status) return false;
  if (spec.maxBodyBytes != null && event.body !== null &&
      Buffer.byteLength(event.body, "utf8") > spec.maxBodyBytes) return false;
  return true;
}

function dispatch(raw, modules) {
  let event;
  try {
    event = normalizeEvent(raw);
  } catch (_) {
    return {action:"noop", reason:"invalid-event"};
  }
  const eligible = modules.filter(m => matches(event, m));
  if (eligible.length > 1) {
    // Fail closed on ambiguous policy — never let handler order dictate behavior.
    return {action:"noop", reason:"ambiguous-modules", modules:eligible.map(m=>m.id)};
  }
  if (!eligible.length) return {action:"noop", reason:"no-match"};
  try {
    const result = eligible[0].handle(event);
    if (!result || typeof result !== "object") return {action:"noop", reason:"invalid-result"};
    if (result.action === "noop") return {action:"noop", reason:"module-noop"};
    if (result.action === "replace-url" && event.phase === "request" &&
        typeof result.url === "string") {
      const next = new URL(result.url);
      if (next.protocol === "https:" && next.hostname === event.url.hostname &&
          !next.username && !next.password) return result;
    }
    if (result.action === "respond" && event.phase === "request" &&
        Number.isInteger(result.status) && result.status >= 200 &&
        result.status <= 299 && typeof result.body === "string") return result;
    return {action:"noop", reason:"rejected-result"};
  } catch (_) {
    // No sensitive error logs or body dumps.
    return {action:"noop", reason:"handler-error"};
  }
}

module.exports = {normalizeEvent, matches, dispatch};

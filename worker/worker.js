/**
 * COSMOS – Anthropic API Proxy (Cloudflare Worker)
 *
 * Aufgabe: Die statische PWA (GitHub Pages) ruft DIESEN Worker auf.
 * Der Worker haengt den geheimen API-Key an und leitet an Anthropic weiter.
 * So liegt der Key NIE im Browser-Code und CORS ist kein Problem.
 *
 * Secrets / Variablen:
 *   ANTHROPIC_API_KEY  -> als Secret setzen (wrangler secret put ANTHROPIC_API_KEY)
 *   ALLOWED_ORIGIN     -> in wrangler.toml gesetzt (deine GitHub-Pages-Origin)
 */

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS_CAP = 2000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "*";
    const allowOrigin = allowed === "*" || origin === allowed ? origin || "*" : allowed;

    const cors = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    };

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "POST") {
      return json({ error: "Method Not Allowed" }, 405, cors);
    }

    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "Server nicht konfiguriert: ANTHROPIC_API_KEY fehlt." }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Ungueltiges JSON im Request-Body." }, 400, cors);
    }

    if (!Array.isArray(body.messages)) {
      return json({ error: "Feld 'messages' (Array) ist erforderlich." }, 400, cors);
    }

    // Nur erlaubte Felder durchreichen; max_tokens deckeln (Kostenschutz).
    const payload = {
      model: typeof body.model === "string" ? body.model : DEFAULT_MODEL,
      max_tokens: Math.min(Number(body.max_tokens) || 1000, MAX_TOKENS_CAP),
      messages: body.messages,
    };
    if (typeof body.system === "string") payload.system = body.system;

    let upstream;
    try {
      upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      return json({ error: "Upstream-Anfrage fehlgeschlagen: " + e.message }, 502, cors);
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

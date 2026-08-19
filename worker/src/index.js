// Anvil Worker. One job: accept Apple Health exports from the phone and write
// them into anvil-data as vitals.json.
//
// Ported from mise worker/src/index.js on 2026-08-18, stripped to the vitals
// route. Mise's worker also carries the Anthropic proxy, the recipe scanner
// and the ntfy cron; none of that belongs here, and the phone must end up
// posting to exactly one endpoint.
//
// Secrets (set with `npx wrangler secret put`, NEVER in this file or
// wrangler.toml):
//   VITALS_KEY               high-entropy shared secret the phone presents
//   ANVIL_DATA_WRITE_TOKEN   fine-grained PAT, contents:write on anvil-data
//
// A missing secret makes the endpoint answer 503 with the reason, on purpose:
// silently accepting posts it cannot store is the one failure nobody notices.

import { parseHealthExport, mergeVitalsDays } from "./lib.js";

const DATA_REPO = "JannikSin/anvil-data";
const VITALS_PATH = "vitals.json";
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * @param {number} status
 * @param {Record<string, any>} body
 */
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Read a file WITH its sha.
 * @param {string} path
 * @param {string} token
 * @returns {Promise<{ data: Record<string, any> | null, sha: string | undefined }>}
 */
async function ghReadWithSha(path, token) {
  const res = await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "anvil-worker",
    },
  });
  if (res.status === 404) return { data: null, sha: undefined };
  if (!res.ok) throw new Error(`read ${path} failed: ${res.status}`);
  const meta = await res.json();
  /** @type {Record<string, any> | null} */
  let data;
  try {
    data = JSON.parse(
      decodeURIComponent(escape(atob(String(meta.content ?? "").replace(/\n/g, "")))),
    );
  } catch {
    data = null;
  }
  return { data, sha: meta.sha };
}

/**
 * Write one JSON file. Passes the sha so a concurrent write 409s instead of
 * silently clobbering, per the project data rules.
 * @param {string} path
 * @param {Record<string, any>} data
 * @param {string | undefined} sha
 * @param {string} token
 * @param {string} message
 */
async function ghWriteJson(path, data, sha, token, message) {
  /** @type {Record<string, string>} */
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
  };
  if (sha) body.sha = sha;
  return fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "anvil-worker",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * POST /vitals — Apple Health ingest for Health Auto Export.
 *
 * Auth is a dedicated VITALS_KEY, not the GitHub PAT the browser app presents,
 * so the phone never carries a credential that can read the whole data repo.
 * The key may arrive as an `x-vitals-key` header OR as the last path segment
 * (`/vitals/<key>`), because the app's URL field is guaranteed to exist while
 * its custom-header support is the one thing not verified against a live
 * install. Prefer the header: a key in a URL can end up in request logs.
 *
 * @param {Request} request
 * @param {{ VITALS_KEY?: string, ANVIL_DATA_WRITE_TOKEN?: string }} env
 * @param {URL} url
 */
async function handleVitals(request, env, url) {
  if (request.method !== "POST") return json(405, { error: "POST only" });
  if (!env.VITALS_KEY || !env.ANVIL_DATA_WRITE_TOKEN) {
    return json(503, {
      error: "vitals ingest not configured (VITALS_KEY + ANVIL_DATA_WRITE_TOKEN)",
    });
  }
  const pathKey = url.pathname.startsWith("/vitals/") ? url.pathname.slice("/vitals/".length) : "";
  const presented = request.headers.get("x-vitals-key") || pathKey;
  // Constant-time-ish: compare lengths first, then whole strings. The key is
  // high-entropy and this endpoint is rate-limited by GitHub write latency,
  // so a timing oracle here is not a practical attack surface.
  if (!presented || presented.length !== env.VITALS_KEY.length || presented !== env.VITALS_KEY) {
    return json(401, { error: "bad vitals key" });
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { error: "payload too large" });
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid JSON body" });
  }

  const { days, recognized, ignored } = parseHealthExport(body);
  if (!days.length) {
    // Deliberately not a 200. A post that parsed to nothing is the failure mode
    // that would otherwise look exactly like success, and the ignored list is
    // what tells us which metric names to add to the map.
    return json(422, { error: "no recognisable health metrics in payload", recognized, ignored });
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, sha } = await ghReadWithSha(VITALS_PATH, env.ANVIL_DATA_WRITE_TOKEN);
    const merged = {
      days: mergeVitalsDays(data?.days ?? [], days),
      ekg: Array.isArray(data?.ekg) ? data.ekg : [],
    };
    const res = await ghWriteJson(
      VITALS_PATH,
      merged,
      sha,
      env.ANVIL_DATA_WRITE_TOKEN,
      `vitals ${days.map((d) => d.date).join(", ")}`,
    );
    if (res.ok) {
      return json(200, {
        written: days.length,
        dates: days.map((d) => d.date),
        recognized,
        ignored,
      });
    }
    // 409 means someone else wrote between our read and write. Re-read and
    // retry once, which is the merge rule the rest of this project follows.
    if (res.status !== 409) {
      return json(502, { error: `data write failed: ${res.status}`, recognized, ignored });
    }
  }
  return json(409, { error: "vitals write kept conflicting; try again" });
}

export default {
  /**
   * @param {Request} request
   * @param {{ VITALS_KEY?: string, ANVIL_DATA_WRITE_TOKEN?: string }} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/vitals" || url.pathname.startsWith("/vitals/")) {
      return handleVitals(request, env, url);
    }
    if (url.pathname === "/health") return json(200, { ok: true });
    return json(404, { error: "not found" });
  },
};

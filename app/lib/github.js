// GitHub access layer. The ONLY module that talks to api.github.com.
// Views import from here (or from store.js) — never fetch directly.
//
// Ported from mise on 2026-08-18. EVERY localStorage key here is prefixed
// "anvil." on purpose: anvil and mise share the origin janniksin.github.io,
// and localStorage is scoped per ORIGIN, not per path. A key named "mise.pat"
// in this file would make anvil read Mise's GitHub token and write to
// mise-data. Never reintroduce a "mise." key here.

import { ConflictError } from "./sync.js";

/**
 * An HTTP failure from the GitHub API, carrying the STATUS as a field rather
 * than only as words inside a message.
 *
 * Why this exists, 2026-08-24: the sync layer classified failures by running a
 * regex over the message text, `/HTTP 40[13]/`. A fine-grained PAT that is not
 * scoped to a repository gets **404** on a write, because GitHub 404s rather
 * than 403s to avoid confirming that a private repo exists. 404 did not match
 * that regex, so the single most common real-world setup mistake was reported
 * to David as "can't reach GitHub right now (auto-retrying)".
 *
 * That message was wrong twice over. It is not a reachability problem, and
 * retrying cannot fix it, so the app sat in a loop telling him to wait for a
 * network that was never down. Meanwhile the Rig screen, reading a different
 * code path, correctly said the token could not see the repo. Two surfaces,
 * two contradictory stories, and the true one was the one he had to go looking
 * for.
 */
export class ApiError extends Error {
  /**
   * @param {string} path
   * @param {number} status
   * @param {string} [verb]
   * @param {boolean} [rateLimited]
   */
  constructor(path, status, verb = "read", rateLimited = false) {
    super(`${verb} ${path}: HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
    this.verb = verb;
    this.rateLimited = rateLimited;
  }
}

/** GitHub answers a hard rate limit with 403 and a zeroed remaining header,
 *  which is a completely different problem from a token that lacks a
 *  permission, and used to be indistinguishable from one. */
function isRateLimited(/** @type {Response} */ res) {
  return res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0";
}

/**
 * Turn a failure into the sentence that names the actual fix. This is the one
 * place that decides what the app says about a broken pipe, so both the day
 * screen and Rig can say the same thing.
 * @param {unknown} e
 * @returns {{ text: string, fixable: boolean }} fixable = waiting will not help
 */
export function describeSyncError(e) {
  if (e instanceof ApiError) {
    if (e.rateLimited)
      return {
        text: "GitHub is rate-limiting this token. It clears within the hour on its own.",
        fixable: false,
      };
    switch (e.status) {
      case 401:
        return {
          text: "GitHub rejected the token itself: it is expired, revoked or mistyped. Paste a new one in Rig.",
          fixable: true,
        };
      case 403:
        return {
          text: "The token reaches GitHub but is not allowed to write. In its permissions, Repository permissions > Contents must be Read and write, not Read-only.",
          fixable: true,
        };
      case 404:
        return {
          text: `The token works, but it cannot see ${repoFor(e.path).owner}/${repoFor(e.path).repo}. On the token page, Repository access defaults to "Public repositories" and silently fails on a private repo: switch it to "Only select repositories" and tick BOTH data repos. Do not mint a new token, this one is fine.`,
          fixable: true,
        };
      case 422:
        return { text: `GitHub refused the contents of ${e.path}.`, fixable: true };
      default:
        return { text: `GitHub answered ${e.status} on ${e.path}.`, fixable: true };
    }
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (/no token set/.test(msg))
    return { text: "No token saved on this device. Add one in Rig.", fixable: true };
  return { text: "Can't reach GitHub right now. Retrying on its own.", fixable: false };
}

const API = "https://api.github.com";
// B4 (friend groups): each install can point at its OWN private data repo.
// "owner/repo" in localStorage; absent = the family default. Getters keep
// every existing DATA_REPO.owner/.repo call site working unchanged.
const REPO_KEY = "anvil.dataRepo";
const DEFAULT_REPO = { owner: "JannikSin", repo: "anvil-data" };
function parseRepo() {
  try {
    const raw = (localStorage.getItem(REPO_KEY) ?? "").trim();
    const m = raw.match(/^([\w.-]+)\/([\w.-]+)$/);
    // both groups checked explicitly so the getters are typed string, not
    // string | undefined — repoFor() builds a concrete {owner, repo} from them
    return m && m[1] && m[2] ? { owner: m[1], repo: m[2] } : DEFAULT_REPO;
  } catch {
    return DEFAULT_REPO;
  }
}
export const DATA_REPO = {
  get owner() {
    return parseRepo().owner;
  },
  get repo() {
    return parseRepo().repo;
  },
};

// The two files that stay in MISE's data repo.
//
// fitness/daily.json holds one row per day mixing anvil's fields (sleep,
// weight, pushups) with Mise's (water, supplements, dailyDozen). Splitting the
// row would mean two writers inventing a merge; instead both apps write the
// SAME file through the same sha-and-merge path, and merge.js resolves
// field-wise. fitness/targets.json is Mise's calorie and protein spine and is
// READ-ONLY here, enforced below rather than merely documented.
const MISE_REPO = { owner: "JannikSin", repo: "mise-data" };
export const SHARED_DAILY = "fitness/daily.json";
export const MISE_TARGETS = "fitness/targets.json";
// Apple Health rows still arrive through MISE's worker until David re-points
// the Health Auto Export app on his phone at anvil's worker (a physical step,
// not a code one). Until then this is where vitals actually are, and reading
// it keeps the Vitals screen alive across the switch instead of going blank
// the moment Mise's Vitals tab is deleted. After the phone moves, anvil's own
// vitals.json wins and this stays as the read-only history.
export const MISE_VITALS = "health/vitals.json";
const MISE_PATHS = new Set([SHARED_DAILY, MISE_TARGETS, MISE_VITALS]);

/**
 * Which repo owns a path. Anvil's own data lives in anvil-data; the two
 * shared paths above resolve to mise-data. The PAT must therefore be scoped
 * to BOTH repos.
 * @param {string} path
 * @returns {{ owner: string, repo: string }}
 */
export function repoFor(path) {
  return MISE_PATHS.has(path) ? MISE_REPO : { owner: DATA_REPO.owner, repo: DATA_REPO.repo };
}

/** @returns {boolean} true when this install points at a non-default repo */
export function dataRepoOverridden() {
  try {
    return Boolean(localStorage.getItem(REPO_KEY));
  } catch {
    return false;
  }
}

/**
 * Point this install at another private data repo ("owner/repo"; blank =
 * back to the family default). The caller MUST wipe local state and reload:
 * cached data from the previous repo must never bleed into the next one.
 * @param {string} v
 */
export function setDataRepo(v) {
  const clean = (v ?? "").trim();
  if (clean && !/^[\w.-]+\/[\w.-]+$/.test(clean)) return false;
  if (clean) localStorage.setItem(REPO_KEY, clean);
  else localStorage.removeItem(REPO_KEY);
  return true;
}
const TOKEN_KEY = "anvil.pat";

/** @returns {string | null} */
export function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  // lazy backfill: tokens saved before the savedAt stamp existed start their
  // age clock now — slightly late is survivable (the invalid-token renewal
  // card is the backstop); NEVER warning is not
  if (token && !localStorage.getItem(`${TOKEN_KEY}.savedAt`)) {
    localStorage.setItem(`${TOKEN_KEY}.savedAt`, new Date().toISOString());
  }
  return token;
}

/** @param {string} token */
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token.trim());
  // fine-grained PATs are created with 1-year expiry (setup ceremony);
  // the save date drives the renew-soon warning (blueprint §4.5)
  localStorage.setItem(`${TOKEN_KEY}.savedAt`, new Date().toISOString());
}

/**
 * Days since the token was saved on this device; null if unknown (token
 * predates this feature or was never saved here).
 * @returns {number | null}
 */
export function tokenAgeDays() {
  const saved = localStorage.getItem(`${TOKEN_KEY}.savedAt`);
  if (!saved) return null;
  const ms = Date.now() - new Date(saved).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 86400000) : null;
}

/** Warn two weeks before the assumed 1-year expiry. */
export const TOKEN_WARN_AGE_DAYS = 351;

/**
 * Data-repo safety check (CLAUDE.md Part 2, rule 1).
 *
 * Privacy probe is UNAUTHENTICATED on purpose: a 200 means the repo is
 * publicly visible (alarm); 404 means private-or-missing (expected). The
 * authenticated call then verifies the token actually reaches the repo.
 *
 * @returns {Promise<{
 *   privacy: "private" | "PUBLIC" | "unknown",
 *   auth: "ok" | "invalid" | "norepo" | "ratelimited" | "missing" | "unknown",
 *   reachable: boolean
 * }>}
 */
export async function checkDataRepo() {
  const url = `${API}/repos/${DATA_REPO.owner}/${DATA_REPO.repo}`;

  let reachable = true;
  /** @type {"private" | "PUBLIC" | "unknown"} */
  let privacy;
  try {
    const anon = await fetch(url, { headers: baseHeaders() });
    privacy = anon.status === 404 ? "private" : anon.ok ? "PUBLIC" : "unknown";
  } catch {
    privacy = "unknown"; // offline — cache decides what to show
    reachable = false;
  }

  const token = getToken();
  /** @type {"ok" | "invalid" | "norepo" | "ratelimited" | "missing" | "unknown"} */
  let auth = "missing";
  if (token) {
    try {
      const authed = await fetch(url, { headers: baseHeaders(token) });
      if (authed.ok) {
        auth = "ok";
        const repo = await authed.json();
        if (repo.private === true) privacy = "private";
        else if (repo.private === false) privacy = "PUBLIC";
      } else {
        // 404 here means the token authenticated but the repo is not in its
        // selected-repositories list — a scope mistake, NOT a dead token.
        // Telling him "invalid" sends him off minting new tokens with the same
        // default ("Public repositories") and the same 404 forever.
        auth = authed.status === 404 ? "norepo" : isRateLimited(authed) ? "ratelimited" : "invalid";
      }
    } catch {
      auth = "unknown"; // offline
      reachable = false;
    }
  }

  return { privacy, auth, reachable };
}

/**
 * A saved token that cannot reach the data repo, for whatever reason. Every
 * view gates on this, not on a single auth value — "invalid" and "norepo"
 * both mean nothing syncs, and a view that only checks one lets the other
 * render as if all is well.
 * @param {string | undefined} auth
 */
export function tokenBroken(auth) {
  return auth === "invalid" || auth === "norepo";
}

/**
 * Read one JSON file from the data repo via the Contents API.
 * @param {string} path
 * @returns {Promise<{ data: Record<string, unknown>, sha: string } | null>} null = file absent
 */
export async function readFile(path) {
  const res = await fetch(contentsUrl(path), { headers: authedHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(path, res.status, "read", isRateLimited(res));
  const json = await res.json();
  // directories come back as arrays; >1MB files omit content — neither is
  // a valid data file (small per-domain JSON only)
  if (Array.isArray(json) || typeof json.content !== "string") {
    throw new Error(`read ${path}: not a small JSON file`);
  }
  return { data: JSON.parse(fromBase64(json.content)), sha: json.sha };
}

/**
 * Write one JSON file via the Contents API. Always pass the last known sha
 * for existing files (CLAUDE.md Part 2, rule 2); a sha mismatch throws
 * ConflictError so the sync layer can merge and retry.
 * @param {string} path
 * @param {Record<string, unknown>} data
 * @param {string | null} [sha]
 * @returns {Promise<{ sha: string }>}
 */
export async function writeFile(path, data, sha) {
  // Anvil never writes a calorie number (Fitness-App-Build §2.5). Code, not
  // a comment, because the failure mode is silent corruption of Mise's spine.
  if (path === MISE_TARGETS || path === MISE_VITALS) {
    throw new Error(`refusing to write ${path}: owned by Mise`);
  }
  const res = await fetch(contentsUrl(path), {
    method: "PUT",
    headers: authedHeaders(),
    body: JSON.stringify({
      message: `anvil: update ${path}`,
      content: toBase64(JSON.stringify(data, null, 2) + "\n"),
      ...(sha ? { sha } : {}),
    }),
  });
  // 409 = sha stale/branch moved → merge and retry. 422 is a conflict ONLY
  // for sha-less creates racing an existing file; with a sha it's a real
  // validation error that must surface, not be retried forever as a merge.
  if (res.status === 409 || (res.status === 422 && !sha)) throw new ConflictError(path);
  if (!res.ok) throw new ApiError(path, res.status, "write", isRateLimited(res));
  const json = await res.json();
  return { sha: json.content.sha };
}

/**
 * List the JSON files of a directory in the data repo.
 * @param {string} dir
 * @returns {Promise<{ name: string, path: string, sha: string }[]>} [] if the dir is absent
 */
export async function listDir(dir) {
  const res = await fetch(contentsUrl(dir), { headers: authedHeaders() });
  if (res.status === 404) return [];
  if (!res.ok) throw new ApiError(dir, res.status, "list", isRateLimited(res));
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error(`list ${dir}: not a directory`);
  return json
    .filter((e) => e.type === "file" && e.name.endsWith(".json"))
    .map((e) => ({ name: e.name, path: e.path, sha: e.sha }));
}

/** @param {string} path */
function contentsUrl(path) {
  const { owner, repo } = repoFor(path);
  return `${API}/repos/${owner}/${repo}/contents/${path}`;
}

/** @returns {Record<string, string>} */
function authedHeaders() {
  const token = getToken();
  if (!token) throw new Error("no token set");
  return baseHeaders(token);
}

/** @param {string} s */
function toBase64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** @param {string} b64 */
function fromBase64(b64) {
  const bin = atob(b64.replaceAll("\n", ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * @param {string} [token]
 * @returns {Record<string, string>}
 */
function baseHeaders(token) {
  /** @type {Record<string, string>} */
  const h = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// Offline-first store. Views read and write HERE, never against the network
// directly.
//
// Ported from mise on 2026-08-18 MINUS the multi-profile layer: Mise serves
// four people and scopes every path under profiles/<id>/, anvil serves one.
// Paths here are verbatim. If anvil ever grows a second user, take that layer
// back from mise rather than reinventing it.
//
//   read:  cache answers instantly; a background revalidate refreshes clean
//          files from GitHub and notifies subscribers.
//   write: lands in the cache immediately (dirty + queuedAt), then flush()
//          pushes queued files in order — with sha, merging on conflict —
//          whenever we're online. Offline writes simply stay queued.

import { dbGet, dbGetAll, dbUpdate } from "./db.js";
import { readFile, writeFile, describeSyncError } from "./github.js";
import { pushFile, afterPushRecord, ConflictError } from "./sync.js";

const io = { read: readFile, write: writeFile };

/** @type {Set<() => void>} */
const listeners = new Set();

/** @type {{ loading: boolean, pending: number, conflicts: number, lastSyncAt: string | null, flushing: boolean, lastError: string | null, needsYou: boolean }} */
const status = {
  loading: true,
  pending: 0,
  conflicts: 0,
  lastSyncAt: null,
  flushing: false,
  // A5: why the last flush stopped, in words a user can act on. null = the
  // last pass pushed clean. Queued-but-failing writes used to be invisible
  // unless you opened SYS and read the pending count.
  lastError: null,
  // true when the failure is one only David can clear (a token scope, a
  // permission, an expiry). Retrying will not fix those, and an app that says
  // "auto-retrying" about them is lying in a way that costs days.
  needsYou: false,
};

export function getSyncStatus() {
  return { ...status };
}

/** @param {() => void} fn */
export function onSyncChange(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  for (const fn of listeners) fn();
}

async function recount() {
  const all = await dbGetAll();
  status.pending = all.filter((r) => r.dirty).length;
  status.loading = false;
  emit();
}

/** Call once at startup: wires reconnect-flush and reports queue state. */
export function initStore() {
  window.addEventListener("online", () => {
    void flush();
  });
  // A5: a flush that died on a transient error used to leave writes queued
  // until the NEXT user write happened to retrigger it — retry on a slow
  // heartbeat instead so "queued forever while online" can't happen silently
  setInterval(() => {
    if (status.pending > 0 && !status.flushing) void flush();
  }, 60_000);
  void recount();
  void flush();
}

/**
 * Cached-first read. Returns the local record immediately (null if never
 * fetched); kicks off a background refresh for clean files when online.
 * @param {string} path
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function read(path) {
  const finalPath = path;
  const rec = await dbGet(finalPath);
  void revalidate(finalPath);
  return rec ? rec.data : null;
}

/**
 * Cached-first read that also reports PROVENANCE, for the frozen-pot input
 * fingerprint (per-person-plates-design §10, Red Team R1/N5): `sha` is the
 * GitHub blob sha — content-addressed and identical on every device that
 * has fetched the same bytes, unlike the local `rev` write counter, which
 * would report skew that does not exist. A dirty (locally-edited,
 * unflushed) record stamps dirty: its sha is stale by construction.
 * @param {string} path
 * @returns {Promise<{ data: Record<string, unknown> | null, sha: string | null, dirty: boolean }>}
 */
export async function readMeta(path) {
  const finalPath = path;
  const rec = await dbGet(finalPath);
  void revalidate(finalPath);
  if (!rec) return { data: null, sha: null, dirty: false };
  return { data: rec.data, sha: rec.sha ?? null, dirty: Boolean(rec.dirty) };
}

/**
 * @param {string} scopedPath already-final path
 * @returns {Promise<void>}
 */
async function revalidate(scopedPath) {
  if (!navigator.onLine) return;
  const rec = await dbGet(scopedPath);
  if (rec?.dirty) return; // local edits win until flushed
  try {
    const remote = await readFile(scopedPath);
    if (!remote) return;
    if (rec && remote.sha === rec.sha) return;
    await cacheRemote(scopedPath, remote.data, remote.sha);
    emit();
  } catch {
    // offline or no token — cache already served the read
  }
}

/**
 * Store a freshly-fetched remote file as clean cache, atomically skipping
 * if a local write landed mid-fetch (that write's flush will reconcile).
 * @param {string} path
 * @param {Record<string, unknown>} data
 * @param {string} sha
 * @returns {Promise<void>}
 */
function cacheRemote(path, data, sha) {
  return dbUpdate(path, (cur) =>
    cur?.dirty
      ? null
      : { path, data, base: data, sha, dirty: false, queuedAt: null, rev: cur?.rev ?? 0 },
  );
}

/**
 * Optimistic local write: cached instantly, queued, flushed when possible.
 * @param {string} path
 * @param {Record<string, unknown>} data
 * @returns {Promise<void>}
 */
export async function write(path, data) {
  const scopedPath = path;
  await dbUpdate(scopedPath, (cur) => ({
    path: scopedPath,
    data,
    base: cur?.base ?? null,
    sha: cur?.sha ?? null,
    dirty: true,
    queuedAt: cur?.dirty && cur.queuedAt ? cur.queuedAt : Date.now(),
    rev: (cur?.rev ?? 0) + 1,
  }));
  await recount();
  void flush();
}

/**
 * Push every queued write, oldest first. Network failure stops the pass
 * (writes stay queued for the next reconnect); a conflict that survives
 * merge retries is counted and skipped so one bad file can't block the rest.
 * @returns {Promise<void>}
 */
async function flush() {
  if (status.flushing || !navigator.onLine) return;
  status.flushing = true;
  status.conflicts = 0;
  emit();
  try {
    const queued = (await dbGetAll())
      .filter((r) => r.dirty)
      .sort((a, b) => (a.queuedAt ?? 0) - (b.queuedAt ?? 0));
    for (const rec of queued) {
      try {
        const pushed = await pushFile(io, {
          path: rec.path,
          data: rec.data,
          base: rec.base,
          sha: rec.sha,
        });
        // atomic: an edit that landed while the push was in flight stays
        // dirty; only base/sha advance (afterPushRecord decides)
        await dbUpdate(rec.path, (cur) => afterPushRecord(cur ?? rec, pushed, rec.rev));
        status.lastSyncAt = new Date().toISOString();
        status.lastError = null;
        status.needsYou = false;
      } catch (e) {
        if (e instanceof ConflictError) {
          status.conflicts++;
          continue; // stays dirty; next flush retries the merge
        }
        // Network or auth failure: stop, everything stays queued, and SAY WHY
        // in words that name the fix.
        //
        // This used to classify by running /HTTP 40[13]/ over the message
        // text, which mapped the single most common real setup mistake, a
        // token not scoped to the repo, onto "can't reach GitHub right now
        // (auto-retrying)". GitHub answers that case with 404, deliberately,
        // so as not to confirm a private repo exists. The app therefore told
        // David to wait for a network that was never down, forever, while the
        // Rig screen said the opposite. See describeSyncError in github.js.
        const why = describeSyncError(e);
        status.lastError = why.text;
        // `fixable` means waiting will not help, so the heartbeat should stop
        // pretending it might.
        status.needsYou = why.fixable;
        break;
      }
    }
  } finally {
    status.flushing = false;
    await recount();
  }
}

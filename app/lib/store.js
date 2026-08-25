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

/**
 * Does this failure stop the whole pass, or only this one file?
 *
 * The rule, extracted so it can be tested and so it is stated once: a failure
 * that only DAVID can clear is a property of that FILE, and the files behind it
 * may be perfectly pushable. A failure of reachability is a property of the
 * network, and nothing behind it will push either.
 *
 * This is a rule and not an implementation detail, because getting it wrong the
 * other way meant a token scoped to one of his two data repos synced NOTHING
 * rather than half. See the long note at the catch site.
 *
 * @param {{ fixable: boolean }} why from describeSyncError
 * @returns {boolean} true = stop the pass
 */
export function stopsTheWholePass(why) {
  return !why.fixable;
}

/** @type {Set<() => void>} */
const listeners = new Set();

/** @type {{ loading: boolean, pending: number, conflicts: number, blocked: number, lastSyncAt: string | null, flushing: boolean, lastError: string | null, needsYou: boolean }} */
const status = {
  loading: true,
  pending: 0,
  conflicts: 0,
  // files that failed on something only David can clear (a scope, a permission,
  // an expiry) rather than on reachability. Counted separately because they do
  // NOT stop the rest of the queue, and because "3 queued" reads as patience
  // while "3 blocked" reads as an instruction.
  blocked: 0,
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
  status.blocked = 0;
  // cleared per pass: a reason that has been fixed must stop being displayed,
  // and the first failure of THIS pass is the one worth showing
  status.lastError = null;
  status.needsYou = false;
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
      } catch (e) {
        if (e instanceof ConflictError) {
          status.conflicts++;
          continue; // stays dirty; next flush retries the merge
        }
        const why = describeSyncError(e);
        // ONE UNREACHABLE REPO MUST NOT BLOCK THE OTHER, and until 2026-08-25
        // it did. This loop used to `break` on any non-conflict error, which is
        // right for a network failure (nothing else will push either) and
        // catastrophic for a per-file one.
        //
        // Anvil writes to TWO repositories. A token scoped to anvil-data but
        // not mise-data 404s on fitness/daily.json and nothing else. The queue
        // is pushed oldest first, so a check-in saved in the morning sat ahead
        // of the day's session, failed, broke the pass, and workouts.json was
        // never attempted even though its repo was perfectly reachable.
        //
        // The result: David minted a token scoped to anvil-data, which is the
        // repo his sessions live in, and STILL nothing synced. Rig's own copy
        // told him a half-scoped token "syncs half the app", and that was false.
        // It synced none of it.
        //
        // So: a fixable error is per-file, skip it and keep going. Only a
        // genuine reachability failure stops the pass.
        if (!stopsTheWholePass(why)) {
          status.blocked++;
          if (!status.lastError) {
            status.lastError = why.text;
            status.needsYou = true;
          }
          continue;
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
        status.lastError = why.text;
        status.needsYou = false; // it is reachability; the heartbeat will retry
        break;
      }
    }
  } finally {
    status.flushing = false;
    await recount();
  }
}

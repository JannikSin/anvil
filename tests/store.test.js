import test from "node:test";
import assert from "node:assert/strict";

// store.js touches localStorage at call time (inside activeProfile/scoped) —
// stub the boundary before import, same pattern as github-token.test.js.
/** @type {Map<string, string>} */
const kv = new Map();
globalThis.localStorage = /** @type {any} */ ({
  getItem: (/** @type {string} */ k) => kv.get(k) ?? null,
  setItem: (/** @type {string} */ k, /** @type {string} */ v) => kv.set(k, String(v)),
  removeItem: (/** @type {string} */ k) => kv.delete(k),
});
// Anvil has no multi-profile layer, so mise's activeProfile/scoped/
// readProfiles/patchProfiles tests came out with it. What survives is the
// part anvil actually runs: the module has to load and expose the
// offline-first read/write surface.
const store = await import("../app/lib/store.js");

test("store exposes the offline-first surface the views use", () => {
  for (const fn of ["read", "readMeta", "write", "initStore", "getSyncStatus", "onSyncChange"]) {
    assert.equal(typeof store[fn], "function", `store.${fn} is missing`);
  }
});

test("no path scoping survives the port: paths are used verbatim", () => {
  // The bug this catches: reintroducing mise's scoped() would silently
  // rewrite "vitals.json" to "profiles/<id>/vitals.json" and the app would
  // read an empty file forever with no error anywhere.
  assert.equal(store.scoped, undefined);
  assert.equal(store.activeProfile, undefined);
});

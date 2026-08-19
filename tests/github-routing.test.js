import test from "node:test";
import assert from "node:assert/strict";

/** @type {Map<string, string>} */
const kv = new Map();
globalThis.localStorage = /** @type {any} */ ({
  getItem: (/** @type {string} */ k) => kv.get(k) ?? null,
  setItem: (/** @type {string} */ k, /** @type {string} */ v) => kv.set(k, String(v)),
  removeItem: (/** @type {string} */ k) => kv.delete(k),
});

const { repoFor, writeFile, SHARED_DAILY, MISE_TARGETS, DATA_REPO } = await import(
  "../app/lib/github.js"
);

test("anvil's own files route to anvil-data", () => {
  for (const p of ["workouts.json", "vitals.json", "activities.json"]) {
    assert.deepEqual(repoFor(p), { owner: "JannikSin", repo: "anvil-data" });
  }
});

test("the two shared paths route to mise-data", () => {
  assert.deepEqual(repoFor(SHARED_DAILY), { owner: "JannikSin", repo: "mise-data" });
  assert.deepEqual(repoFor(MISE_TARGETS), { owner: "JannikSin", repo: "mise-data" });
});

test("a data-repo override moves anvil's files but never the shared ones", () => {
  kv.set("anvil.dataRepo", "someone/else-data");
  assert.deepEqual(repoFor("workouts.json"), { owner: "someone", repo: "else-data" });
  // the shared row is Mise's file by definition; an override that dragged it
  // along would write David's sleep into a stranger's repo
  assert.deepEqual(repoFor(SHARED_DAILY), { owner: "JannikSin", repo: "mise-data" });
  kv.delete("anvil.dataRepo");
  assert.equal(DATA_REPO.repo, "anvil-data");
});

test("writing Mise's targets file is refused in code, not just in prose", async () => {
  // Anvil never writes a calorie number. If it did, it would be writing the
  // spine of a different app, and the first sign would be Mise's family
  // silently eating to numbers anvil invented.
  await assert.rejects(
    () => writeFile(MISE_TARGETS, { macros: { calories: 1 } }),
    /refusing to write fitness\/targets\.json/,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Every one of David's PWAs lives on janniksin.github.io. Cache Storage,
// localStorage and IndexedDB are all scoped per ORIGIN, not per path, so the
// only thing keeping anvil out of Mise's data is the prefix on a handful of
// string literals. These are source-scan tests, which prove less than pressing
// the button — but the failure they catch is silent, and by the time it shows
// up on a phone Mise's token is already gone.

/** Read a source file with its comments stripped. These tests assert on what
 *  the code DOES; the comments deliberately quote the bad patterns they warn
 *  about, and a scanner that reads them flags the warning as the bug. */
const code = (/** @type {string} */ rel) =>
  readFileSync(new URL(rel, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const sw = code("../sw.js");
const github = code("../app/lib/github.js");
const db = code("../app/lib/db.js");
const main = code("../app/main.js");
const swRaw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

test("the service worker cache name is anvil-prefixed", () => {
  assert.match(sw, /const CACHE_PREFIX = "anvil-shell-";/);
  assert.match(sw, /const CACHE_VERSION = `\$\{CACHE_PREFIX\}v\d+`;/);
});

test("activate deletes ONLY anvil's own caches", () => {
  // Mise, Tally, Finesse and Bonmot all shipped
  //   keys.filter((k) => k !== CACHE_VERSION)
  // which deletes every cache on the origin, i.e. every sibling app, on every
  // deploy. That one missing prefix check is the eviction bug, six times over.
  assert.match(sw, /k\.startsWith\(CACHE_PREFIX\) && k !== CACHE_VERSION/);
  assert.doesNotMatch(
    sw,
    /filter\(\(k\) => k !== CACHE_VERSION\)/,
    "unprefixed cache cleanup evicts every sibling PWA on this origin",
  );
});

test("the service worker registers under anvil's scope, never the origin root", () => {
  assert.match(main, /navigator\.serviceWorker\.register\("\.\/sw\.js", \{ scope: "\.\/" \}\)/);
  assert.doesNotMatch(main, /scope: "\/"/);
});

test("no localStorage key or IndexedDB name collides with Mise's", () => {
  for (const [file, src] of [
    ["github.js", github],
    ["db.js", db],
  ]) {
    // "mise-data" is a legitimate repo NAME here (the shared daily row lives
    // there). What must never appear is a mise-namespaced storage KEY.
    const keys = [...src.matchAll(/"(mise\.[\w.-]*)"/g)].map((m) => m[1]);
    assert.deepEqual(keys, [], `${file} still carries Mise-namespaced storage keys: ${keys}`);
  }
  assert.match(github, /const REPO_KEY = "anvil\.dataRepo";/);
  assert.match(github, /const TOKEN_KEY = "anvil\.pat";/);
  assert.match(db, /const DB_NAME = "anvil";/);
});

test("the shell list covers every module main.js can reach", async () => {
  // A module missing from SHELL is invisible online and a blank screen on a
  // plane. Walk the real import graph rather than trusting the list.
  const { readFileSync: rf } = await import("node:fs");
  /** @type {Set<string>} */
  const seen = new Set();
  /** @param {URL} url @param {string} rel */
  const walk = (url, rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const src = rf(url, "utf8");
    for (const m of src.matchAll(/from "(\.[^"]+)"/g)) {
      const spec = /** @type {string} */ (m[1]);
      const next = new URL(spec, url);
      const nextRel = `./${next.pathname.split("/app/")[1] ? `app/${next.pathname.split("/app/")[1]}` : next.pathname}`;
      walk(next, nextRel);
    }
  };
  walk(new URL("../app/main.js", import.meta.url), "./app/main.js");
  for (const rel of seen) {
    assert.ok(swRaw.includes(`"${rel}"`), `${rel} is missing from the service worker SHELL list`);
  }
});

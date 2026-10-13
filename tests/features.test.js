import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

// THE FEATURE REGISTER (David, 2026-10-13). tests/promises.test.js checks one
// direction: every promise in the Core Purpose has a test. Nothing checked the
// other: that every feature in the app traces to a document. Features built on
// a request or an experiment passed every check with no document behind them,
// and the app and the documents drifted apart. This file closes that:
//   - every view, library module, route and worker route is on the register;
//   - every trace it names exists (a promise, a decision, a tenet, INV);
//   - a forced entry has at least one trace;
//   - an unforced entry prints on every run, owner David, until it is traced,
//     parked or cut.

const ROOT = new URL("../", import.meta.url);
const REG = JSON.parse(readFileSync(new URL("docs/features.json", ROOT), "utf8"));
const DOC = "C:\\Users\\DATar\\Sanity\\Obsidian\\Crystal\\Lanes\\Anvil-Core-Purpose.md";
const byPath = new Map(REG.entries.map((/** @type {any} */ e) => [e.path, e]));

/** every path the app actually has */
function actualPaths() {
  const out = ["app/main.js"];
  for (const dir of ["app/views", "app/lib", "worker/src"]) {
    for (const f of readdirSync(new URL(`${dir}/`, ROOT)))
      if (f.endsWith(".js")) out.push(`${dir}/${f}`);
  }
  const router = readFileSync(new URL("app/lib/router.js", ROOT), "utf8");
  for (const m of router.matchAll(/case "([a-z]+)":/g)) {
    if (m[1] !== "train") out.push(`route:${m[1]}`);
  }
  const worker = readFileSync(new URL("worker/src/index.js", ROOT), "utf8");
  for (const m of worker.matchAll(/url\.pathname === "(\/[a-z]+)"/g)) out.push(`worker:${m[1]}`);
  return [...new Set(out)];
}

test("every view, module, route and worker route is on the feature register", () => {
  const missing = actualPaths().filter((p) => !byPath.has(p));
  assert.deepEqual(
    missing,
    [],
    `not on docs/features.json: ${missing.join(", ")}. Name the promise, decision or tenet that forces it, or mark it unforced for David to rule on.`,
  );
});

test("the register lists nothing the app no longer has", () => {
  const have = new Set(actualPaths());
  const stale = REG.entries.map((/** @type {any} */ e) => e.path).filter((p) => !have.has(p));
  assert.deepEqual(stale, [], `on the register but gone from the app: ${stale.join(", ")}`);
});

test("every trace names something that exists, and every forced entry has one", () => {
  const promises = existsSync(DOC)
    ? new Set([...readFileSync(DOC, "utf8").matchAll(/^### (P\d+)\./gm)].map((m) => m[1]))
    : null;
  const decisions = new Set(
    readdirSync(new URL("docs/decisions/", ROOT))
      .map((f) => /^(\d{4})-/.exec(f)?.[1])
      .filter(Boolean)
      .map((n) => `D${n}`),
  );
  for (const e of REG.entries) {
    assert.ok(
      ["forced", "support", "unforced"].includes(e.status),
      `${e.path}: unknown status ${e.status}`,
    );
    assert.ok(e.note && e.note.length > 5, `${e.path}: say what it is`);
    if (e.status === "forced")
      assert.ok(e.traces.length > 0, `${e.path} is forced but names no document`);
    for (const t of e.traces) {
      if (/^T[1-7]$/.test(t) || t === "INV") continue;
      if (/^D\d{4}$/.test(t)) {
        assert.ok(decisions.has(t), `${e.path}: decision ${t} does not exist`);
        continue;
      }
      if (/^P\d+$/.test(t)) {
        if (promises)
          assert.ok(promises.has(t), `${e.path}: promise ${t} is not in the Core Purpose`);
        continue;
      }
      assert.fail(`${e.path}: unreadable trace "${t}"`);
    }
  }
});

// Unforced entries are carried with no document behind them. They print on
// every run, like the promise gate register, until David traces, parks or cuts.
for (const e of REG.entries.filter((/** @type {any} */ x) => x.status === "unforced")) {
  test(`UNFORCED ${e.path}`, { todo: `owner David: ${e.note}` }, () => {});
}

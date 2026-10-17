// The app since 2026-10-16: the blind rebuild plus David's 10/16 changes (two tabs, blocks,
// routine order, sync on the token the phone already holds). Pure logic only; the screens are
// pressed by hand before a push (CLAUDE.md, gates).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";

const require = createRequire(import.meta.url);
const P = require("../app/program.js");
const C = require("../app/core.js");
const Y = require("../app/sync.js");
const PROFILE = require("../app/profile.js");

function memStore() {
  const m = {};
  return {
    m,
    store: C.makeStore({
      getItem: (k) => (k in m ? m[k] : null),
      setItem: (k, v) => {
        m[k] = String(v);
      },
      removeItem: (k) => {
        delete m[k];
      },
    }),
  };
}

test("the plan passes its own check: every group 10 to 20 hard sets a week at six sessions", () => {
  const r = C.planCheck(P, 6);
  assert.deepEqual(r.gaps, []);
});

test("every day is blocks, and a superset block names its one station", () => {
  for (const [id, s] of Object.entries(P.sessions)) {
    assert.ok(s.blocks.length >= 4, id);
    for (const b of s.blocks) {
      assert.ok(b.lifts.length === 1 || b.lifts.length === 2, `${id} block ${b.name}`);
      assert.equal(b.superset, b.lifts.length === 2, `${id} block ${b.name}`);
      if (b.superset) assert.ok(b.where, `${id} block ${b.name} has no station`);
    }
  }
});

test("the main lift of each day is done alone (panel 10/16: the rest is what makes the next set)", () => {
  for (const [id, s] of Object.entries(P.sessions)) {
    const main = s.blocks.filter((b) => b.lifts.some((l) => l.main));
    assert.equal(main.length, 1, id);
    assert.equal(main[0].superset, false, id);
  }
});

test("no day has two vertical pulls; Pull A is the pulldown, Pull B the pull-up, no 'or'", () => {
  const names = (id) => P.sessions[id].lifts.map((l) => l.name);
  assert.ok(names("pull-a").includes("Lat Pulldown"));
  assert.ok(!names("pull-a").includes("Weighted Pull-up"));
  assert.ok(names("pull-b").includes("Weighted Pull-up"));
  assert.ok(!names("pull-b").includes("Lat Pulldown"));
  for (const s of Object.values(P.sessions))
    for (const l of s.lifts) assert.ok(!/pull-up or|or lat pulldown/i.test(l.name), l.name);
});

test("every lift carries a cue and a source", () => {
  for (const s of Object.values(P.sessions))
    for (const l of s.lifts) {
      assert.ok(l.cue, l.name);
      assert.ok(l.source && l.source.who, l.name);
    }
});

test("the morning happens in order: supplements, out the door, then the gym; caffeine at noon", () => {
  const { store } = memStore();
  const R = C.routine(store, "2026-10-19", C.profile(store, PROFILE), P);
  const keys = R.morning.map((i) => i.key);
  const at = (k) => keys.indexOf(k);
  assert.ok(at("creatine") > at("checkin"));
  assert.ok(at("out") > at("fishOil"));
  assert.ok(at("gym") > at("out"));
  const day = R.day.map((i) => i.key);
  assert.ok(day.includes("caffeine") && day.includes("ltheanine"));
  assert.ok(!keys.includes("ltheanine"));
  assert.equal(R.evening.filter((i) => i.key === "magnesium").length, 1);
});

test("supplement ids are Mise's, so both apps tick the same field", () => {
  const ids = PROFILE.training.supplements.map((s) => s.id);
  for (const id of ["creatine", "d3", "fishOil", "ltheanine", "magnesium"]) assert.ok(ids.includes(id), id);
});

test("the queue moves on completion, never the weekday", () => {
  const { store } = memStore();
  assert.equal(C.nextInQueue(store, P), "push-a");
  C.fileSession(store, { id: "x1", date: "2026-10-16", template: "push-a", lifts: {} }, P);
  assert.equal(C.nextInQueue(store, P), "pull-a");
});

test("a note left on a lift shows up the next time that lift comes round", () => {
  const { store } = memStore();
  C.fileSession(
    store,
    { id: "x1", date: "2026-10-16", template: "push-a", lifts: { a: { key: "incline-db-press", w: 75, r: 8, logged: true, note: "left shoulder clicks" } } },
    P,
  );
  assert.equal(C.lastNote(store, "incline-db-press").note, "left shoulder clicks");
});

test("records live under anvil.v2.*, apart from the first Anvil's keys", () => {
  const { store, m } = memStore();
  store.set("draft", { a: 1 });
  C.upsertDay(store, "2026-10-16", { weight: 187 });
  for (const k of Object.keys(m)) assert.ok(k.startsWith("anvil.v2."), k);
});

test("sync: a remote session maps to block lifts and keeps its id", () => {
  const remote = { date: "2026-10-13", templateId: "push-a", id: "0f9bd94c", exercises: [{ name: "Incline DB Press", sets: [{ weight: 70, reps: 9 }, { weight: 75, reps: 6 }] }] };
  const loc = Y.sessionToLocal(remote, P);
  assert.equal(loc.id, "0f9bd94c");
  assert.equal(loc.programme, P.id);
  const lift = Object.values(loc.lifts)[0];
  assert.deepEqual([lift.key, lift.w, lift.r], ["incline-db-press", 75, 6]);
  const back = Y.sessionToRemote(loc, P);
  assert.equal(back.templateId, "push-a");
  assert.equal(back.exercises[0].name, "Incline DB Press");
});

test("sync: a daily patch is field by field and never drops Mise's fields", () => {
  const file = { days: [{ date: "2026-10-16", water: 3, dailyDozen: { beans: 2 }, supplements: { magnesium: true } }] };
  const out = Y.applyDaily(file, [{ date: "2026-10-16", patch: { weight: 186.8, sleep: 7.5, supplements: { creatine: true } } }]);
  const row = out.days[0];
  assert.equal(row.water, 3);
  assert.deepEqual(row.dailyDozen, { beans: 2 });
  assert.deepEqual(row.supplements, { magnesium: true, creatine: true });
  assert.equal(row.sleepHours, 7.5);
  assert.equal(row.sleep, undefined);
  const local = Y.dailyToLocal(out);
  assert.equal(local["2026-10-16"].sleep, 7.5);
  assert.equal(local["2026-10-16"].water, undefined);
});

test("sync: a null in a patch removes only that one tick", () => {
  const file = { days: [{ date: "2026-10-16", supplements: { creatine: true, d3: true } }] };
  const out = Y.applyDaily(file, [{ date: "2026-10-16", patch: { supplements: { creatine: null } } }]);
  assert.deepEqual(out.days[0].supplements, { d3: true });
});

test("service worker: anvil-shell- prefix, deletes only its own caches, shells every script the page loads", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, /var CACHE_PREFIX = "anvil-shell-";/);
  assert.match(sw, /k\.indexOf\(CACHE_PREFIX\) === 0 && k !== CACHE/);
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const [, src] of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="\.\/([^"]+)"/g)) assert.ok(sw.includes(`"./${src}"`), src);
});

test("no app file reads or writes a mise.* key", () => {
  for (const f of ["app.js", "core.js", "sync.js"]) {
    const src = readFileSync(new URL(`../app/${f}`, import.meta.url), "utf8");
    assert.ok(!/["']mise\./.test(src), f);
  }
});

// Tribunal 10/17 (vrony): a workout left without tapping File was filed locally on the next open,
// then the pull right after replaced the local sessions with the remote copy and dropped it.
// This drives the real boot sequence against a fake GitHub: file the stale draft, queue it, pull.
test("a workout left unfiled survives the next open: filed, pushed, and still there after the pull", async () => {
  const { store } = memStore();
  const files = {
    "mise-data/fitness/daily.json": { days: [] },
    "anvil-data/workouts.json": { templates: [], sessions: [] },
    "anvil-data/activities.json": { activities: [{ id: "r1", date: "2026-10-15", type: "tennis", minutes: 60 }] },
  };
  const ls = { "anvil.pat": "test-token" };
  globalThis.localStorage = { getItem: (k) => (k in ls ? ls[k] : null) };
  globalThis.fetch = async (url, opt = {}) => {
    const m = /repos\/JannikSin\/([^/]+)\/contents\/([^?]+)/.exec(url);
    const key = `${m[1]}/${m[2]}`;
    if ((opt.method || "GET") === "PUT") {
      files[key] = JSON.parse(Buffer.from(JSON.parse(opt.body).content, "base64").toString("utf8"));
      return { ok: true, status: 200, json: async () => ({}) };
    }
    const content = Buffer.from(JSON.stringify(files[key])).toString("base64");
    return { ok: true, status: 200, json: async () => ({ content, sha: "s" }) };
  };
  try {
    store.set("draft", { id: "d1", date: "2026-10-16", template: "pull-a", lifts: { "pull-a-cable-row": { key: "cable-row", w: 140, r: 8, logged: true } } });
    const S = Y.make(store, P, null);
    const rec = C.fileStaleDraft(store, "2026-10-17", P);
    assert.ok(rec);
    S.queueSession(rec.id);
    await S.pull();
    assert.ok(store.get("sessions", []).some((s) => s.id === "d1"), "dropped from the local record");
    assert.ok(files["anvil-data/workouts.json"].sessions.some((s) => s.id === "d1"), "never reached anvil-data");
    assert.equal(C.filedFor(store, P).length, 1, "the filed workout counts for the queue");
    assert.equal(store.get("sync.last", {}).ok, true, "the pull itself succeeded");
    assert.deepEqual(store.get("activities", []).map((a) => a.kind), ["tennis"], "activities come down from anvil-data");
  } finally {
    delete globalThis.localStorage;
    delete globalThis.fetch;
  }
});

test("an export never carries the GitHub token, and an import never replaces it", () => {
  assert.equal(C.portableKey("anvil.pat"), false);
  assert.equal(C.portableKey("anvil.pat.savedAt"), false);
  assert.equal(C.portableKey("anvil.v2.sessions"), true);
  assert.equal(C.portableKey("mise.pat"), false);
  assert.equal(C.portableKey("anvil.v2.push"), false, "the reminder server's url and bearer key");
  assert.equal(C.portableKey("anvil.v2.push.state"), false);
  const src = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");
  assert.equal((src.match(/C\.portableKey/g) || []).length, 2);
});

test("activities sync to anvil-data in v1's shape; a removal deletes only that one", () => {
  const file = { activities: [{ id: "a1", date: "2026-10-10", type: "walk", minutes: 20 }, { id: "a2", date: "2026-10-12", type: "run", minutes: 25 }] };
  const local = [{ id: "a3", date: "2026-10-17", kind: "tennis", minutes: 60, conditioning: true }];
  const out = Y.applyActivities(file, local, { put: ["a3"], del: ["a1"] });
  assert.deepEqual(out.activities.map((a) => a.id), ["a2", "a3"]);
  assert.deepEqual(out.activities[1], { id: "a3", date: "2026-10-17", type: "tennis", minutes: 60 });
  const back = Y.activityToLocal(out.activities[0]);
  assert.equal(back.kind, "run");
  assert.equal(back.conditioning, true);
});

test("service worker: a slow network falls back to the cached shell instead of hanging", () => {
  const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
  assert.match(sw, /setTimeout\(resolve, 2500\)/);
  assert.match(sw, /Promise\.race/);
  // index.html stands in only for a page load, never for a script, icon or JSON (Tribunal 10/17)
  assert.match(sw, /nav \? caches\.match\("\.\/index\.html"\) : undefined/);
});

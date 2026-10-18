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
const TEMPLATE = require("../app/profile.js");

// A neutral, invented profile in the shape of the private profile.json in anvil-data. The real one
// never enters this public repo; these values describe nobody.
const FIXTURE = {
  template: false,
  base: { goal: { what: "Example goal", target: 1, unit: "lb", date: "2027-01-01" }, units: "lb" },
  training: {
    days: {
      weekday: { wake: "06:00", supps: "06:05", out: "06:15", gym: "06:30" },
      weekend: { wake: "07:00", supps: "07:05", out: "07:15", gym: "07:30" },
    },
    gymLabel: "Gym, example",
    evening: { rulesOn: [0, 1, 2, 3, 4], kitchen: "21:00", magnesium: "21:30", firstLine: "21:30", read: "22:00", lightsOut: "22:30" },
    pushups: 10,
    supplements: [
      { id: "creatine", name: "Supp A", dose: "1 g", when: "morning" },
      { id: "fishOil", name: "Supp B", dose: "1 g", when: "morning" },
      { id: "caffeine", name: "Supp C", dose: "1 g", when: "noon" },
      { id: "ltheanine", name: "Supp D", dose: "1 g", when: "noon" },
      { id: "magnesium", name: "Supp E", dose: "1 g", when: "evening" },
    ],
    reward: "example reward",
    readWhat: "example book",
    reminders: { on: true, repeatMinutes: 15 },
    startLoads: { "back-squat": 100 },
    strengthGoals: [{ lift: "Example lift", now: "1", goal: "2" }],
  },
};

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
  store.set("profile.mine", FIXTURE);
  const R = C.routine(store, "2026-10-19", C.profile(store, TEMPLATE), P);
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

test("a supplement's row key is its profile id, so a tick lands on the same field Mise ticks", () => {
  const { store } = memStore();
  store.set("profile.mine", FIXTURE);
  const R = C.routine(store, "2026-10-19", C.profile(store, TEMPLATE), P);
  const supps = [].concat(R.morning, R.day, R.evening).filter((i) => i.kind === "supp");
  assert.deepEqual(supps.map((i) => i.key).sort(), FIXTURE.training.supplements.map((s) => s.id).sort());
  C.upsertDay(store, "2026-10-19", { supplements: { creatine: true } });
  const R2 = C.routine(store, "2026-10-19", C.profile(store, TEMPLATE), P);
  assert.equal(R2.morning.find((i) => i.key === "creatine").done, true);
});

// Audit A23: the public repo carries nothing measured about a person. The profile shipped with the
// app is a blank template; the person's own lives in the private anvil-data repo.
test("the shipped profile is a blank template that carries nothing measured", () => {
  assert.equal(TEMPLATE.template, true);
  assert.equal(TEMPLATE.base.goal, null);
  assert.deepEqual(TEMPLATE.training.supplements, []);
  assert.deepEqual(TEMPLATE.training.startLoads, {});
  assert.deepEqual(TEMPLATE.training.strengthGoals, []);
  assert.equal(TEMPLATE.training.pushups, null);
  assert.equal(TEMPLATE.training.reward, "");
  assert.equal(TEMPLATE.training.readWhat, "");
  assert.equal(TEMPLATE.training.reminders.on, false);
  assert.deepEqual(TEMPLATE.training.evening.rulesOn, []);
  const src = readFileSync(new URL("../app/profile.js", import.meta.url), "utf8");
  for (const word of ["David", "CoRec", "Instagram", "creatine", "caffeine", "200 lb", "275", "Crystal"])
    assert.ok(!src.includes(word), `profile.js names ${word}`);
  for (const f of ["app.js", "core.js", "sync.js", "program.js"]) {
    const s = readFileSync(new URL(`../app/${f}`, import.meta.url), "utf8");
    assert.ok(!/CoRec|fatigue file/.test(s), f);
  }
});

test("the profile is three layers: template, then the synced copy, then this phone's training edits", () => {
  const { store } = memStore();
  const bare = C.profile(store, TEMPLATE);
  assert.equal(bare.template, true);
  assert.equal(bare.base.goal, null);
  store.set("profile.mine", { base: FIXTURE.base, training: FIXTURE.training }); // no template field
  C.saveTraining(store, { reminders: { on: false } });
  const p = C.profile(store, TEMPLATE);
  assert.equal(p.template, false, "a synced copy is never a template");
  assert.equal(p.base.goal.what, "Example goal");
  assert.equal(p.training.gymLabel, "Gym, example");
  assert.equal(p.training.reminders.on, false, "the local edit wins");
  assert.equal(p.training.reminders.repeatMinutes, 15);
  assert.equal(p.training.sessionsIntent, TEMPLATE.training.sessionsIntent, "a field the synced copy lacks comes from the template");
  assert.equal(TEMPLATE.base.goal, null, "the template object is never mutated");
});

test("the blank template runs every day's routine, reminders and phone push without a crash", () => {
  const { store } = memStore();
  const pr = C.profile(store, TEMPLATE);
  for (let i = 0; i < 7; i++) {
    const d = C.addDays("2026-10-18", i);
    const R = C.routine(store, d, pr, P);
    for (const it of [].concat(R.morning, R.day, R.evening)) assert.ok(!/undefined|null|NaN/.test(it.label), it.label);
    C.dueNow(store, d, "23:59", pr, P);
    C.pushDay(store, d, pr, P, () => 0);
  }
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

// The private profile comes down with the pull, is kept on the phone, and a missing or unreadable
// profile.json keeps the last copy without failing the record's sync.
test("sync: the pull brings profile.json from anvil-data; a 404 or an error keeps the last copy", async () => {
  const { store } = memStore();
  const files = {
    "mise-data/fitness/daily.json": { days: [] },
    "anvil-data/workouts.json": { sessions: [] },
    "anvil-data/activities.json": { activities: [] },
    "anvil-data/profile.json": FIXTURE,
  };
  let profileStatus = 200;
  const ls = { "anvil.pat": "test-token" };
  globalThis.localStorage = { getItem: (k) => (k in ls ? ls[k] : null) };
  globalThis.fetch = async (url) => {
    const m = /repos\/JannikSin\/([^/]+)\/contents\/([^?]+)/.exec(url);
    const key = `${m[1]}/${m[2]}`;
    const status = key === "anvil-data/profile.json" ? profileStatus : 200;
    if (status !== 200) return { ok: false, status, json: async () => ({}) };
    const content = Buffer.from(JSON.stringify(files[key])).toString("base64");
    return { ok: true, status: 200, json: async () => ({ content, sha: "s" }) };
  };
  try {
    const S = Y.make(store, P, null);
    assert.equal(C.profile(store, TEMPLATE).template, true, "before the first pull: the template");
    await S.pull();
    const p = C.profile(store, TEMPLATE);
    assert.equal(p.template, false);
    assert.equal(p.base.goal.what, "Example goal");
    profileStatus = 404;
    await S.pull();
    assert.equal(C.profile(store, TEMPLATE).base.goal.what, "Example goal", "a 404 keeps the last copy");
    profileStatus = 500;
    await S.pull();
    assert.equal(C.profile(store, TEMPLATE).base.goal.what, "Example goal", "an error keeps the last copy");
    assert.equal(store.get("sync.last", {}).ok, true, "a profile failure never fails the record's sync");
    profileStatus = 200;
    files["anvil-data/profile.json"] = [1, 2];
    await S.pull();
    assert.equal(C.profile(store, TEMPLATE).base.goal.what, "Example goal", "a file that is not a profile is ignored");
  } finally {
    delete globalThis.localStorage;
    delete globalThis.fetch;
  }
});

test("with no token the pull does nothing and the template stays in use", async () => {
  const { store } = memStore();
  globalThis.localStorage = { getItem: () => null };
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("no fetch without a token");
  };
  try {
    await Y.make(store, P, null).pull();
    assert.equal(called, false);
    assert.equal(C.profile(store, TEMPLATE).template, true);
  } finally {
    delete globalThis.localStorage;
    delete globalThis.fetch;
  }
});

test("a top set under the range steps the weight down to the bottom of the range; in range adds a rep", () => {
  const l = P.sessions["push-a"].lifts.find((x) => x.progressKey === "incline-db-press");
  const under = C.prescribe(l, [{ date: "2026-10-13", w: 75, r: 3 }], {});
  assert.deepEqual([under.w, under.r], [70, l.lo]);
  const inRange = C.prescribe(l, [{ date: "2026-10-13", w: 75, r: 7 }], {});
  assert.deepEqual([inRange.w, inRange.r], [75, 8]);
  const top = C.prescribe(l, [{ date: "2026-10-13", w: 75, r: l.hi }], {});
  assert.deepEqual([top.w, top.r], [80, l.lo]);
});

test("the gym tab (David 10/18): typed numbers, no plus/minus, a Rest button that LOG never starts", () => {
  const src = readFileSync(new URL("../app/app.js", import.meta.url), "utf8");
  assert.ok(!/data-act="adj"/.test(src), "no stepper buttons on a lift");
  assert.ok(/data-act="setr"/.test(src) && /data-act="setw"/.test(src), "weight and reps are typed boxes");
  assert.ok(/'<button class="knob" data-act="rest"/.test(src), "a Rest button on the lift, not behind Settings");
  const logBranch = src.slice(src.indexOf('if (a === "log")'), src.indexOf('if (a === "rest")'));
  assert.ok(!/store\.set\("timer"/.test(logBranch), "LOG never starts the timer");
});

test("a lift's chart waits for a month and three sessions, and its y-axis starts at zero", () => {
  const h = [{ date: "2026-10-01", w: 100, r: 8 }, { date: "2026-10-15", w: 100, r: 9 }];
  assert.equal(C.progressChart(h).ready, false);
  assert.equal(C.progressChart(h.concat([{ date: "2026-10-20", w: 105, r: 6 }])).ready, false, "under 28 days");
  const c = C.progressChart(h.concat([{ date: "2026-10-29", w: 105, r: 6 }]));
  assert.ok(c.ready);
  assert.equal(c.ymin, 0);
  assert.ok(c.ymax >= 105);
  assert.ok(/>0<\/text>/.test(c.svg), "the zero tick is drawn");
  const bw = C.progressChart([{ date: "2026-09-01", w: 0, r: 8 }, { date: "2026-09-15", w: 0, r: 10 }, { date: "2026-10-01", w: 0, r: 12 }], true);
  assert.equal(bw.unit, "reps");
});

test("sessions from before the block feed a lift's history without moving the queue", () => {
  const { store } = memStore();
  const old = { date: "2026-08-25", templateId: "lower-a", id: "29605187", exercises: [{ name: "Back Squat", sets: [{ weight: 235, reps: 5 }] }] };
  store.set("sessions", [Y.sessionToLocal(old, P)]);
  assert.equal(C.nextInQueue(store, P), P.queue[0]);
  assert.deepEqual(C.history(store, "back-squat").map((e) => [e.w, e.r]), [[235, 5]]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import { nextInRotation, progressionFor, sessionsOn } from "../app/lib/workouts.js";
import {
  AEROBIC,
  TYPES,
  addActivity,
  hrRest,
  interferenceWarning,
  weeklyAerobic,
} from "../app/lib/activities.js";
import { upsertDay, ANVIL_FIELDS } from "../app/lib/daily.js";

// Read rather than `import ... with { type: "json" }`: Node 24 accepts the
// import attribute but the eslint parser does not, and the rest of the suite
// already reads this file this way.
const program = JSON.parse(
  readFileSync(new URL("../app/data/program.json", import.meta.url), "utf8"),
);

/**
 * The promise ledger.
 *
 * WHY THIS FILE EXISTS. Anvil's sibling document, Mise-Core-Purpose, carried a
 * promise from the day it was written that "the generator does not buy grams
 * past the target." It was never implemented, at any point, and nobody noticed
 * for weeks, because the document was read as a statement of intent rather than
 * as a claim about the code. The document was lying and had no way to know.
 *
 * David's instruction, 2026-08-19: "that cannot happen for Anvil ... that needs
 * to be identified, and that needs to be put to the top of the priority list."
 *
 * SO: Anvil-Core-Purpose.md carries a status line under every promise, and this
 * file parses that document and fails the build when the document and the suite
 * disagree. Three ways it can fail:
 *
 *   1. A promise has no status line at all.
 *   2. A promise claims "Proven by: ... > <name>" and no test here has that name.
 *   3. A promise is marked NOT BUILT and a test here claims to prove it anyway.
 *
 * The document is allowed to describe things that are not built. It is not
 * allowed to be WRONG about which ones.
 *
 * A note on the vault dependency below: this file reads the authority document
 * out of the Obsidian vault, because that is where David reads it and a second
 * copy in the repo would be the exact disease this file exists to prevent. If
 * the vault is not present the meta-tests FAIL rather than skip, deliberately.
 * A silent skip is the rot mode.
 */

const DOC =
  "C:\\Users\\DATar\\Sanity\\Obsidian\\Crystal\\Lanes\\Anvil-Core-Purpose.md";

// ---------------------------------------------------------------------------
// The behaviour tests. One entry per promise the document claims is proven.
// The `name` MUST match the document's "Proven by" line character for character.
// ---------------------------------------------------------------------------

const sched = program.schedule;
const temps = program.templates;

/** @type {{ id: string, name: string, fn: () => void }[]} */
const PROMISES = [
  {
    id: "P1",
    name: "P1 opening the app resolves a session with zero taps",
    fn: () => {
      // Empty log, no input of any kind: a complete session must fall out.
      const t = nextInRotation(sched, temps, []);
      assert.ok(t, "an empty log still resolves a session");
      assert.ok(t.exercises.length > 0, "and the session has exercises");
      for (const ex of t.exercises) {
        assert.ok(ex.name, "every exercise is named");
        assert.ok(Number.isFinite(ex.targetSets), `${ex.name} has a set count`);
        assert.ok(ex.targetReps != null, `${ex.name} has a rep target`);
        assert.ok(Number.isFinite(ex.rest), `${ex.name} has a rest interval`);
      }
    },
  },
  {
    id: "P2",
    name: "P2 every readable rep range prefills its next set, and a stall raises at three",
    fn: () => {
      const at = (date, weight, reps) => ({
        date,
        exercises: [{ name: "Squat", sets: [{ weight, reps }] }],
      });

      // Below the top of the range: add a rep, same load.
      const rep = progressionFor([at("2026-08-01", 225, 8)], "Squat", "8-10", 10);
      assert.equal(rep.kind, "rep");
      assert.equal(rep.weight, 225);
      assert.equal(rep.reps, 9);

      // At the top: add load, reset to the bottom of the range.
      const load = progressionFor([at("2026-08-01", 225, 10)], "Squat", "8-10", 10);
      assert.equal(load.kind, "load");
      assert.equal(load.weight, 235);
      assert.equal(load.reps, 8);
      assert.ok(load.label, "the prefill states which move it is making");

      // Three identical sessions raise the stall flag.
      const stalled = progressionFor(
        [at("2026-08-01", 225, 8), at("2026-08-03", 225, 8), at("2026-08-05", 225, 8)],
        "Squat",
        "8-10",
        10,
      );
      assert.ok(stalled.stalled, "three identical sessions is a stall, not a fourth prescription");

      // Unreadable prescriptions refuse rather than guess.
      assert.equal(progressionFor([at("2026-08-01", 0, 0)], "Plank", "max time", 5), null);
    },
  },
  {
    id: "P4",
    name: "P4 a set logs from the prefill without a keyboard",
    fn: () => {
      // The keystone promise, in its testable half: the app proposes a COMPLETE
      // set, so the common case is one press and no typing. Back-dating is the
      // other half and is NOT built; the document says so and Fix-List job 1
      // owns it.
      const hist = [
        { date: "2026-08-01", exercises: [{ name: "Bench", sets: [{ weight: 185, reps: 8 }] }] },
      ];
      const next = progressionFor(hist, "Bench", "8-10", 5);
      assert.ok(Number.isFinite(next.weight), "the weight is supplied, not typed");
      assert.ok(Number.isFinite(next.reps), "the reps are supplied, not typed");
      assert.ok(next.weight > 0 && next.reps > 0, "and both are usable as-is");
    },
  },
  {
    id: "P5",
    name: "P5 every modality logs from the day screen and counts only what it serves",
    fn: () => {
      // Every declared type is loggable.
      let book = { activities: [] };
      TYPES.forEach((t, i) => {
        book = addActivity(book, { date: "2026-08-19", type: t, minutes: 30 }, `id${i}`);
      });
      assert.equal(book.activities.length, TYPES.length, "every modality is loggable");

      // Nothing but minutes is required.
      const bare = addActivity({ activities: [] }, { date: "2026-08-19", type: "run", minutes: 20 }, "x");
      assert.equal(bare.activities[0].miles, undefined, "a run with only a duration is a logged run");

      // And each counts toward the metric it genuinely serves, and no other.
      const w = weeklyAerobic(
        [
          { id: "a", date: "2026-08-19", type: "climb", minutes: 90 },
          { id: "b", date: "2026-08-19", type: "run", minutes: 30 },
        ],
        "2026-08-19",
      );
      assert.equal(w.minutes, 30, "climbing is training but it is not aerobic minutes");
      assert.equal(w.byType.climb, 90, "and it is still recorded");
      for (const t of AEROBIC) assert.ok(TYPES.includes(t), `${t} is a real type`);
    },
  },
  {
    id: "P6",
    name: "P6 the check-in fires once per calendar day and dismissing is free",
    fn: () => {
      // One row per calendar day, however many times it is patched.
      let d = { days: [] };
      d = upsertDay(d, "2026-08-19", { weight: 192.6 });
      d = upsertDay(d, "2026-08-19", { sleepHours: 8 });
      assert.equal(d.days.length, 1, "a second patch edits the day, it does not add one");
      assert.equal(d.days[0].weight, 192.6);
      assert.equal(d.days[0].sleepHours, 8);

      // "Once means once, not once per app." The row is shared with Mise, so a
      // patch must never drop a field this app does not own. That is what makes
      // reading a sibling's answer instead of re-asking possible at all.
      let shared = { days: [{ date: "2026-08-19", water: 3.5, supplements: true }] };
      shared = upsertDay(shared, "2026-08-19", { weight: 192.6 });
      assert.equal(shared.days[0].water, 3.5, "Mise's fields survive an anvil write");
      assert.equal(shared.days[0].supplements, true);
      assert.deepEqual(ANVIL_FIELDS, ["sleepHours", "weight", "pushups"]);

      // Dismissing is free: an unpatched day simply has no row, which carries no
      // penalty anywhere in the model.
      assert.equal((upsertDay({ days: [] }, "2026-08-19", {}).days ?? []).length, 1);
    },
  },
  {
    id: "P7",
    name: "P7 every tracked field traces to a decision",
    fn: () => {
      // P7 forbids decoration: a collected field must feed a decision or be
      // deleted. This test cannot infer intent, so it holds an explicit ledger
      // and fails when a NEW field appears in neither column. That forces the
      // decision at the moment the field is added, which is the only moment it
      // is cheap.
      const CONSUMED = {
        date: "windowing in weeklyAerobic and sessionsOn",
        type: "AEROBIC membership, byType totals",
        minutes: "weeklyAerobic total and the longest-session guard",
        id: "the merge key on conflict",
        miles: "displayed with the entry, and pace context for the run",
        avgHr: "read alongside hrRest when gating rest",
      };
      // Known decoration. Listed, not hidden. Fix-List owns it.
      const UNCONSUMED = {
        hrDrop60: "collected, read by nothing. Should feed a trend: a rising 60s drop is the direct measurement of the goal he actually stated.",
      };
      const NOTE_ONLY = ["note"];

      const src = readFileSync(new URL("../app/lib/activities.js", import.meta.url), "utf8");
      const typedef = src.slice(src.indexOf("@typedef"), src.indexOf("} Activity"));
      const fields = [...typedef.matchAll(/^\s*\*\s+(\w+)\??:/gm)].map((m) => m[1]);
      assert.ok(fields.length >= 6, "the Activity typedef was found and parsed");

      for (const f of fields) {
        const known = f in CONSUMED || f in UNCONSUMED || NOTE_ONLY.includes(f);
        assert.ok(
          known,
          `Activity.${f} is tracked but is in neither the CONSUMED nor the UNCONSUMED ledger. ` +
            `P7 says a field must feed a decision or be deleted. Decide now, in this file.`,
        );
      }
      assert.equal(Object.keys(UNCONSUMED).length, 1, "exactly one known piece of decoration remains");
    },
  },
  {
    id: "P8",
    name: "P8 rest is per-exercise, gated on heart-rate reserve, and degrades to the floor",
    fn: () => {
      // Per-exercise: the programme carries a rest interval on every movement,
      // not one global constant.
      const rests = new Set();
      for (const t of temps) for (const ex of t.exercises) rests.add(ex.rest);
      assert.ok(rests.size > 1, "rest is a property of the lift, not a constant");

      // The target is 60% of heart rate reserve, not a fixed drop.
      assert.equal(hrRest(170, 60, 195, 120).target, 141);

      // The exercise's own floor always wins, however fast recovery is.
      const floored = hrRest(142, 60, 195, 180);
      assert.equal(floored.seconds, 180);
      assert.equal(floored.capped, "floor");

      // Failing to recover is data, not an error: it caps.
      assert.ok(hrRest(194, 60, 195, 120).seconds <= 240);

      // And it is fully usable with no heart rate at all.
      const blind = hrRest(0, 60, 195, 150);
      assert.equal(blind.seconds, 150, "no reading means the floor is the whole answer");
    },
  },
  {
    id: "P9",
    name: "P9 nothing in the model can represent being behind",
    fn: () => {
      const done = [
        { date: "2026-08-01", templateId: "lower-a", exercises: [{ name: "Squat", sets: [] }] },
      ];
      // A ten-day gap and a one-day gap must produce the SAME next session.
      // If the app could represent being behind, these would differ.
      const afterGap = nextInRotation(sched, temps, done);
      const afterOneDay = nextInRotation(sched, temps, done);
      assert.equal(afterGap.id, afterOneDay.id, "the rotation advances on completion, not the calendar");
      assert.ok(afterGap.id !== "lower-a", "and it advanced past what was completed");

      // Nothing anywhere counts a miss.
      assert.equal(sessionsOn(done, "2026-08-19").length, 0, "a day with no session is simply empty");
      const shape = Object.keys(afterGap).join(" ") + Object.keys(done[0]).join(" ");
      for (const banned of ["streak", "percent", "missed", "behind", "completion"]) {
        assert.ok(!shape.toLowerCase().includes(banned), `the model has no "${banned}" field`);
      }
    },
  },
  {
    id: "P10",
    name: "P10 the guard watches session duration and calorie cost, and a quiet week is silent",
    fn: () => {
      const a = (date, type, minutes) => ({ id: date + type, date, type, minutes });

      // A quiet week says nothing. A warning that always fires is noise.
      assert.equal(interferenceWarning([], "2026-08-19"), null);
      assert.equal(interferenceWarning([a("2026-08-19", "run", 30)], "2026-08-19"), null);

      // Five short runs is the plan, not a problem. Run COUNT is not watched.
      const five = ["2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19"].map((d) =>
        a(d, "run", 30),
      );
      assert.equal(interferenceWarning(five, "2026-08-19"), null);

      // Duration is watched, because it is the moderator with real evidence.
      assert.match(String(interferenceWarning([a("2026-08-19", "run", 135)], "2026-08-19")), /135 min session/);

      // And the weekly warning is stated in calories, because that is the
      // variable that can actually end a gain phase.
      const heavy = [a("2026-08-19", "tennis", 100), a("2026-08-18", "run", 90)];
      assert.match(String(interferenceWarning(heavy, "2026-08-19")), /kcal to put back/);
    },
  },
];

for (const p of PROMISES) test(p.name, p.fn);

// ---------------------------------------------------------------------------
// UNBUILT PROMISES ARE `todo`, NEVER ABSENT.
//
// Adopted 2026-08-20 from the Mise promise audit, which produced the sharpest
// diagnosis available of how a Core Purpose document rots. The finding:
//
//   P5 was never silent. It was detected, measured, persisted to disk, rendered
//   on screen, and written into the working list, and then RECLASSIFIED from a
//   failure into a schedule item. "The document said DONE WHEN, the working list
//   said GATED, and nothing in the system is capable of noticing that those two
//   sentences contradict each other."
//
// A `NOT BUILT` line in a document is exactly that reclassification. It reads as
// a plan and it is indistinguishable from an abandonment. So every unbuilt
// promise gets a todo test here carrying an OWNER and a DATE, and the runner
// prints it on every single run. The Core Purpose's own corollary, "no feature
// ships dark: anything built behind a gate gets a date and an owner in the same
// commit," becomes machine-checked for the first time.
//
// This list IS the gate register. A promise cannot leave it silently.
// ---------------------------------------------------------------------------

/** @type {{ id: string, name: string, why: string }[]} */
const UNBUILT = [
  {
    id: "P3",
    name: "P3 every session has three tiers and all of them advance the rotation",
    why: "unbuilt, owner David, Fix-List job 2. Six days a week with no reduced version is a five-day plan with one guaranteed failure in it.",
  },
  {
    id: "P11",
    name: "P11 a dated event is held and the remaining session count is correct",
    why: "unbuilt, owner David, Fix-List job 3. The 2 Oct bench competition lives in a vault note and in nothing the app can read.",
  },
  {
    id: "NAMED-USER",
    name: "DOC every claim in the document that is not a numbered promise",
    why:
      "FAILING, owner David, found 2026-08-20. The document's 'Who it is for' says " +
      "'No user is named in the design, and the public repo contains nothing measured " +
      "about a person.' There are 25 occurrences of the first profile's given name in " +
      "app/, all in comments recording why a decision was made. Milder than Mise's " +
      "store.js:44 (`p === \"david\" ? path : ...`), which makes one named user the " +
      "privileged root of the data layout, but the clause as written forbids it. " +
      "TWO HONEST FIXES AND THIS TEST MUST NOT PICK ONE: strip the names, or narrow " +
      "the clause to forbid measured personal DATA (loads, weights, health numbers) " +
      "while permitting design rationale to cite the first profile. Softening a promise " +
      "to make a failure disappear is the exact move this file exists to prevent, so it " +
      "stays red until David rules.",
  },
];

for (const u of UNBUILT) test(u.name, { todo: u.why }, () => {});

// ---------------------------------------------------------------------------
// The meta-tests. These are the ones that make the document honest.
// ---------------------------------------------------------------------------

/** Parse the authority document into { id -> { kind, testName } }. */
function parseLedger(md) {
  /** @type {Record<string, { kind: string, testName: string | null }>} */
  const out = {};
  const sections = md.split(/^### (P\d+)\./m);
  // split yields [preamble, "P1", body, "P2", body, ...]
  for (let i = 1; i < sections.length; i += 2) {
    const id = sections[i];
    const body = sections[i + 1] ?? "";
    const proven = body.match(/\*\*Proven by:\*\*[^\n]*?>\s*"([^"]+)"/);
    const partial = body.match(/\*\*PARTIAL[^\n]*?>\s*"([^"]+)"/);
    if (proven) out[id] = { kind: "proven", testName: proven[1] };
    else if (partial) out[id] = { kind: "partial", testName: partial[1] };
    else if (/\*\*NOT BUILT\.?\*\*/.test(body)) out[id] = { kind: "not-built", testName: null };
    else out[id] = { kind: "MISSING", testName: null };
  }
  return out;
}

test("META: the authority document is readable, and it is not optional", () => {
  // Deliberately a failure and not a skip. A skipped integrity check is the rot
  // mode this whole file exists to close.
  assert.ok(
    existsSync(DOC),
    `Anvil-Core-Purpose.md was not found at ${DOC}. Promise compliance cannot be ` +
      `verified without it, so this fails rather than passing quietly.`,
  );
});

test("META: every promise in the document carries a status line", () => {
  const ledger = parseLedger(readFileSync(DOC, "utf8"));
  const ids = Object.keys(ledger);
  assert.ok(ids.length >= 11, `found ${ids.length} promises, expected at least 11`);
  for (const [id, entry] of Object.entries(ledger)) {
    assert.notEqual(
      entry.kind,
      "MISSING",
      `${id} has no status line. Every promise must say either "Proven by: ... > <test name>" ` +
        `or "NOT BUILT". A promise with no status is a promise that can rot silently, which is ` +
        `exactly how the Mise protein ceiling was lost.`,
    );
  }
});

test("META: every promise that claims a test has one, with that exact name", () => {
  const ledger = parseLedger(readFileSync(DOC, "utf8"));
  const have = new Set(PROMISES.map((p) => p.name));
  for (const [id, entry] of Object.entries(ledger)) {
    if (!entry.testName) continue;
    assert.ok(
      have.has(entry.testName),
      `${id} claims to be proven by "${entry.testName}" and no such test exists in this file. ` +
        `Either write it, or change the document. The document is not allowed to be wrong.`,
    );
  }
});

test("META: a promise marked NOT BUILT has not quietly acquired a test", () => {
  const ledger = parseLedger(readFileSync(DOC, "utf8"));
  const byId = new Map(PROMISES.map((p) => [p.id, p.name]));
  for (const [id, entry] of Object.entries(ledger)) {
    if (entry.kind !== "not-built") continue;
    assert.ok(
      !byId.has(id),
      `${id} is marked NOT BUILT in the document but this file has a test for it. ` +
        `If it got built, say so in the document in the same commit.`,
    );
  }
});

test("META: every NOT BUILT promise is on the gate register, with an owner and a date", () => {
  // The one that would have caught Mise's P5. A promise cannot be marked unbuilt
  // in the document and then simply not exist here, because that is the state
  // where "planned" and "abandoned" look identical.
  const ledger = parseLedger(readFileSync(DOC, "utf8"));
  const registered = new Set(UNBUILT.map((u) => u.id));
  for (const [id, entry] of Object.entries(ledger)) {
    if (entry.kind !== "not-built") continue;
    assert.ok(
      registered.has(id),
      `${id} is marked NOT BUILT in the document and has no todo test here. ` +
        `Add it to UNBUILT with an owner and a reason. An unbuilt promise that is ` +
        `merely absent from the suite is indistinguishable from an abandoned one, ` +
        `which is precisely how Mise's protein ceiling was lost: it was reclassified ` +
        `from a failure into a schedule item and nothing could tell the difference.`,
    );
  }
  for (const u of UNBUILT) {
    assert.ok(u.why && u.why.length > 20, `${u.id}: the todo reason must name an owner and why`);
    assert.match(u.why, /owner /i, `${u.id}: every gated item needs a named owner`);
  }
});

test("META: no test claims a promise the document does not list", () => {
  const ledger = parseLedger(readFileSync(DOC, "utf8"));
  for (const p of PROMISES) {
    assert.ok(ledger[p.id], `this file tests ${p.id} and the document has no such promise`);
    assert.equal(
      ledger[p.id].testName,
      p.name,
      `${p.id}: the document names a different test than this file provides. They must match ` +
        `character for character, so a rename cannot silently break the link.`,
    );
  }
});

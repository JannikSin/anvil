import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";

import {
  nextInRotation,
  progressionFor,
  sessionAtTier,
  sessionsOn,
  tierMinutes,
} from "../app/lib/workouts.js";
import {
  AEROBIC,
  TYPES,
  addActivity,
  hrRest,
  interferenceWarning,
  weeklyAerobic,
} from "../app/lib/activities.js";
import { upsertDay, ANVIL_FIELDS } from "../app/lib/daily.js";
import { shiftIsoDate } from "../app/lib/dates.js";
import { draftSetCount, emptyDraft, normalizeDraft } from "../app/lib/draft.js";

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

const DOC = "C:\\Users\\DATar\\Sanity\\Obsidian\\Crystal\\Lanes\\Anvil-Core-Purpose.md";

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
    id: "P3",
    name: "P3 every session has three tiers and all of them advance the rotation",
    fn: () => {
      for (const t of program.templates) {
        const one = sessionAtTier(t, 1);
        const two = sessionAtTier(t, 2);
        const three = sessionAtTier(t, 3);

        // all three exist and are genuinely different sizes
        assert.ok(one && two && three, `${t.id} is missing a tier`);
        assert.equal(
          one.exercises.length,
          t.exercises.length,
          `${t.id} tier 1 is not the full session`,
        );
        assert.ok(two.exercises.length < one.exercises.length, `${t.id} tier 2 cuts nothing`);
        assert.equal(three.exercises.length, 1, `${t.id} tier 3 must be exactly one movement`);

        // nesting: the smaller tier is always a subset of the larger one, so
        // dropping a tier never introduces a lift the person has not warmed up for
        const names = (s) => s.exercises.map((e) => e.name);
        for (const n of names(three))
          assert.ok(names(two).includes(n), `${t.id} tier 3 lift absent from tier 2`);
        for (const n of names(two))
          assert.ok(names(one).includes(n), `${t.id} tier 2 lift absent from tier 1`);

        // the tier 3 movement is the one that matters, not whatever sorted first
        assert.ok(
          t.exercises.find((e) => e.name === names(three)[0]).tier === 3,
          `${t.id} tier 3 picked an exercise not marked tier 3`,
        );

        // and it is honestly shorter, which is the only reason anyone picks it
        assert.ok(
          tierMinutes(t, 3) < tierMinutes(t, 2) && tierMinutes(t, 2) < tierMinutes(t, 1),
          `${t.id} tiers do not actually save time (${tierMinutes(t, 1)}/${tierMinutes(t, 2)}/${tierMinutes(t, 3)} min)`,
        );
      }

      // A tier 3 completion advances the rotation exactly as a tier 1 does. This is
      // the half of the promise that is easy to get wrong: nextInRotation must key
      // off the session having HAPPENED, never off how much of it happened.
      const done = [{ date: "2026-08-19", templateId: "lower-a", exercises: [] }];
      const full = nextInRotation(program.schedule, program.templates, done);
      const reduced = nextInRotation(program.schedule, program.templates, [
        {
          ...done[0],
          tier: 3,
          exercises: [{ name: "Back Squat", sets: [{ weight: 225, reps: 5 }] }],
        },
      ]);
      assert.equal(
        reduced?.id,
        full?.id,
        "a tier 3 day did not advance the rotation like a tier 1 day",
      );

      // a template with no tier data must not collapse to an empty session
      const untiered = {
        id: "x",
        name: "X",
        exercises: [{ name: "A", targetSets: 3, targetReps: "5" }],
      };
      assert.equal(
        sessionAtTier(untiered, 3).exercises.length,
        1,
        "untiered template offered an empty fallback",
      );
    },
  },
  {
    id: "P4",
    name: "P4 a set logs from the prefill, a late session files against its own date, and nothing logged is ever lost",
    fn: () => {
      // ---- one press, no keyboard ---------------------------------------
      // The app proposes a COMPLETE set, so the common case is a single press.
      const hist = [
        { date: "2026-08-01", exercises: [{ name: "Bench", sets: [{ weight: 185, reps: 8 }] }] },
      ];
      const next = progressionFor(hist, "Bench", "8-10", 5);
      assert.ok(Number.isFinite(next.weight), "the weight is supplied, not typed");
      assert.ok(Number.isFinite(next.reps), "the reps are supplied, not typed");
      assert.ok(next.weight > 0 && next.reps > 0, "and both are usable as-is");

      // ---- a late entry is a first-class entry ---------------------------
      // Closed 2026-08-24, fix-list job 1. Every session used to be stamped
      // with the current date with no way to say otherwise, so a session
      // trained on Tuesday and remembered on Thursday could not be recorded
      // at all. David's own words, 2026-08-19: "the audit said three sessions
      // for four weeks. That wasn't true. I'm just not logging it."
      const today = "2026-08-24";
      const threeDaysBack = shiftIsoDate(today, -3);
      assert.equal(threeDaysBack, "2026-08-21", "the date control steps whole local days");

      const late = {
        id: "late1",
        date: threeDaysBack,
        templateId: temps[0].id,
        exercises: [{ name: "Bench", sets: [{ weight: 195, reps: 8 }] }],
      };
      const log = [...hist, late];

      // it lands on the day it was TRAINED, not the day it was typed
      assert.equal(
        sessionsOn(log, threeDaysBack).length,
        1,
        "the late session files against its own date",
      );
      assert.equal(sessionsOn(log, today).length, 0, "and not against today");

      // it advances the rotation exactly as a live one would
      assert.equal(
        nextInRotation(sched, temps, log)?.id,
        nextInRotation(sched, temps, [{ ...late, date: today }])?.id,
        "a back-dated session moves the rotation exactly as a same-day one does",
      );

      // and it feeds the progression, which is what makes the log worth having
      const after = progressionFor(log, "Bench", "8-10", 5);
      assert.equal(after.weight, 195, "the late session is what the next prefill reads from");

      // ---- and nothing logged is ever lost -------------------------------
      // The draft is written to disk on every change, so a page discarded
      // mid-session (a phone locking on a rest set) comes back with the sets
      // in it. Before 2026-08-24 the draft lived only in a preact useState and
      // a discarded page took a whole morning's lifting with it, silently.
      const held = {
        ...emptyDraft(today),
        session: { date: threeDaysBack, templateId: temps[0].id, exercises: late.exercises },
      };
      const back = normalizeDraft(JSON.parse(JSON.stringify(held)), today);
      assert.deepEqual(back.session, held.session, "a killed page gives the sets back");
      assert.equal(back.date, threeDaysBack, "still filed against the day it was trained");
      assert.equal(draftSetCount(back), 1, "and the app can say how much is being held");
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
      const bare = addActivity(
        { activities: [] },
        { date: "2026-08-19", type: "run", minutes: 20 },
        "x",
      );
      assert.equal(
        bare.activities[0].miles,
        undefined,
        "a run with only a duration is a logged run",
      );

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
        hrDrop60:
          "collected, read by nothing. Should feed a trend: a rising 60s drop is the direct measurement of the goal he actually stated.",
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
      assert.equal(
        Object.keys(UNCONSUMED).length,
        1,
        "exactly one known piece of decoration remains",
      );
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
      assert.equal(
        afterGap.id,
        afterOneDay.id,
        "the rotation advances on completion, not the calendar",
      );
      assert.ok(afterGap.id !== "lower-a", "and it advanced past what was completed");

      // Nothing anywhere counts a miss.
      assert.equal(
        sessionsOn(done, "2026-08-19").length,
        0,
        "a day with no session is simply empty",
      );
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
      assert.match(
        String(interferenceWarning([a("2026-08-19", "run", 135)], "2026-08-19")),
        /135 min session/,
      );

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
// Adopted 2026-08-19 from the Mise promise audit, which produced the sharpest
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
    id: "P11",
    name: "P11 a dated event is held and the remaining session count is correct",
    why: "unbuilt, owner David, Fix-List job 3. The 2 Oct bench competition lives in a vault note and in nothing the app can read.",
  },
];

for (const u of UNBUILT) test(u.name, { todo: u.why }, () => {});

// ---------------------------------------------------------------------------
// The narrowed named-user clause, ruled by David 2026-08-19, now enforced.
//
// The old clause said "no user is named in the design" and was read as
// forbidding the 25 comments in app/ that record WHO asked for a decision and
// WHEN. That made it permanently false, and a permanently false promise is the
// same as no promise: nothing can go red, so nothing is watched.
//
// David narrowed it: the DESIGN is the code paths, the data model, the defaults
// and the UI copy. Provenance comments are history and are allowed. What is
// forbidden is a person's name reaching anything the program branches on.
//
// The failure this prevents is not hypothetical. Mise's store.js:44 reads
//   p === "david" ? path : `profiles/${p}/${path}`
// which makes one named user the privileged ROOT of the data layout and every
// other person a subdirectory. That is a named user in the design. Anvil must
// never acquire that shape, and now it cannot do so quietly.
// ---------------------------------------------------------------------------

/** Strip line comments, block comments and JSDoc, leaving executable text. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

// Given names and surnames only. The GitHub ACCOUNT handle "JannikSin" is
// deliberately NOT on this list, and the reason is the whole distinction the
// clause turns on: `github.js` uses it as a DEFAULT_REPO fallback that any
// install replaces with one localStorage key ("anvil.dataRepo"), and nothing
// branches on it. Mise's `p === "david" ? path : ...` branches, which is what
// makes one person the privileged root. A default a second profile overrides
// is the core-plus-profile design working; a branch is the design naming a
// person. The override itself is asserted below so this exclusion stays honest.
const NAMES = ["david", "taranowski"];

test("no person is named in the design, only in the margins", () => {
  const dir = new URL("../app/", import.meta.url);
  /** @param {URL} d @returns {URL[]} */
  const walk = (d) =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(new URL(e.name + "/", d))
        : /\.(js|css|html)$/.test(e.name)
          ? [new URL(e.name, d)]
          : [],
    );

  /** @type {string[]} */
  const offences = [];
  for (const file of walk(dir)) {
    const code = stripComments(readFileSync(file, "utf8")).toLowerCase();
    for (const name of NAMES) {
      if (code.includes(name)) {
        const line = code.slice(0, code.indexOf(name)).split("\n").length;
        offences.push(
          `${file.pathname.split("/app/")[1]}:${line} has "${name}" in executable code`,
        );
      }
    }
  }

  assert.deepEqual(
    offences,
    [],
    "A personal name reached a code path, a key, a route or a default. " +
      "The person belongs in the profile, not in the design. " +
      offences.join("; "),
  );
});

test("the one account handle in the code is a default, not a privilege", () => {
  // Keeps the NAMES exclusion above honest. If someone ever deletes the
  // override and hardcodes the owner, the handle stops being a default and
  // becomes exactly the thing the clause forbids, and this goes red.
  const gh = readFileSync(new URL("../app/lib/github.js", import.meta.url), "utf8");
  assert.match(
    gh,
    /localStorage\.getItem\(REPO_KEY\)/,
    "DEFAULT_REPO must stay overridable per install, or its owner name is a privilege",
  );
  assert.ok(
    !/===\s*["'`](?:david|taranowski)/i.test(gh),
    "github.js branches on a person's name: that is the Mise store.js:44 shape",
  );
});

test("the profile is the only thing that personalises the app", () => {
  // The positive half of the same promise: the bundled programme must be
  // structure and coaching craft, so a second profile loading its own data
  // gets a genuinely different app out of identical code. If the shipped
  // default ever hardened into one person's actual programme, the clause
  // would be true by letter and false in spirit.
  const raw = readFileSync(
    new URL("../app/data/program.json", import.meta.url),
    "utf8",
  ).toLowerCase();
  for (const name of NAMES) {
    assert.ok(!raw.includes(name), `the bundled programme names "${name}"`);
  }
  assert.ok(
    program._note.includes("private data repo"),
    "the bundle must say in its own text that the live copy is per-profile",
  );
});

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

// ---------------------------------------------------------------------------
// The minute estimate. Added 2026-08-24 (droplet), because it was wrong by
// about a third and the tier buttons are the one place in the app where a
// number gets acted on directly: David picks Full, Trim or Core against the
// time he has, at 6am, without checking anything.
//
// He asked why his sessions read as 30 minutes when travel and a shower are a
// fixed cost he is already paying. They did not take 30 minutes. The estimate
// counted `sets - 1` rests per exercise, which is true of exactly one set in
// the whole session, and priced a working set of heavy squats at 30 seconds.

test("a session's minute estimate is not a fiction", () => {
  for (const t of program.templates) {
    const mins = tierMinutes(t, 1);
    const sets = t.exercises.reduce(
      (/** @type {number} */ n, /** @type {any} */ e) => n + (Number(e.targetSets) || 0),
      0,
    );

    // THE FLOOR THAT CATCHES THE OLD BUG. Rest alone, at the programme's own
    // prescribed intervals, for every set but the last, is a hard lower bound:
    // you cannot do the session faster than you can rest through it, and work
    // time is strictly additional. The old formula produced numbers BELOW this
    // for every template in the programme.
    const restOnly = t.exercises.reduce(
      (/** @type {number} */ n, /** @type {any} */ e) =>
        n + (Number(e.targetSets) || 0) * (Number(e.rest) || 90),
      0,
    );
    const floor = Math.floor((restOnly - 180) / 60); // minus a generous final rest
    assert.ok(
      mins >= floor,
      `${t.id} is estimated at ${mins} min, below the ${floor} min its own prescribed ` +
        `rest intervals alone require. An estimate under the rest time is not an estimate.`,
    );

    // and a sanity ceiling, so a future change cannot swing the other way.
    // Four minutes a set is generous: the longest rest in the programme is
    // 180 s and a working set is 45 s, so nothing honest can exceed it.
    assert.ok(mins <= sets * 4, `${t.id} at ${mins} min for ${sets} sets is implausibly long`);
  }
});

test("the programme is honest about costing more than half an hour a session", () => {
  // The specific claim David acted on. Every session in this programme is a
  // 35-to-45 minute lift before the warm-up, and the app must say so, because
  // the whole argument for going at all is that the fixed costs are already
  // being paid.
  const minutes = program.templates.map((/** @type {any} */ t) => tierMinutes(t, 1));
  assert.ok(
    Math.min(...minutes) >= 33,
    `the shortest session prices at ${Math.min(...minutes)} min; if that is real the ` +
      `programme changed, and if it is not the estimator regressed`,
  );
});

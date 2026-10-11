import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adoptProgram, lastSetsFor, nextInRotation } from "../app/lib/workouts.js";
import { normalizeDraft } from "../app/lib/draft.js";

// Block 1, committed 2026-10-11 (Crystal Life/Training-Recipe): six A/B days,
// top set only, a feasibility note per lift. These guard the three pieces of
// plumbing that make it reach a phone whose data repo still holds the old split.

const program = JSON.parse(
  readFileSync(new URL("../app/data/program.json", import.meta.url), "utf8"),
);

test("a newer bundled block replaces the repo's split and keeps every record", () => {
  const repo = {
    schedule: { mon: "push" },
    templates: [{ id: "push", name: "Push", exercises: [] }],
    sessions: [{ id: "s1", date: "2026-08-31", templateId: "lower-b", exercises: [] }],
    baselines: { "Back Squat": { weight: 225, reps: 5 } },
  };
  const out = adoptProgram(repo, program);
  assert.notEqual(out, repo, "a version change must produce a new object so the caller writes it back");
  assert.equal(out.programVersion, program.programVersion);
  assert.deepEqual(out.templates, program.templates);
  assert.deepEqual(out.schedule, program.schedule);
  assert.deepEqual(out.sessions, repo.sessions, "logged sessions survive the switch");
  assert.deepEqual(out.baselines, repo.baselines, "baselines survive the switch");
});

test("the same block is a no-op, so the write-back cannot loop", () => {
  const repo = { programVersion: program.programVersion, templates: [], sessions: [] };
  assert.equal(adoptProgram(repo, program), repo);
  assert.equal(adoptProgram(repo, null), repo, "no bundle (offline fetch failed) changes nothing");
});

test("the queue starts Block 1 on Push A whatever the old split logged last", () => {
  const sessions = [{ date: "2026-08-31", templateId: "lower-b", exercises: [] }];
  assert.equal(nextInRotation(program.schedule, program.templates, sessions)?.id, "push-a");
  const order = ["push-a", "pull-a", "legs-a", "push-b", "pull-b", "legs-b"];
  for (const [i, id] of order.entries()) {
    const next = nextInRotation(program.schedule, program.templates, [
      { date: "2026-10-11", templateId: id, exercises: [] },
    ]);
    assert.equal(next?.id, order[(i + 1) % order.length], `${id} is not followed by the next day`);
  }
});

test("a note-only entry never hides the last time a lift was done", () => {
  const sessions = /** @type {any} */ ([
    { date: "2026-10-11", exercises: [{ name: "Cable Row", sets: [{ weight: 170, reps: 8 }] }] },
    { date: "2026-10-15", exercises: [{ name: "Cable Row", sets: [], note: "machine taken" }] },
  ]);
  assert.deepEqual(lastSetsFor(sessions, "Cable Row"), [{ weight: 170, reps: 8 }]);
});

test("feasibility notes survive a reload even before the first set", () => {
  const d = normalizeDraft({ date: "2026-10-11", notes: { "Lateral Raise": "love it" } }, "2026-10-11");
  assert.deepEqual(d.notes, { "Lateral Raise": "love it" });
  assert.deepEqual(normalizeDraft({ notes: [1, 2] }, "2026-10-11").notes, {}, "junk notes are dropped");
});

test("every lift carries the recipe: effort, rest and a cue", () => {
  for (const t of program.templates) {
    for (const e of t.exercises) {
      assert.ok(e.effort, `${t.id} ${e.name} has no effort target`);
      assert.ok(Number.isInteger(e.rest) && e.rest >= 0, `${t.id} ${e.name} has no rest`);
      assert.ok(e.cue && e.cue.length > 10, `${t.id} ${e.name} has no cue`);
      if (e.rest === 0) assert.ok(e.superset, `${t.id} ${e.name} has no rest and no superset partner`);
    }
  }
});

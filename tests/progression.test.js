import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { primaryLifts, progressionFor, repRange } from "../app/lib/workouts.js";

const s = (date, name, weight, reps) => ({
  date,
  templateId: "lower-a",
  exercises: [{ name, sets: [{ weight, reps }] }],
});

test("rep ranges parse, and non-ranges refuse to", () => {
  assert.deepEqual(repRange("5-8"), [5, 8]);
  assert.deepEqual(repRange("8-12"), [8, 12]);
  assert.deepEqual(repRange("10"), [10, 10]);
  assert.deepEqual(repRange("8-10 each"), [8, 10]);
  // the entries in his real programme that are not rep prescriptions at all
  assert.equal(repRange("10 min"), null);
  assert.equal(repRange("max time"), null);
  assert.equal(repRange("superset rounds"), null);
  assert.equal(repRange("ext rotations + face pulls + band pull-aparts"), null);
  assert.equal(repRange(undefined), null);
});

test("under the top of the range, it asks for one more rep", () => {
  const p = progressionFor([s("2026-08-18", "Back Squat", 225, 6)], "Back Squat", "5-8", 10);
  assert.equal(p?.kind, "rep");
  assert.equal(p?.weight, 225);
  assert.equal(p?.reps, 7);
});

test("at the top of the range, it adds load and resets to the bottom", () => {
  const p = progressionFor([s("2026-08-18", "Back Squat", 225, 8)], "Back Squat", "5-8", 10);
  assert.equal(p?.kind, "load");
  assert.equal(p?.weight, 235);
  assert.equal(p?.reps, 5);
  assert.match(p?.label ?? "", /\+10 lb, back to 5/);
});

test("over the top of the range still promotes, it does not stall", () => {
  const p = progressionFor([s("2026-08-18", "Back Squat", 225, 11)], "Back Squat", "5-8", 10);
  assert.equal(p?.kind, "load");
  assert.equal(p?.weight, 235);
});

test("a stall is counted only on identical weight AND reps, most recent first", () => {
  const hist = [
    s("2026-08-01", "Back Squat", 225, 6),
    s("2026-08-08", "Back Squat", 225, 6),
    s("2026-08-15", "Back Squat", 225, 6),
  ];
  assert.equal(progressionFor(hist, "Back Squat", "5-8", 10)?.stalled, 3);

  const broken = [...hist, s("2026-08-18", "Back Squat", 225, 7)];
  assert.equal(progressionFor(broken, "Back Squat", "5-8", 10)?.stalled, 1);
});

test("no history and unreadable prescriptions both return no opinion", () => {
  assert.equal(progressionFor([], "Back Squat", "5-8", 10), null);
  assert.equal(
    progressionFor([s("2026-08-18", "Dead Hang", 0, 30)], "Dead Hang", "max time", 5),
    null,
  );
});

test("bodyweight lifts progress on reps without inventing a load", () => {
  const p = progressionFor([s("2026-08-18", "Chin-up", 0, 8)], "Chin-up", "6-10", 5);
  assert.equal(p?.kind, "rep");
  assert.equal(p?.weight, 0);
  assert.equal(p?.reps, 9);
});

test("THE DEFECT: every charted lift must exist in the real programme", () => {
  // Progress shipped a hard-coded list carried over from Mise. Three of its
  // four names were absent from this programme, so three charts could never
  // plot a point however long he trained, and 132 green tests did not notice.
  const program = JSON.parse(
    readFileSync(new URL("../app/data/program.json", import.meta.url), "utf8"),
  );
  const real = new Set(program.templates.flatMap((t) => t.exercises.map((e) => e.name)));
  for (const name of primaryLifts(program.templates, [])) {
    assert.ok(real.has(name), `"${name}" is charted but is not in the programme`);
  }
});

test("logged lifts outrank the programme's defaults, most-logged first", () => {
  const sessions = [
    s("2026-08-01", "Cable Row", 160, 10),
    s("2026-08-02", "Cable Row", 160, 10),
    s("2026-08-03", "Face Pull", 50, 18),
  ];
  const lifts = primaryLifts([{ exercises: [{ name: "Back Squat" }] }], sessions, 3);
  assert.equal(lifts[0], "Cable Row");
  assert.ok(lifts.includes("Face Pull"));
  assert.ok(lifts.includes("Back Squat"), "falls back to template primaries to fill the slots");
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  lastSetsFor,
  personalRecords,
  seriesFor,
  addSet,
  undoSet,
  padValues,
  formatSets,
  templateForDate,
} from "../app/lib/workouts.js";

const SESSIONS = [
  {
    date: "2026-06-29",
    templateId: "chest-triceps",
    exercises: [{ name: "Bench Press", sets: [{ weight: 150, reps: 5 }] }],
  },
  {
    date: "2026-07-03",
    templateId: "chest-triceps",
    exercises: [
      {
        name: "Bench Press",
        sets: [
          { weight: 155, reps: 5 },
          { weight: 155, reps: 4 },
        ],
      },
      { name: "Dips", sets: [{ weight: 0, reps: 12 }] },
    ],
  },
];

test("lastSetsFor returns the most recent session's sets for a lift", () => {
  assert.deepEqual(lastSetsFor(SESSIONS, "Bench Press"), [
    { weight: 155, reps: 5 },
    { weight: 155, reps: 4 },
  ]);
  assert.equal(lastSetsFor(SESSIONS, "Squat"), null);
});

test("formatSets renders console-style last-time numbers", () => {
  assert.equal(
    formatSets([
      { weight: 155, reps: 5 },
      { weight: 155, reps: 4 },
    ]),
    "155×5 · 155×4",
  );
  assert.equal(formatSets([{ weight: 0, reps: 12 }]), "bw×12");
});

test("personalRecords finds the heaviest set per lift", () => {
  const prs = personalRecords(SESSIONS);
  assert.deepEqual(prs.get("Bench Press"), { weight: 155, reps: 5, date: "2026-07-03" });
  assert.deepEqual(prs.get("Dips"), { weight: 0, reps: 12, date: "2026-07-03" });
});

test("seriesFor returns date-sorted top weight per session for charting", () => {
  assert.deepEqual(seriesFor(SESSIONS, "Bench Press"), [
    { date: "2026-06-29", top: 150 },
    { date: "2026-07-03", top: 155 },
  ]);
  assert.deepEqual(seriesFor(SESSIONS, "Squat"), []);
});

test("addSet appends: straight sets working up in weight all survive", () => {
  let s = { date: "2026-07-06", templateId: "legs", exercises: [] };
  s = addSet(s, "Squat", { weight: 185, reps: 5 });
  s = addSet(s, "Squat", { weight: 195, reps: 3 });
  s = addSet(s, "Leg Press", { weight: 300, reps: 10 });
  assert.equal(s.exercises.length, 2);
  assert.deepEqual(s.exercises[0], {
    name: "Squat",
    sets: [
      { weight: 185, reps: 5 },
      { weight: 195, reps: 3 },
    ],
  });
  assert.deepEqual(s.exercises[1], { name: "Leg Press", sets: [{ weight: 300, reps: 10 }] });
});

test("addSet accepts a set identical to the previous one (the 2026-09-01 report)", () => {
  let s = { date: "2026-09-01", templateId: "push-a", exercises: [] };
  s = addSet(s, "Incline DB Press", { weight: 70, reps: 8 });
  s = addSet(s, "Incline DB Press", { weight: 70, reps: 8 });
  assert.deepEqual(s.exercises[0].sets, [
    { weight: 70, reps: 8 },
    { weight: 70, reps: 8 },
  ]);
});

test("undoSet removes the last set and drops an emptied exercise", () => {
  let s = { date: "2026-07-06", templateId: "legs", exercises: [] };
  s = addSet(s, "Squat", { weight: 185, reps: 5 });
  s = addSet(s, "Squat", { weight: 195, reps: 3 });
  s = addSet(s, "Leg Press", { weight: 300, reps: 10 });
  s = undoSet(s, "Squat");
  assert.deepEqual(s.exercises[0].sets, [{ weight: 185, reps: 5 }]);
  s = undoSet(s, "Leg Press");
  assert.deepEqual(
    s.exercises.map((e) => e.name),
    ["Squat"],
  );
});

test("padValues: what the pad shows is what a press files", () => {
  // typed numbers win
  assert.deepEqual(
    padValues({ w: "75", r: "8" }, undefined, { weight: 70, reps: 9 }, null, undefined),
    { w: "75", r: "8" },
  );
  // nothing typed, nothing logged: the progression seed IS the value, so a
  // bare LOG press files the shown numbers instead of flashing invalid
  assert.deepEqual(padValues(undefined, undefined, { weight: 70, reps: 9 }, null, undefined), {
    w: "70",
    r: "9",
  });
  // mid-session: the set just logged wins over the progression
  assert.deepEqual(
    padValues(undefined, [{ weight: 65, reps: 10 }], { weight: 70, reps: 9 }, null, undefined),
    { w: "65", r: "10" },
  );
  // fresh lift, no progression: last session, then baseline, then blanks
  assert.deepEqual(padValues(undefined, undefined, null, [{ weight: 155, reps: 5 }], undefined), {
    w: "155",
    r: "5",
  });
  assert.deepEqual(padValues(undefined, undefined, null, null, { weight: 160, reps: 10 }), {
    w: "160",
    r: "10",
  });
  assert.deepEqual(padValues(undefined, undefined, null, null, undefined), { w: "", r: "" });
});

const SCHEDULE = {
  mon: "lower-a",
  tue: "pull-a",
  wed: "push-a",
  thu: "pull-b",
  fri: "lower-b",
  sat: "push-b",
  sun: null,
};
const TEMPLATES = [
  { id: "lower-a", name: "Mon: Lower A" },
  { id: "pull-a", name: "Tue: Pull A" },
  { id: "push-a", name: "Wed: Push A" },
  { id: "pull-b", name: "Thu: Pull B" },
  { id: "lower-b", name: "Fri: Lower B" },
  { id: "push-b", name: "Sat: Push B" },
];

test("templateForDate returns the scheduled template for each weekday", () => {
  assert.equal(templateForDate(SCHEDULE, TEMPLATES, "2026-07-06").id, "lower-a"); // mon
  assert.equal(templateForDate(SCHEDULE, TEMPLATES, "2026-07-07").id, "pull-a"); // tue
  assert.equal(templateForDate(SCHEDULE, TEMPLATES, "2026-07-08").id, "push-a"); // wed
  assert.equal(templateForDate(SCHEDULE, TEMPLATES, "2026-07-09").id, "pull-b"); // thu
  assert.equal(templateForDate(SCHEDULE, TEMPLATES, "2026-07-10").id, "lower-b"); // fri
  assert.equal(templateForDate(SCHEDULE, TEMPLATES, "2026-07-11").id, "push-b"); // sat
});

test("templateForDate returns null on the rest day", () => {
  assert.equal(templateForDate(SCHEDULE, TEMPLATES, "2026-07-12"), null); // sun
});

test("templateForDate returns null when schedule is undefined", () => {
  assert.equal(templateForDate(undefined, TEMPLATES, "2026-07-06"), null);
});

test("templateForDate returns null when the schedule names an id absent from templates", () => {
  const badSchedule = { ...SCHEDULE, mon: "not-a-real-id" };
  assert.equal(templateForDate(badSchedule, TEMPLATES, "2026-07-06"), null);
});


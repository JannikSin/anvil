import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { conditioningForDate } from "../app/lib/workouts.js";
import { WEEKLY_MINUTES_MAX, interferenceWarning } from "../app/lib/activities.js";

const program = JSON.parse(
  readFileSync(new URL("../app/data/program.json", import.meta.url), "utf8"),
);
const cond = program.conditioning;

// 2026-08-17 is a Monday, so the week runs mon..sun from there.
const MON = "2026-08-17";
const TUE = "2026-08-18";
const WED = "2026-08-19";
const THU = "2026-08-20";
const FRI = "2026-08-21";
const SAT = "2026-08-22";
const SUN = "2026-08-23";

test("exactly two hard sessions a week, plus the flexible one", () => {
  const hard = [MON, TUE, WED, THU, FRI, SAT, SUN]
    .map((d) => conditioningForDate(cond, d))
    .filter(Boolean);
  assert.equal(hard.length, 3, "three conditioning days: two fixed, one alternating");
  assert.deepEqual(
    hard.map((h) => h.id),
    ["4x4", "10-20-30", "alternating"],
  );
});

test("conditioning never lands on a heavy or technical lower day", () => {
  // The one thing concurrent training genuinely costs is explosive strength,
  // and it is worst same-session with heavy lower work.
  for (const day of [MON, WED]) {
    assert.equal(
      conditioningForDate(cond, day),
      null,
      `${day} is a lower day and must carry no conditioning`,
    );
  }
  assert.equal(conditioningForDate(cond, FRI), null, "Friday stays clear for a missed session");
});

test("every conditioning day has a 20-minute version that is genuinely shorter", () => {
  for (const day of [TUE, THU, SAT]) {
    const full = conditioningForDate(cond, day);
    const short = conditioningForDate(cond, day, true);
    assert.ok(short.reduced, `${day} short version is not flagged reduced`);
    assert.ok(
      short.minutes < full.minutes,
      `${day} fallback saves no time (${full.minutes} -> ${short.minutes})`,
    );
    assert.ok(short.minutes <= 20, `${day} fallback must fit a 20 minute morning`);
    assert.notEqual(short.work, full.work, `${day} fallback prescribes the full session`);
  }
});

test("the prescribed week does not trip the app's own interference guard", () => {
  // A programme the app then warns about is a programme the app does not
  // believe in. The guard exists for the weeks he overreaches, not for the plan.
  const total = [TUE, THU, SAT]
    .map((d) => conditioningForDate(cond, d).minutes)
    .reduce((a, b) => a + b, 0);
  assert.ok(
    total < WEEKLY_MINUTES_MAX,
    `the prescription is ${total} aerobic min against a ${WEEKLY_MINUTES_MAX} min guard`,
  );
  const asLogged = [TUE, THU, SAT].map((date, i) => ({
    id: `c${i}`,
    date,
    type: "run",
    minutes: conditioningForDate(cond, date).minutes,
  }));
  assert.equal(
    interferenceWarning(asLogged, SUN),
    null,
    "the programme as written warns about itself",
  );
});

test("the Apple Watch outdoor rule is stated where it can be read", () => {
  // Cardio Fitness updates only from Outdoor Walk/Run/Hike. A block of hard
  // indoor intervals moves the number not at all, which reads as a stalled
  // programme when the opposite is true. At least one session must say outdoor.
  assert.match(cond.watchRule, /Outdoor Run/);
  const outdoor = [TUE, THU, SAT].filter((d) => conditioningForDate(cond, d).outdoor);
  assert.ok(outdoor.length >= 1, "no session is marked outdoor, so the watch will never update");
});

test("an unknown day and a missing block are both just null, not a crash", () => {
  assert.equal(conditioningForDate(undefined, TUE), null);
  assert.equal(conditioningForDate({}, TUE), null);
  assert.equal(conditioningForDate({ tue: null }, TUE), null);
});

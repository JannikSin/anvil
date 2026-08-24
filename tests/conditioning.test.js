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

test("two easy aerobic sessions a week, plus exactly one hard block", () => {
  // Rebuilt 2026-08-24 to the Training-Rebuild prescription: 120 to 150 min of
  // aerobic work a week, 100 to 120 of it true Zone 2 across 2 to 3 runs, plus
  // ONE 10 to 12 minute interval block. It replaced 4x4 + 10-20-30 + an
  // alternating day, which was three hard sessions against a curve that
  // flattens after two.
  const hard = [MON, TUE, WED, THU, FRI, SAT, SUN]
    .map((d) => conditioningForDate(cond, d))
    .filter(Boolean);
  assert.equal(hard.length, 3, "three conditioning days: two Zone 2, one interval block");
  assert.deepEqual(
    hard.map((h) => h.id),
    ["z2a", "z2b", "int"],
  );
  const intervals = hard.filter((h) => h.id === "int");
  assert.equal(intervals.length, 1, "exactly one hard block, never two");
});

test("every conditioning session says WHEN, because same-session is the cost", () => {
  // The explosive-strength cost of concurrent training is concentrated when
  // cardio and lifting share a session. A prescription that does not say "later
  // in the day" will be done straight after the lift, which is the one
  // arrangement the evidence argues against.
  for (const day of [TUE, FRI, SAT]) {
    const c = conditioningForDate(cond, day);
    assert.ok(c.when, `${day} conditioning does not say when to do it`);
    assert.match(c.when, /later in the day/i, `${day} must be placed away from the lift`);
  }
});

test("conditioning never lands on a heavy or technical lower day", () => {
  // The one thing concurrent training genuinely costs is explosive strength,
  // and it is worst same-session with heavy lower work.
  // The lower days moved to Monday and Thursday with the 2026-08-24 rebuild,
  // so that the plyometric and sprint blocks sit fresh on a lower morning.
  for (const day of [MON, THU]) {
    assert.equal(
      conditioningForDate(cond, day),
      null,
      `${day} is a lower day and must carry no conditioning`,
    );
  }
  assert.equal(conditioningForDate(cond, WED), null, "Wednesday stays clear for a missed session");
  // and the one HARD block must sit at least a day clear of both lower days
  const hardDay = [MON, TUE, WED, THU, FRI, SAT, SUN].find(
    (d) => conditioningForDate(cond, d)?.id === "int",
  );
  assert.equal(hardDay, SAT, "the interval block belongs on Saturday, two days clear of Thursday");
});

test("every conditioning day has a 20-minute version that is genuinely shorter", () => {
  for (const day of [TUE, FRI, SAT]) {
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
  const total = [TUE, FRI, SAT]
    .map((d) => conditioningForDate(cond, d).minutes)
    .reduce((a, b) => a + b, 0);
  assert.ok(
    total < WEEKLY_MINUTES_MAX,
    `the prescription is ${total} aerobic min against a ${WEEKLY_MINUTES_MAX} min guard`,
  );
  const asLogged = [TUE, FRI, SAT].map((date, i) => ({
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
  const outdoor = [TUE, FRI, SAT].filter((d) => conditioningForDate(cond, d).outdoor);
  assert.ok(outdoor.length >= 1, "no session is marked outdoor, so the watch will never update");
});

test("an unknown day and a missing block are both just null, not a crash", () => {
  assert.equal(conditioningForDate(undefined, TUE), null);
  assert.equal(conditioningForDate({}, TUE), null);
  assert.equal(conditioningForDate({ tue: null }, TUE), null);
});

// ---------------------------------------------------------------------------
// Reachability. Added 2026-08-24 (droplet) after finding that every test above
// this line passed for five days while the conditioning programme rendered on
// NO SCREEN AT ALL.
//
// The block was written on 2026-08-19 into program.json. The app shell's
// bundled-programme loader copied `schedule` and `templates` and dropped
// `conditioning`, and the data repo has never carried the key either, so
// `conditioningForDate` was a function with test coverage, real data, and no
// caller anywhere in the app. The tests could not see it because they assert
// against the JSON file rather than against anything the app renders.
//
// This is the same failure shape as the "add a token" warning that went
// unreachable on the same day and was found in the same session: covered by a
// test, invisible to the user. Two in one week is a pattern, so it gets a
// guard rather than a comment.
const MAIN = readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const TODAY_VIEW = readFileSync(new URL("../app/views/today.js", import.meta.url), "utf8");

test("the bundled programme carries conditioning, not just the split", () => {
  const bundle = MAIN.slice(MAIN.indexOf("prog.schedule"), MAIN.indexOf("prog.schedule") + 700);
  for (const key of ["quality", "commute", "restDay"]) {
    assert.match(
      bundle,
      new RegExp(`${key}: prog\\.${key}`),
      `the app shell's bundle drops \`${key}\`, so that half of the rebuilt week ` +
        "reaches no screen on any install that has not synced a data repo, which is every install",
    );
  }
  assert.match(
    bundle,
    /conditioning:\s*prog\.conditioning/,
    "the app shell's programme bundle drops `conditioning`, so the interval sessions " +
      "reach no screen on any install that has not synced a data repo — which is every " +
      "install, because the data repo has never carried the key either",
  );
});

test("a repo sync cannot drop the bundle-only blocks on the floor", () => {
  // workouts.json owns schedule, templates, sessions and baselines. It has
  // never held conditioning, and as of 2026-08-24 it does not hold quality,
  // commute or restDay either. A naive setWorkouts(w) therefore deletes all
  // four the moment the first sync lands, which would make the whole rebuilt
  // week work only until the token started working.
  for (const key of ["conditioning", "quality", "commute", "restDay"]) {
    assert.match(
      MAIN,
      new RegExp(`${key}: repo\\.${key} \\?\\? cur\\.${key}`),
      `a repo sync would drop the bundled \`${key}\` block`,
    );
  }
});

test("some screen actually renders conditioning", () => {
  assert.match(
    TODAY_VIEW,
    /conditioningForDate\(/,
    "conditioningForDate has data and tests and no caller: it is decoration under P7 " +
      "and invisible under P5 until a screen calls it",
  );
});

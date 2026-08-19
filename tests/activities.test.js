import test from "node:test";
import assert from "node:assert/strict";
import { addActivity, hrRest, interferenceWarning, weeklyAerobic } from "../app/lib/activities.js";

const a = (date, type, minutes, extra = {}) => ({ id: date + type, date, type, minutes, ...extra });

test("an activity is appended with its merge id and nothing is mutated", () => {
  const book = { activities: [a("2026-08-18", "run", 30)] };
  const next = addActivity(book, { date: "2026-08-19", type: "tennis", minutes: 90 }, "abcd1234");
  assert.equal(next.activities.length, 2);
  assert.equal(next.activities[1].id, "abcd1234");
  assert.equal(book.activities.length, 1, "the original book is untouched");
});

test("weekly aerobic counts the last 7 days inclusive and nothing older", () => {
  const acts = [
    a("2026-08-12", "run", 99), // 8th day back, outside
    a("2026-08-13", "run", 30), // day 7 of a 7-day inclusive window, INSIDE
    a("2026-08-14", "run", 25),
    a("2026-08-19", "run", 30), // today
  ];
  const w = weeklyAerobic(acts, "2026-08-19");
  assert.equal(w.minutes, 85, "day -6 is inside; day -7 is not");
  assert.equal(w.runs, 3);
});

test("bouldering is training but it is not aerobic minutes", () => {
  // Deliberate: it is intermittent with long rests, and its real training
  // stress is grip and back, which the lifting log has to account for instead.
  const w = weeklyAerobic([a("2026-08-19", "climb", 90)], "2026-08-19");
  assert.equal(w.minutes, 0);
  assert.equal(w.byType.climb, 90);
});

test("tennis, swimming and walking all count toward the aerobic target", () => {
  const w = weeklyAerobic(
    [a("2026-08-19", "tennis", 60), a("2026-08-18", "swim", 20), a("2026-08-17", "walk", 25)],
    "2026-08-19",
  );
  assert.equal(w.minutes, 105);
});

test("THE CORRECTION: a fourth run is NOT a finding, and the old guard said it was", () => {
  // Rewritten 2026-08-19. The previous version of this test asserted that a
  // fourth run in 7 days raised a warning, encoding Wilson 2012's ">3 sessions
  // a week" line. That line is one sentence of practical-applications advice
  // read off a continuous correlation, with no breakpoint analysis behind it,
  // and Schumann 2022 tested 4.1 vs 6.1 weekly concurrent sessions and found
  // nothing. Five short runs is a normal week for someone building toward a
  // half marathon and the app must not call it a problem.
  const five = ["2026-08-15", "2026-08-16", "2026-08-17", "2026-08-18", "2026-08-19"].map((d) =>
    a(d, "run", 30),
  );
  assert.equal(interferenceWarning(five, "2026-08-19"), null, "150 min across 5 runs is the plan");
});

test("the guard fires on the LONGEST SESSION, because duration is the moderator with evidence", () => {
  // Hottenrott 2012: two groups matched at 2.5 h of running a week. Same half
  // marathon time. The long-continuous-run group lost fat-free mass; the
  // short-session group did not. Duration, at matched volume.
  const ok = [a("2026-08-19", "run", 105)];
  assert.equal(interferenceWarning(ok, "2026-08-19"), null, "105 min is inside the long-run cap");

  const over = [a("2026-08-19", "run", 135)];
  assert.match(String(interferenceWarning(over, "2026-08-19")), /135 min session/);
  assert.match(String(interferenceWarning(over, "2026-08-19")), /session length/);
});

test("a long session outranks the weekly total, because it is the sharper signal", () => {
  const both = [a("2026-08-19", "run", 130), a("2026-08-17", "tennis", 120)];
  assert.match(String(interferenceWarning(both, "2026-08-19")), /130 min session/);
});

test("the weekly warning states the CALORIE cost, which is the thing that ends a gain phase", () => {
  // Murphy & Koehler 2022: a ~500 kcal/day deficit abolishes lean-mass gain.
  // A number of minutes means nothing to a person; the food it costs does.
  const heavy = [a("2026-08-19", "tennis", 100), a("2026-08-18", "run", 90)];
  const w = String(interferenceWarning(heavy, "2026-08-19"));
  assert.match(w, /190 aerobic minutes/);
  assert.match(w, /kcal to put back/);
  // 190 min at 600 kcal/h = 1900 kcal. Asserted so a change to the rate is
  // a deliberate edit rather than a silent drift.
  assert.match(w, /1900 kcal/);
});

test("weeklyAerobic reports the longest session, and only aerobic types count toward it", () => {
  const acts = [a("2026-08-19", "run", 40), a("2026-08-18", "climb", 180)];
  const w = weeklyAerobic(acts, "2026-08-19");
  assert.equal(w.longest, 40, "a 3-hour climbing session is not a 3-hour aerobic session");
});

test("a quiet week is silent, because a warning that always fires is noise", () => {
  assert.equal(interferenceWarning([], "2026-08-19"), null);
  assert.equal(interferenceWarning([a("2026-08-19", "run", 30)], "2026-08-19"), null);
});

test("HR rest: the target is 60% of heart rate reserve, not a fixed drop", () => {
  // His numbers: resting 60, max 195. 60 + 0.6*135 = 141.
  const { target } = hrRest(170, 60, 195, 120);
  assert.equal(target, 141);
});

test("HR rest never goes below the exercise's own floor, however fast he recovers", () => {
  // A near-target peak would compute a few seconds. Phosphocreatine does not
  // care about his pulse, so the compound floor wins.
  const r = hrRest(142, 60, 195, 180);
  assert.equal(r.seconds, 180);
  assert.equal(r.capped, "floor");
});

test("HR rest caps at 240s, because failing to recover is itself the data", () => {
  const r = hrRest(194, 60, 195, 120);
  assert.ok(r.seconds <= 240);
});

test("a higher peak asks for more rest than a lower one", () => {
  const hard = hrRest(180, 60, 195, 120).seconds;
  const easy = hrRest(150, 60, 195, 120).seconds;
  assert.ok(hard >= easy, `expected ${hard} >= ${easy}`);
});

test("THE POINT: a fixed 40 bpm drop would under-rest a hard set and over-rest an easy one", () => {
  // From 170, "minus 40" lands at 130, which is BELOW the 141 target: he would
  // have waited longer than the naive rule told him to.
  const { target } = hrRest(170, 60, 195, 120);
  assert.ok(170 - 40 < target, "the naive rule resumes too early after a hard set");
  // From 120, "minus 40" lands at 80, far under target: a long pointless wait.
  assert.ok(120 - 40 < target);
});

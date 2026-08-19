import test from "node:test";
import assert from "node:assert/strict";
import { addActivity, interferenceWarning, weeklyAerobic } from "../app/lib/activities.js";

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

test("the interference guard fires on a fourth run, which is the real threshold", () => {
  const three = ["2026-08-16", "2026-08-17", "2026-08-18"].map((d) => a(d, "run", 25));
  assert.equal(interferenceWarning(three, "2026-08-19"), null);
  const four = [...three, a("2026-08-19", "run", 25)];
  assert.match(String(interferenceWarning(four, "2026-08-19")), /4 runs in 7 days/);
});

test("the guard also fires on total volume, not just run count", () => {
  const heavy = [a("2026-08-19", "tennis", 120), a("2026-08-18", "run", 70)];
  assert.match(String(interferenceWarning(heavy, "2026-08-19")), /190 aerobic minutes/);
});

test("a quiet week is silent, because a warning that always fires is noise", () => {
  assert.equal(interferenceWarning([], "2026-08-19"), null);
  assert.equal(interferenceWarning([a("2026-08-19", "run", 30)], "2026-08-19"), null);
});

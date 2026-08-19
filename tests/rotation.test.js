import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rotationOrder, nextInRotation, sessionsOn } from "../app/lib/workouts.js";

const SCHEDULE = {
  mon: "lower-a",
  tue: "pull-a",
  wed: "push-a",
  thu: "pull-b",
  fri: "lower-b",
  sat: "push-b",
  sun: null,
};
const TEMPLATES = ["lower-a", "pull-a", "push-a", "pull-b", "lower-b", "push-b"].map((id) => ({
  id,
  name: id,
  exercises: [],
}));
const s = (date, templateId) => ({ date, templateId, exercises: [] });

test("the rotation is the weekly order with rest days dropped", () => {
  assert.deepEqual(rotationOrder(SCHEDULE), [
    "lower-a",
    "pull-a",
    "push-a",
    "pull-b",
    "lower-b",
    "push-b",
  ]);
});

test("a duplicated session appears once, in its first position", () => {
  assert.deepEqual(rotationOrder({ mon: "a", tue: "b", wed: "a", thu: null }), ["a", "b"]);
});

test("nothing logged yet starts at the top", () => {
  assert.equal(nextInRotation(SCHEDULE, TEMPLATES, [])?.id, "lower-a");
});

test("the pointer advances one step per completed session", () => {
  assert.equal(nextInRotation(SCHEDULE, TEMPLATES, [s("2026-08-18", "lower-a")])?.id, "pull-a");
  assert.equal(
    nextInRotation(SCHEDULE, TEMPLATES, [s("2026-08-18", "lower-a"), s("2026-08-19", "pull-a")])?.id,
    "push-a",
  );
});

test("THE POINT: a missed week makes the next session later, never skipped", () => {
  // Weekday scheduling deleted Lower A the moment Monday was missed. Here a
  // gap of any length leaves the pointer exactly where it was.
  const sessions = [s("2026-08-01", "lower-a")];
  assert.equal(nextInRotation(SCHEDULE, TEMPLATES, sessions)?.id, "pull-a");
  const afterAMonthOff = [...sessions];
  assert.equal(nextInRotation(SCHEDULE, TEMPLATES, afterAMonthOff)?.id, "pull-a");
});

test("the rotation wraps at the end", () => {
  const all = ["lower-a", "pull-a", "push-a", "pull-b", "lower-b", "push-b"].map((id, i) =>
    s(`2026-08-${String(10 + i).padStart(2, "0")}`, id),
  );
  assert.equal(nextInRotation(SCHEDULE, TEMPLATES, all)?.id, "lower-a");
});

test("a renamed or deleted template restarts rather than stranding the pointer", () => {
  assert.equal(nextInRotation(SCHEDULE, TEMPLATES, [s("2026-08-18", "gone")])?.id, "lower-a");
});

test("no schedule means no rotation", () => {
  assert.equal(nextInRotation(undefined, TEMPLATES, []), null);
});

test("sessionsOn finds today's work", () => {
  const all = [s("2026-08-17", "pull-a"), s("2026-08-18", "push-a")];
  assert.equal(sessionsOn(all, "2026-08-18").length, 1);
  assert.equal(sessionsOn(all, "2026-08-19").length, 0);
});

test("no session name carries a weekday, because the rotation is not a calendar", () => {
  // "Mon: Lower A" under a pointer is a lie the moment he trains on a Tuesday,
  // and it reintroduces exactly the behind-ness the pointer removes.
  const program = JSON.parse(
    readFileSync(new URL("../app/data/program.json", import.meta.url), "utf8"),
  );
  for (const t of program.templates) {
    assert.doesNotMatch(t.name, /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i, `"${t.name}" names a day`);
  }
});

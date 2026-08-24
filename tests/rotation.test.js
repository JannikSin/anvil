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

// ---------------------------------------------------------------------------
// The queue, laid onto dates. David asked to see "my workout today and then
// tuesday and then wednesday", and the honest answer is a queue rather than a
// calendar, because this programme's rotation advances on COMPLETION. These
// tests pin the difference, because the intuitive implementation (index the
// schedule by weekday) is the exact bug the completion pointer removed.
import { upcomingSessions } from "../app/lib/workouts.js";

const MON = "2026-08-24"; // a Monday
const SUN = "2026-08-30";

test("the queue projects the rotation forward, in rotation order", () => {
  const q = upcomingSessions(SCHEDULE, TEMPLATES, [], MON, 6).filter((x) => !x.rest);
  assert.equal(q.length, 6, "six sessions requested, six returned");
  assert.deepEqual(
    q.map((x) => x.template?.id),
    ["lower-a", "pull-a", "push-a", "pull-b", "lower-b", "push-b"],
    "the queue is the rotation in order, starting from what is due now",
  );
});

test("a rest day appears in the queue and does not consume a session slot", () => {
  // Six sessions from a Monday is Mon to Sat and stops before the rest day, so
  // ask for seven: the Sunday has to show up as rest and the seventh session
  // has to land on the Monday after it.
  const all = upcomingSessions(SCHEDULE, TEMPLATES, [], MON, 7);
  const rests = all.filter((x) => x.rest);
  assert.equal(rests.length, 1, "one rest day inside the first seven sessions");
  assert.equal(rests[0].weekday, "sun", "and it is Sunday, where the schedule puts it");
  assert.equal(rests[0].date, "2026-08-30");
  assert.equal(
    all.filter((x) => !x.rest).length,
    7,
    "seven means seven sessions; the rest day is shown, not counted against them",
  );
  const last = all[all.length - 1];
  assert.equal(last.date, "2026-08-31", "the seventh session is the Monday after the rest");
  assert.equal(last.template?.id, "lower-a", "and the rotation has wrapped, as it should");
});

test("a session already filed today pushes the queue to the next training day", () => {
  // P9: today must never render as still owing something already done.
  const done = [{ id: "a", date: MON, templateId: "lower-a", exercises: [] }];
  const q = upcomingSessions(SCHEDULE, TEMPLATES, done, MON, 3).filter((x) => !x.rest);
  assert.equal(q[0].date, "2026-08-25", "the queue starts tomorrow");
  assert.equal(q[0].template?.id, "pull-a", "with the session after the one just filed");
});

test("MISSING A DAY SLIDES THE QUEUE, it never deletes a session", () => {
  // The whole reason this is a queue. On a weekday calendar, a Monday nobody
  // trained means Lower A is simply gone, because Tuesday shows Pull A. Here,
  // asking on Tuesday with nothing logged must still put Lower A first.
  const TUE = "2026-08-25";
  const q = upcomingSessions(SCHEDULE, TEMPLATES, [], TUE, 2).filter((x) => !x.rest);
  assert.equal(q[0].template?.id, "lower-a", "the missed session is next, not skipped");
  assert.equal(q[0].date, TUE, "and it lands on the next day you train");
});

test("the queue starting on a rest day opens with the rest day, then trains", () => {
  const q = upcomingSessions(SCHEDULE, TEMPLATES, [], SUN, 2);
  assert.equal(q[0].rest, true, "Sunday reads as rest rather than as a missing session");
  assert.equal(q[1].date, "2026-08-31", "and the next session is Monday");
});

test("no schedule, no queue, and no crash", () => {
  assert.deepEqual(upcomingSessions(undefined, TEMPLATES, [], MON, 5), []);
  assert.deepEqual(upcomingSessions({ sun: null }, TEMPLATES, [], MON, 5), []);
});

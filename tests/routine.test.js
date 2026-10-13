import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addRoutineItem,
  recorded,
  recordedCount,
  removeRoutineItem,
  routineItems,
  supplementWhen,
  tickPatch,
  starterRoutine,
  minutesOf,
  clockOf,
  nextSundayFrom,
} from "../app/lib/routine.js";
import { upsertDay } from "../app/lib/daily.js";

// A profile shaped like the real targets file, with no person in it.
const TARGETS = {
  tracks: ["weight", "water", "supplements"],
  supplementPlan: [
    { id: "creatine", name: "Creatine", dose: "5g", timing: "anytime" },
    { id: "d3", name: "Vitamin D3", dose: "2,000 IU", timing: "with breakfast" },
    {
      id: "ltheanine",
      name: "L-theanine",
      dose: "200mg",
      timing: "with morning coffee, or solo in the evening",
    },
    { id: "magnesium", name: "Magnesium", dose: "200mg", timing: "30 to 60 min before bed" },
  ],
};

test("supplement timing words decide morning or evening, and a morning meal wins", () => {
  assert.equal(supplementWhen("30 to 60 min before bed"), "evening");
  assert.equal(supplementWhen("with morning coffee, or solo in the evening"), "morning");
  assert.equal(supplementWhen("with breakfast"), "morning");
  assert.equal(supplementWhen(undefined), "morning");
});

test("the card is built from the profile: supplements by their own ids, water when tracked, morning first", () => {
  const items = routineItems(TARGETS, { items: [] });
  assert.deepEqual(
    items.map((i) => `${i.when}:${i.id}`),
    ["morning:creatine", "morning:d3", "morning:ltheanine", "morning:water", "evening:magnesium"],
  );
  assert.equal(items.find((i) => i.id === "creatine")?.field, "supplements");
  assert.equal(items.find((i) => i.id === "water")?.field, "routine");
  assert.deepEqual(
    routineItems(null, null),
    [],
    "no profile, no card: nothing is assumed about a person",
  );
});

test("a tick patches only its own field map, and the shared row keeps every other field", () => {
  const items = routineItems(TARGETS, { items: [] });
  const creatine = /** @type {any} */ (items.find((i) => i.id === "creatine"));
  const d3 = /** @type {any} */ (items.find((i) => i.id === "d3"));
  let daily = { days: [{ date: "2026-10-12", weight: 186, water: 3, dailyDozen: { beans: 1 } }] };
  const day = () => daily.days.find((d) => d.date === "2026-10-12");
  daily = upsertDay(daily, "2026-10-12", tickPatch(day(), creatine, true));
  daily = upsertDay(daily, "2026-10-12", tickPatch(day(), d3, true));
  assert.deepEqual(day()?.supplements, { creatine: true, d3: true });
  assert.equal(day()?.weight, 186, "the check-in's field survives");
  assert.deepEqual(day()?.dailyDozen, { beans: 1 }, "Mise's field survives");
  assert.equal(recordedCount(day(), items), 2);
  daily = upsertDay(daily, "2026-10-12", tickPatch(day(), creatine, false));
  assert.deepEqual(day()?.supplements, { d3: true }, "untick removes only that item");
  assert.equal(recorded(day(), creatine), null);
});

test("a late tick files against its own date (P4: a late entry is first class)", () => {
  const items = routineItems(TARGETS, { items: [] });
  const mg = /** @type {any} */ (items.find((i) => i.id === "magnesium"));
  const daily = upsertDay({ days: [] }, "2026-10-10", tickPatch(null, mg, true));
  assert.deepEqual(daily.days, [{ date: "2026-10-10", supplements: { magnesium: true } }]);
});

test("the person's own items: added from Settings, unique ids, text items record their line", () => {
  let r = addRoutineItem({ items: [] }, { label: "Read 20 min", when: "evening", at: "11:05 pm" });
  r = addRoutineItem(r, { label: "Read 20 min", when: "evening" });
  r = addRoutineItem(r, { label: "Tomorrow's first line", when: "evening", kind: "text" });
  r = addRoutineItem(r, { label: "   " });
  assert.deepEqual(
    r.items.map((i) => i.id),
    ["r-read-20-min", "r-read-20-min-2", "r-tomorrow-s-first-line"],
  );
  const items = routineItems(TARGETS, r);
  const line = /** @type {any} */ (items.find((i) => i.id === "r-tomorrow-s-first-line"));
  assert.equal(line.kind, "text");
  const patch = tickPatch(null, line, "  Email Professor Zeng  ");
  assert.deepEqual(patch, { routine: { "r-tomorrow-s-first-line": "Email Professor Zeng" } });
  assert.equal(recorded({ routine: patch.routine }, line), "Email Professor Zeng");
  assert.deepEqual(
    removeRoutineItem(r, "r-read-20-min-2").items.map((i) => i.id),
    ["r-read-20-min", "r-tomorrow-s-first-line"],
  );
});

test("the starter routine builds the whole spine from three times, in clock order", () => {
  const r = starterRoutine({ wake: "6:35 am", breakfast: "7:45 am", lightsOut: "11:30 pm" });
  assert.ok(r);
  const items = routineItems(TARGETS, r, "2026-10-13");
  const morning = items.filter((i) => i.when === "morning").map((i) => `${i.at ?? "-"} ${i.label}`);
  assert.deepEqual(morning.slice(0, 4), [
    "6:35 am Wake up",
    "6:40 am Weigh in, then the check-in",
    "6:45 am Push-ups and abs, one set",
    "7:45 am Creatine",
  ]);
  assert.ok(morning.includes("7:55 am Shower"));
  const evening = items.filter((i) => i.when === "evening").map((i) => `${i.at ?? "-"} ${i.label}`);
  assert.equal(evening[0], "10:00 pm Last plate, kitchen closed");
  assert.equal(evening[evening.length - 1], "11:30 pm Lights out");
  assert.ok(
    evening.includes("10:45 pm Magnesium"),
    "the evening supplement takes the evening time",
  );
  assert.equal(
    items.find((i) => i.label === "Tomorrow's first line")?.kind,
    "text",
    "the first line is written, not ticked",
  );
  assert.equal(starterRoutine({ wake: "", breakfast: "7:45 am", lightsOut: "11:30 pm" }), null);
});

test("times read in 12-hour and 24-hour forms; a habit queued for Sunday is not on the card before it", () => {
  assert.equal(minutesOf("6:35 am"), 395);
  assert.equal(minutesOf("12:05 am"), 5);
  assert.equal(minutesOf("23:30"), 1410);
  assert.equal(minutesOf("13:00 pm"), null);
  assert.equal(clockOf(1410), "11:30 pm");
  assert.equal(nextSundayFrom("2026-10-13"), "2026-10-18");
  assert.equal(nextSundayFrom("2026-10-18"), "2026-10-25", "on a Sunday, the next one");
  const r = addRoutineItem({ items: [] }, { label: "Mobility, 10 min", from: "2026-10-18" });
  assert.equal(routineItems(null, r, "2026-10-17").length, 0);
  assert.equal(routineItems(null, r, "2026-10-18").length, 1);
});

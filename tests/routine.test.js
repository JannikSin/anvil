import { test } from "node:test";
import assert from "node:assert/strict";
import {
  minutesOf,
  recorded,
  recordedCount,
  routineItems,
  supplementWhen,
  tickPatch,
} from "../app/lib/routine.js";
import { emptyDraft, rollDraft } from "../app/lib/draft.js";
import { readFileSync } from "node:fs";

const PROGRAM = JSON.parse(
  readFileSync(new URL("../app/data/program.json", import.meta.url), "utf8"),
);
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

test("one fixed routine ships with the programme, in clock order, nothing to build", () => {
  // Tuesday 2026-10-13: no mobility (Mon, Wed, Fri only)
  const tue = routineItems(TARGETS, PROGRAM.routine, "2026-10-13");
  const morning = tue.filter((i) => i.when === "morning").map((i) => i.at ?? "-");
  assert.deepEqual(morning.slice(0, 4), ["6:35 am", "6:37 am", "6:40 am", "6:45 am"]);
  assert.ok(
    tue.some((i) => i.id === "creatine" && i.at === "7:45 am"),
    "supplements at breakfast",
  );
  const evening = tue.filter((i) => i.when === "evening");
  assert.equal(evening[0]?.label, "Last plate, kitchen closed");
  assert.equal(evening[evening.length - 1]?.at, "11:30 pm", "lights out ends the day");
  assert.ok(evening.some((i) => i.id === "magnesium" && i.at === "10:45 pm"));
  assert.equal(tue.find((i) => i.id === "r-firstline")?.kind, "text");
  assert.ok(!tue.some((i) => i.id === "r-mobility"), "no mobility on a Tuesday");
  const wed = routineItems(TARGETS, PROGRAM.routine, "2026-10-14");
  assert.ok(
    wed.some((i) => i.id === "r-mobility"),
    "mobility on Wednesday",
  );
  assert.ok(
    !JSON.stringify(PROGRAM.routine).toLowerCase().includes("ashwagandha"),
    "ashwagandha was cut on 2026-08-18",
  );
});

test("times read in 12-hour and 24-hour forms", () => {
  assert.equal(minutesOf("6:35 am"), 395);
  assert.equal(minutesOf("12:05 am"), 5);
  assert.equal(minutesOf("23:30"), 1410);
  assert.equal(minutesOf("13:00 pm"), null);
});

test("today only: a draft from an earlier day is filed under its own date once, or dropped if empty", () => {
  const stale = {
    ...emptyDraft("2026-10-11"),
    session: {
      date: "2026-10-11",
      templateId: "push-a",
      exercises: [{ name: "Incline DB Press", sets: [{ weight: 75, reps: 8 }] }],
    },
  };
  const rolled = rollDraft(stale, "2026-10-13");
  assert.equal(rolled.draft.date, "2026-10-13", "the screen opens on today");
  assert.equal(rolled.file?.date, "2026-10-11", "the lifted sets keep their real date");
  const empty = rollDraft(emptyDraft("2026-10-11"), "2026-10-13");
  assert.equal(empty.file, null, "nothing recorded, nothing filed");
  assert.equal(empty.draft.date, "2026-10-13");
  const live = emptyDraft("2026-10-13");
  assert.equal(rollDraft(live, "2026-10-13").draft, live, "today's draft is left alone");
});

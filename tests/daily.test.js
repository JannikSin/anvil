import test from "node:test";
import assert from "node:assert/strict";
import { upsertDay } from "../app/lib/daily.js";

test("upsertDay patches an existing day without touching others", () => {
  const daily = { days: [{ date: "2026-07-05", sleepHours: 8 }] };
  const next = upsertDay(daily, "2026-07-05", { weight: 180.5 });
  assert.deepEqual(next.days, [{ date: "2026-07-05", sleepHours: 8, weight: 180.5 }]);
  assert.deepEqual(daily.days, [{ date: "2026-07-05", sleepHours: 8 }], "no mutation");
});

test("upsertDay creates the day when absent", () => {
  const next = upsertDay({ days: [] }, "2026-07-06", { pushups: 40 });
  assert.deepEqual(next.days, [{ date: "2026-07-06", pushups: 40 }]);
});


// The rule the whole two-app split rests on. fitness/daily.json lives in
// mise-data and BOTH apps patch the same row: anvil writes sleep, weight and
// pushups, Mise writes water, supplements and dailyDozen. A patch that
// replaced the row instead of merging into it would drop the other app's
// fields on every single write, and the data would rot quietly rather than
// throw.
test("a patch preserves fields the OTHER app owns on the same day", () => {
  const daily = {
    days: [
      {
        date: "2026-08-18",
        water: 3,
        supplements: ["d3", "creatine"],
        dailyDozen: { beans: 2, greens: 1 },
      },
    ],
  };
  const next = upsertDay(daily, "2026-08-18", { weight: 178.4, sleepHours: 7.5 });
  assert.deepEqual(next.days[0], {
    date: "2026-08-18",
    water: 3,
    supplements: ["d3", "creatine"],
    dailyDozen: { beans: 2, greens: 1 },
    weight: 178.4,
    sleepHours: 7.5,
  });
});

test("a patch never touches another day's row", () => {
  const daily = { days: [{ date: "2026-08-17", water: 2 }, { date: "2026-08-18", water: 1 }] };
  const next = upsertDay(daily, "2026-08-18", { pushups: 50 });
  assert.deepEqual(next.days[0], { date: "2026-08-17", water: 2 });
  assert.deepEqual(next.days[1], { date: "2026-08-18", water: 1, pushups: 50 });
});

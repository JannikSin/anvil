import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { supersetLabels } from "../app/lib/workouts.js";

const program = JSON.parse(
  readFileSync(new URL("../app/data/program.json", import.meta.url), "utf8"),
);
const day = (/** @type {string} */ id) =>
  program.templates.find((/** @type {any} */ t) => t.id === id);

test("supersets are lettered pairs with the rule in words, never a bare arrow (2026-10-13)", () => {
  const push = supersetLabels(day("push-a"));
  const lat = push.get("Lateral Raise");
  assert.equal(lat?.code, "A1");
  assert.equal(lat?.partner, "Overhead Triceps Extension");
  assert.equal(push.get("Overhead Triceps Extension")?.code, "A2");
  assert.match(
    lat?.text ?? "",
    /one set of A1 Lateral Raise, then straight into A2 Overhead Triceps Extension, then rest/,
  );
  assert.match(lat?.text ?? "", /A1 has 1 more set: do it alone at the end/);
  const pull = supersetLabels(day("pull-a"));
  assert.deepEqual(
    [...pull.values()].map((v) => v.code).sort(),
    ["A1", "A2", "B1", "B2"],
    "two pairs on Pull A, lettered in order",
  );
});

test("every superset in the programme names a partner that names it back", () => {
  for (const t of program.templates) {
    for (const e of t.exercises) {
      if (!e.superset) continue;
      const back = t.exercises.find((/** @type {any} */ x) => x.name === e.superset);
      assert.equal(
        back?.superset,
        e.name,
        `${t.id}: ${e.name} pairs with ${e.superset}, which does not pair back`,
      );
    }
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { parseRoute } from "../app/lib/router.js";

test("every tab parses to its own view", () => {
  assert.deepEqual(parseRoute("#/today"), { view: "today" });
  assert.deepEqual(parseRoute("#/core"), { view: "core" });
  assert.deepEqual(parseRoute("#/progress"), { view: "progress" });
  assert.deepEqual(parseRoute("#/vitals"), { view: "vitals" });
  assert.deepEqual(parseRoute("#/system"), { view: "system" });
});

test("#/train stays an alias for Today, forever", () => {
  // David used Mise's Train tab for a year. Every bookmark, every home-screen
  // shortcut and every old deep link says #/train, and a dead link there
  // looks exactly like a broken app.
  assert.deepEqual(parseRoute("#/train"), { view: "today" });
});

test("an empty or unknown hash lands on Today rather than nothing", () => {
  assert.deepEqual(parseRoute(""), { view: "today" });
  assert.deepEqual(parseRoute("#/"), { view: "today" });
  assert.deepEqual(parseRoute("#/recipe/tacos"), { view: "today" });
});

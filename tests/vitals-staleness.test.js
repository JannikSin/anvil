import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The Vitals screen must never present a dead feed as a live one.
//
// The file anvil reads today (mise-data health/vitals.json) still holds the
// seven SEED rows written on 2026-07-12..18 to prove the endpoint worked. The
// watch has never posted a real day. A dashboard that renders those numbers
// with no qualifier is not an empty state, it is a false one, and every
// judgement made from it is wrong.
const src = readFileSync(new URL("../app/views/vitals.js", import.meta.url), "utf8");

test("the view computes staleness from the newest row against today", () => {
  assert.match(src, /const newest = days\.length/);
  assert.match(src, /const stale = staleDays !== null && staleDays > 3/);
});

test("a stale feed says NOT LIVE, names the age, and says what to do", () => {
  assert.match(src, /NOT LIVE/);
  assert.match(src, /\$\{staleDays\} days old/);
  assert.match(src, /Health Auto Export/);
});

test("the banner renders before the tiles, not under them", () => {
  const banner = src.indexOf("NOT LIVE");
  const tiles = src.indexOf("${tiles}");
  assert.ok(banner > 0, "banner missing");
  assert.ok(tiles > 0, "tiles missing");
  assert.ok(banner < tiles, "a warning below the numbers is a warning nobody reads");
});

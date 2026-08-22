import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

// Guards on the 2026-08-22 rebuild.
//
// Anvil was split out of a sibling application and inherited its stylesheet
// wholesale. The result was an app that looked like a kitchen: a green accent,
// a card feed, and roughly four hundred lines of CSS for recipes, cook mode,
// food safety, portions and a product tour that this app has never had. These
// tests are cheap, they are source scans, and they are here for one reason:
// the thing they guard is a LOOK, and a look regresses one convenient class
// name at a time with nobody able to point at the commit that did it.
//
// None of these prove a promise. Promise proof lives in promises.test.js and
// has to exercise behaviour; this file only proves the app is still wearing
// its own clothes.

const CSS = readFileSync(new URL("../app/styles.css", import.meta.url), "utf8");
const VIEW_DIR = new URL("../app/views/", import.meta.url);
const VIEWS = readdirSync(VIEW_DIR)
  .filter((f) => f.endsWith(".js"))
  .map((f) => [f, readFileSync(new URL(f, VIEW_DIR), "utf8")]);
const TODAY = readFileSync(new URL("../app/views/today.js", import.meta.url), "utf8");

/** Every colour the sheet mentions, as [r, g, b] with a source label. */
function colours(css) {
  /** @type {{ src: string, rgb: number[] }[]} */
  const out = [];
  for (const m of css.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const h = /** @type {string} */ (m[1]);
    out.push({
      src: `#${h}`,
      rgb: [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)],
    });
  }
  for (const m of css.matchAll(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/g)) {
    out.push({ src: m[0], rgb: [Number(m[1]), Number(m[2]), Number(m[3])] });
  }
  return out;
}

test("nothing in the sheet is green", () => {
  // A colour is green when its green channel leads BOTH of the others by a
  // clear margin. Cyan (#24d3ee) leads red but not blue, so the accent and the
  // live state both pass; the old #3ddc84 signal colour does not.
  const offenders = colours(CSS)
    .filter(({ rgb }) => {
      const [r, g, b] = /** @type {number[]} */ (rgb);
      return g > r + 24 && g > b + 24;
    })
    .map((c) => c.src);
  assert.deepEqual(
    offenders,
    [],
    `Anvil is blue and black by explicit instruction. Green found: ${offenders.join(", ")}`,
  );
});

test("no selector from the sibling app's stylesheet survived the rebuild", () => {
  // Each of these styled a feature Anvil does not have and never will. They are
  // listed by name rather than detected by heuristic so that re-adding one is a
  // deliberate act with a test failure attached.
  const dead = [
    ".cook",
    ".ing ",
    ".foodsafety",
    ".dangerlist",
    ".macros4",
    ".serve-",
    ".portion",
    ".streaktile",
    ".tour-",
    ".scanreview",
    ".tablecard",
    ".tabbar",
    ".checkrow",
    ".slotrow",
    ".statusline",
  ];
  const found = dead.filter((s) => CSS.includes(s));
  assert.deepEqual(found, [], `dead selectors carried over from the kitchen app: ${found}`);
});

test("no view still speaks the kitchen app's class vocabulary", () => {
  // ".food" as a class on a barbell row is the clearest single tell that this
  // markup was copied rather than written.
  const bad = [`class="food"`, `class="q num"`, `class="checkrow`, `class="slots`, `class="hint"`];
  /** @type {string[]} */
  const found = [];
  for (const [name, src] of VIEWS) {
    for (const needle of bad) if (src.includes(needle)) found.push(`${name}: ${needle}`);
  }
  assert.deepEqual(found, [], `views still using the inherited vocabulary: ${found.join("; ")}`);
});

test("the chamfered surfaces layer edge-under-fill, never the reverse", () => {
  // clip-path establishes a stacking context, so a `z-index: -1` pseudo inside
  // a clipped element is clamped to it: it paints ABOVE the element's own
  // background. Putting the fill on the element and the edge on the pseudo
  // therefore floods the whole surface with the edge colour, which is what the
  // first cut of this sheet did to every plate, rack, lift and dialog. The
  // fill goes on the pseudo, inset by a pixel, and `inset: -1px` is the shape
  // of the bug.
  assert.ok(
    !/inset:\s*-1px/.test(CSS),
    "a negative-inset pseudo behind a clip-path surface paints over the fill, not behind it",
  );
});

test("the session screen offers all three tiers as one control (P3's UI half)", () => {
  // The promise says choosing a tier is "a single control on the session
  // screen". The data model has had three tiers since 2026-08-19 and the screen
  // had no way to pick one, so the promise was half built and read as done.
  assert.match(TODAY, /sessionAtTier/, "the session must be resolvable at a tier");
  assert.match(TODAY, /tierMinutes/, "each tier must be priced in minutes, not named by number");
  assert.match(TODAY, /class="tierpad"/, "the three tiers must be one control, not a menu");
  // the type annotation on the table also reads "tier: 1 | 2 | 3", so match the
  // table rows themselves rather than every occurrence of the word
  const tiers = [...TODAY.matchAll(/\{\s*tier:\s*([123]),\s*name:/g)].map((m) => m[1]);
  assert.deepEqual(tiers, ["1", "2", "3"], "all three tiers must be offered, in order");
});

test("no tier is styled or worded as a lesser day", () => {
  // P3: a tier 3 day is a completed day, and the app is never allowed to render
  // a reduced session as a failure. The colour rules are the enforcement: the
  // tier control may not use the caution or breach colours at all.
  const pad = CSS.slice(CSS.indexOf(".tierpad"), CSS.indexOf(".lifts"));
  assert.ok(pad.length > 200, "the tier control's styles moved; this guard needs updating");
  for (const banned of ["--ember", "--breach"]) {
    assert.ok(
      !pad.includes(banned),
      `the tier control uses ${banned}: a lower tier is not a fault`,
    );
  }
});

test("the figures actually move", () => {
  // The keyframes for the stick figures shipped in the old sheet and were never
  // attached to a selector, so every figure in the app stood still for the life
  // of it. A keyframe nothing references is indistinguishable from a keyframe
  // that works, which is why this is a test and not a comment.
  const frames = [...CSS.matchAll(/@keyframes\s+(fig-[\w-]+)/g)].map((m) => m[1]);
  assert.ok(frames.length >= 6, "the figure keyframes are missing");
  for (const f of frames) {
    assert.match(
      CSS,
      new RegExp(`animation:\\s*${f}\\b`),
      `@keyframes ${f} is declared and never used, so that figure does not move`,
    );
  }
});

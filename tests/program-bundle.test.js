import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// app/data/program.json is the split, bundled into the shell so anvil works on
// first open with no token and no network. It ships in a PUBLIC repo, so it
// carries structure and coaching craft and never a number, a body detail, or a
// second-person fact about David. The loads live in the private data repo.

const program = JSON.parse(
  readFileSync(new URL("../app/data/program.json", import.meta.url), "utf8"),
);
const raw = readFileSync(new URL("../app/data/program.json", import.meta.url), "utf8");
const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const main = readFileSync(new URL("../app/main.js", import.meta.url), "utf8");

test("the bundled programme is the real split, not a stub", () => {
  assert.equal(program.templates.length, 6);
  assert.ok(program.schedule, "no weekly schedule");
  // The floor moved 2026-08-24 with the rebuilt week, which deliberately cut
  // five exercises (85 weekly working sets down to 72) to buy room for the
  // pre-lift quality work. The guard is a STUB detector, not a volume
  // prescription, so it checks that every session is a real session rather
  // than pinning a total that a legitimate programme change has to fight.
  const lifts = program.templates.map((t) => t.exercises.length);
  assert.ok(
    Math.min(...lifts) >= 4,
    `a session with ${Math.min(...lifts)} exercises is a stub, not a session`,
  );
  assert.ok(
    lifts.reduce((a, b) => a + b, 0) >= 24,
    "the bundle has collapsed to a stub that will mislead on first open",
  );
  const sets = program.templates.map((t) =>
    t.exercises.reduce((n, e) => n + (Number(e.targetSets) || 0), 0),
  );
  for (const [i, n] of sets.entries()) {
    assert.ok(
      n >= 10 && n <= 16,
      `${program.templates[i].id} has ${n} working sets, outside the 11 to 13 band the ` +
        "rebuilt week prescribes (10 to 16 allowed, so a deliberate tweak is not a build break)",
    );
  }
  for (const t of program.templates) {
    assert.ok(t.id && t.name, "every template needs an id and a name");
    for (const e of t.exercises) assert.ok(e.name && e.targetSets && e.targetReps);
  }
});

test("no personal data rides along into the public repo", () => {
  const blob = raw.toLowerCase();
  // second-person facts and body details that were in the private copy
  for (const leak of ["you max", "your 70s", "your arm gap", "your heaviest", "tennis shoulder"]) {
    assert.ok(!blob.includes(leak), `bundled programme leaks "${leak}"`);
  }
  // no loads, anywhere: those are measurements of a person
  assert.ok(!("baselines" in program), "baselines are body data and belong in the private repo");
  for (const t of program.templates) {
    for (const e of t.exercises) {
      assert.ok(!("weight" in e), `${e.name} carries a load`);
      assert.ok(!("baseline" in e), `${e.name} carries a baseline`);
    }
  }
});

test("the bundle is precached, or it fails exactly when it is needed", () => {
  // Offline, on a phone, in a gym basement is the moment this file matters.
  assert.ok(sw.includes('"./app/data/program.json"'), "program.json missing from the SHELL list");
});

test("the repo copy overrides the bundle, and never eats logged sessions", () => {
  assert.match(main, /cur\.schedule === undefined && cur\.templates\.length === 0/);
});

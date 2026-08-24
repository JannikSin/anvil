import test from "node:test";
import assert from "node:assert/strict";

// The draft module reads and writes localStorage, which Node does not have.
// Stub it BEFORE importing, because readDraft/writeDraft resolve the global at
// call time but the module-level KEY constant does not care either way.
/** @type {Map<string, string>} */
const store = new Map();
globalThis.localStorage = /** @type {any} */ ({
  getItem: (/** @type {string} */ k) => (store.has(k) ? store.get(k) : null),
  setItem: (/** @type {string} */ k, /** @type {string} */ v) => store.set(k, String(v)),
  removeItem: (/** @type {string} */ k) => store.delete(k),
});

const {
  clearDraft,
  draftHasWork,
  draftSetCount,
  emptyDraft,
  normalizeDraft,
  readDraft,
  writeDraft,
} = await import("../app/lib/draft.js");

/**
 * WHY THIS FILE EXISTS.
 *
 * Until 2026-08-24 the in-progress session lived in a preact useState and
 * nowhere else. Every set David logged during a workout existed only in the
 * memory of one page, so a phone that backgrounded the PWA long enough for iOS
 * to discard it threw the whole session away silently. He lost a full morning
 * of lifting to this and reported it as "it doesn't seem to save my data".
 *
 * These tests are the guard on the fix. They are cheap and they are boring and
 * the thing they protect is the only thing in the app that cannot be
 * reconstructed: work that has already been done.
 */

test("a draft written survives being read back, sets and all", () => {
  store.clear();
  const d = {
    ...emptyDraft("2026-08-24"),
    templateId: "pull-a",
    tier: /** @type {2} */ (2),
    session: {
      date: "2026-08-24",
      templateId: "pull-a",
      exercises: [
        { name: "Cable Row", sets: [{ weight: 160, reps: 10 }] },
        { name: "Lat Pulldown", sets: [{ weight: 120, reps: 12 }] },
      ],
    },
    inputs: { "Cable Row": { w: "160", r: "10" } },
  };
  writeDraft(d);
  const back = readDraft("2026-08-25");
  assert.deepEqual(back.session, d.session, "the logged sets come back byte for byte");
  assert.equal(back.templateId, "pull-a");
  assert.equal(back.tier, 2, "the tier comes back too: it decides what is on the bar");
  assert.deepEqual(back.inputs, d.inputs, "the half-typed keypad comes back as well");
});

test("the session's own date wins over the fallback, so a session never moves days by itself", () => {
  store.clear();
  writeDraft({
    ...emptyDraft("2026-08-22"),
    session: { date: "2026-08-22", templateId: "lower-a", exercises: [] },
  });
  // opened the next morning: the fallback is the new today, and it must not win
  assert.equal(readDraft("2026-08-24").date, "2026-08-22");
});

test("a corrupt or absent draft opens the app instead of breaking it", () => {
  store.clear();
  assert.deepEqual(readDraft("2026-08-24"), emptyDraft("2026-08-24"), "nothing stored is fine");

  store.set("anvil.draft", "{not json");
  assert.deepEqual(readDraft("2026-08-24"), emptyDraft("2026-08-24"), "bad JSON is fine");

  store.set("anvil.draft", JSON.stringify({ session: { exercises: "nope" }, tier: 9 }));
  const d = readDraft("2026-08-24");
  assert.equal(d.session, null, "a session that is not shaped like one is dropped, not thrown");
  assert.equal(d.tier, 1, "an impossible tier falls back to the full session");
});

test("storage being unavailable degrades to in-memory rather than crashing", () => {
  const real = globalThis.localStorage;
  globalThis.localStorage = /** @type {any} */ ({
    getItem: () => {
      throw new Error("storage disabled");
    },
    setItem: () => {
      throw new Error("storage disabled");
    },
    removeItem: () => {
      throw new Error("storage disabled");
    },
  });
  assert.deepEqual(readDraft("2026-08-24"), emptyDraft("2026-08-24"));
  assert.doesNotThrow(() => writeDraft(emptyDraft("2026-08-24")));
  assert.doesNotThrow(() => clearDraft());
  globalThis.localStorage = real;
});

test("only logged sets count as work, never a half-typed keypad", () => {
  // The recovery banner is gated on this. If typed-but-unlogged numbers counted,
  // tapping a stepper once and closing the app would raise "unfiled session"
  // over nothing at all, and a banner that cries wolf is a banner he stops
  // reading — which is exactly the failure mode that lost the NO TOKEN warning.
  const typing = { ...emptyDraft("2026-08-24"), inputs: { Bench: { w: "185", r: "8" } } };
  assert.equal(draftHasWork(typing), false);
  assert.equal(draftSetCount(typing), 0);

  const logged = {
    ...emptyDraft("2026-08-24"),
    session: {
      date: "2026-08-24",
      exercises: [
        { name: "Bench", sets: [{ weight: 185, reps: 8 }] },
        { name: "Row", sets: [{ weight: 160, reps: 10 }] },
      ],
    },
  };
  assert.equal(draftHasWork(logged), true);
  assert.equal(draftSetCount(logged), 2);
  assert.equal(draftHasWork(null), false, "no draft is not work");
});

test("clearing removes it, so a filed session cannot come back as an unfiled one", () => {
  store.clear();
  writeDraft({
    ...emptyDraft("2026-08-24"),
    session: { date: "2026-08-24", exercises: [{ name: "Bench", sets: [{ weight: 1, reps: 1 }] }] },
  });
  clearDraft();
  assert.equal(draftHasWork(readDraft("2026-08-24")), false);
});

test("the storage key is anvil-prefixed, because six PWAs share this origin", () => {
  store.clear();
  writeDraft(emptyDraft("2026-08-24"));
  assert.deepEqual([...store.keys()], ["anvil.draft"]);
});

test("normalizeDraft never returns a shape the view has to guard against", () => {
  for (const raw of [null, undefined, 7, "x", [], { tier: "2" }]) {
    const d = normalizeDraft(raw, "2026-08-24");
    assert.equal(typeof d.date, "string");
    assert.ok([1, 2, 3].includes(d.tier));
    assert.ok(d.session === null || Array.isArray(d.session.exercises));
    assert.equal(typeof d.inputs, "object");
  }
});

test("a filed session's keypad cannot survive into the next session (P2 regression)", () => {
  // THE BUG THIS PINS, found by browser audit on 2026-08-24 and introduced by
  // draft persistence earlier the same day.
  //
  // `inputs` is the keypad: typed but not yet logged. Before the draft was
  // persisted it died with the page, so it could not outlive its session. Once
  // it survived, a value left over from a FILED session was still on disk for
  // the next one, and the view reads `inputs[name] ?? seed`, so the stale
  // number silently beat the progression the app had just computed.
  //
  // Observed live: Back Squat logged at 60x8, the top of a 5-8 range, must
  // propose 70x5 and "+10 lb, back to 5". It proposed 60x9, which is not even
  // inside the prescription, and the reason line fell back to "your call". That
  // is precisely the anti-progression default the double-progression work
  // existed to remove, returning through a door that did not exist that
  // morning.
  //
  // The invariant, and it is one line: NO SESSION, NO KEYPAD.
  store.clear();
  store.set(
    "anvil.draft",
    JSON.stringify({
      date: "2026-08-24",
      templateId: null,
      tier: 1,
      session: null,
      inputs: { "Back Squat": { w: "60", r: "9" } },
    }),
  );
  const back = readDraft("2026-08-24");
  assert.deepEqual(
    back.inputs,
    {},
    "keypad values outlived the session they belonged to, so the next session's " +
      "prefill will be a stale number instead of the computed progression",
  );

  // and the same rule applied directly, because normalizeDraft is the one door
  assert.deepEqual(
    normalizeDraft({ session: null, inputs: { Bench: { w: "1", r: "1" } } }, "2026-08-24").inputs,
    {},
  );
  // while a LIVE session keeps its keypad, because that is the whole point of
  // persisting the draft in the first place
  assert.deepEqual(
    normalizeDraft(
      {
        session: { date: "2026-08-24", exercises: [{ name: "Bench", sets: [] }] },
        inputs: { Bench: { w: "185", r: "8" } },
      },
      "2026-08-24",
    ).inputs,
    { Bench: { w: "185", r: "8" } },
    "a half-typed number during a live session must still survive a killed page",
  );
});

// The in-progress session, on disk.
//
// WHY THIS FILE EXISTS, and it is the worst defect this app has shipped:
// until 2026-08-24 the draft session lived in a preact useState and NOWHERE
// ELSE. Sets logged during a workout existed only in the memory of one page.
// A phone that backgrounds a PWA long enough for iOS to discard the page — a
// phone call, a locked screen on a rest set, switching to the music app —
// threw the entire session away with no error, no trace and nothing to
// re-enter it from. David lost a full morning's lifting to this on
// 2026-08-24 and reported it as "it doesn't seem to save my data".
//
// P4 is the keystone promise: logging must cost less than skipping it. An app
// that can silently delete a logged set costs infinitely more than skipping,
// because the person pays the logging tax AND loses the record.
//
// localStorage, not IndexedDB, on purpose: it is SYNCHRONOUS, so a write
// completes before the page can be killed. An IndexedDB transaction opened in
// the last moments of a discarded page is exactly the write that does not
// land. The draft is small (one session), local to the device, and never
// synced — a half-finished session is not a record, it is a scratchpad.
//
// The key is "anvil." prefixed. Every one of David's PWAs shares the origin
// janniksin.github.io and localStorage is scoped per ORIGIN, not per path.

const KEY = "anvil.draft";

/**
 * @typedef {{
 *   date: string,
 *   templateId: string | null,
 *   tier: 1 | 2 | 3,
 *   session: Record<string, any> | null,
 *   inputs: Record<string, { w: string, r: string }>
 * }} Draft
 */

/**
 * A draft with nothing in it: the state the app opens in.
 * @param {string} date today, as YYYY-MM-DD
 * @returns {Draft}
 */
export function emptyDraft(date) {
  return { date, templateId: null, tier: 1, session: null, inputs: {} };
}

/**
 * Does this draft hold anything a person would be upset to lose? Typed-but-
 * unlogged numbers in `inputs` do NOT count: they are a keypad state, not a
 * record, and treating them as unfiled work would show a recovery banner to
 * anyone who tapped a stepper once.
 * @param {Draft | null | undefined} d
 * @returns {boolean}
 */
export function draftHasWork(d) {
  return Boolean(
    d && d.session && Array.isArray(d.session.exercises) && d.session.exercises.length,
  );
}

/**
 * Number of sets in a draft, for the recovery banner's count.
 * @param {Draft | null | undefined} d
 * @returns {number}
 */
export function draftSetCount(d) {
  if (!draftHasWork(d)) return 0;
  return /** @type {any[]} */ (d?.session?.exercises ?? []).reduce(
    (/** @type {number} */ n, /** @type {any} */ e) => n + (e.sets?.length ?? 0),
    0,
  );
}

/**
 * Coerce anything read off disk into a Draft. A malformed record must never
 * throw on startup: the app has to open, and a lost draft is survivable where
 * a white screen is not.
 * @param {unknown} raw
 * @param {string} fallbackDate
 * @returns {Draft}
 */
export function normalizeDraft(raw, fallbackDate) {
  const base = emptyDraft(fallbackDate);
  if (!raw || typeof raw !== "object") return base;
  const d = /** @type {Record<string, any>} */ (raw);
  const tier = d.tier === 2 || d.tier === 3 ? d.tier : 1;
  const session =
    d.session && typeof d.session === "object" && Array.isArray(d.session.exercises)
      ? d.session
      : null;
  return {
    // INPUTS ONLY MEAN SOMETHING WHILE A SESSION IS IN PROGRESS, and this line
    // is a bug fix, found by audit on 2026-08-24 and introduced by this very
    // file earlier the same day.
    //
    // `inputs` is the keypad state: what is typed into the weight and rep
    // boxes but not yet logged. Before the draft persisted, it died with the
    // page, so it could never outlive the session it belonged to. Now that it
    // survives, a value left in the pad from a FILED session was still there
    // on the next one, and because the view reads `inputs[name] ?? seed`, that
    // stale number silently overrode the progression the app had just
    // computed. Observed live: Back Squat logged at 60x8 (the top of a 5-8
    // range) should propose 70x5 and "+10 lb, back to 5"; it proposed 60x9
    // instead, which is not even inside the prescription.
    //
    // That is the exact anti-progression default the double-progression work
    // existed to remove, coming back through a door that did not exist until
    // this morning. So: no session, no keypad.
    // the session's own date wins: it is the one the sets were filed against
    date:
      typeof session?.date === "string"
        ? session.date
        : typeof d.date === "string"
          ? d.date
          : fallbackDate,
    templateId: typeof d.templateId === "string" ? d.templateId : null,
    tier,
    session,
    inputs: session && d.inputs && typeof d.inputs === "object" ? d.inputs : {},
  };
}

/**
 * @param {string} fallbackDate today, used when the stored draft has no date
 * @returns {Draft}
 */
export function readDraft(fallbackDate) {
  try {
    const raw = localStorage.getItem(KEY);
    return normalizeDraft(raw ? JSON.parse(raw) : null, fallbackDate);
  } catch {
    return emptyDraft(fallbackDate); // storage disabled or corrupt JSON
  }
}

/**
 * Persist the draft. Called on EVERY change, including every keystroke in the
 * set pad, because the whole point is that the last thing typed survives.
 * @param {Draft} d
 * @returns {void}
 */
export function writeDraft(d) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // private mode, quota, storage off: the app keeps working in memory and
    // the session is only as durable as the page, which is where it started
  }
}

/** @returns {void} */
export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear if storage never worked
  }
}

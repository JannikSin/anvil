// Lifting data operations: today's session from the fixed rotation,
// last-time numbers beside each lift, PRs, and the progression series the
// SVG sparklines draw. Ported from mise app/lib/fitness.js on 2026-08-18;
// the calorie and allergen half of that file stayed in Mise as targets.js.
import { parseLocalIso } from "./dates.js";

/**
 * @typedef {{ weight: number, reps: number }} SetEntry
 * @typedef {{ name: string, sets: SetEntry[] }} SessionExercise
 * @typedef {{ date: string, templateId?: string, exercises: SessionExercise[], notes?: string }} Session
 */

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Today's session from the fixed weekly rotation (Phase 8: zero-guesswork
 * Train — David never picks a split, the schedule already knows). Null on a
 * rest day, when there's no schedule yet, or when the scheduled id doesn't
 * match any template.
 * @param {Record<string, string | null> | undefined} schedule
 * @param {Record<string, any>[]} templates
 * @param {string} dateIso
 * @returns {Record<string, any> | null}
 */
export function templateForDate(schedule, templates, dateIso) {
  if (!schedule) return null;
  const weekday = WEEKDAY_KEYS[parseLocalIso(dateIso).getDay()] ?? "sun";
  const templateId = schedule[weekday];
  if (!templateId) return null;
  return templates.find((t) => t.id === templateId) ?? null;
}

/**
 * Most recent session's sets for a lift (the progressive-overload anchor).
 * @param {Session[]} sessions
 * @param {string} exercise
 * @returns {SetEntry[] | null}
 */
export function lastSetsFor(sessions, exercise) {
  const withLift = sessions
    .filter((s) => s.exercises.some((e) => e.name === exercise))
    .sort((a, b) => b.date.localeCompare(a.date));
  const latest = withLift[0];
  if (!latest) return null;
  const ex = latest.exercises.find((e) => e.name === exercise);
  return ex && ex.sets.length ? ex.sets : null;
}

/**
 * Console-style set summary: "155×5 · 155×4"; bodyweight sets read "bw×12".
 * @param {SetEntry[]} sets
 * @returns {string}
 */
export function formatSets(sets) {
  return sets.map((s) => `${s.weight > 0 ? s.weight : "bw"}×${s.reps}`).join(" · ");
}

/**
 * Heaviest set ever per lift (ties: earliest kept — first to reach it).
 * @param {Session[]} sessions
 * @returns {Map<string, { weight: number, reps: number, date: string }>}
 */
export function personalRecords(sessions) {
  /** @type {Map<string, { weight: number, reps: number, date: string }>} */
  const prs = new Map();
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        const cur = prs.get(ex.name);
        const better =
          !cur || set.weight > cur.weight || (set.weight === cur.weight && set.reps > cur.reps);
        if (better) prs.set(ex.name, { weight: set.weight, reps: set.reps, date: s.date });
      }
    }
  }
  return prs;
}

/**
 * Date-sorted top weight per session for one lift — chart-ready.
 * @param {Session[]} sessions
 * @param {string} exercise
 * @returns {{ date: string, top: number }[]}
 */
export function seriesFor(sessions, exercise) {
  return [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((s) => {
      const ex = s.exercises.find((e) => e.name === exercise);
      if (!ex || !ex.sets.length) return [];
      return [{ date: s.date, top: Math.max(...ex.sets.map((x) => x.weight)) }];
    });
}

/**
 * Set (or replace) the single top-set result for one exercise in an
 * in-progress session: the simplified logging flow logs once per lift,
 * not once per set. Pure.
 * @param {Session} session
 * @param {string} exercise
 * @param {SetEntry} set
 * @returns {Session}
 */
export function setTopSet(session, exercise, set) {
  const existing = session.exercises.find((e) => e.name === exercise);
  return {
    ...session,
    exercises: existing
      ? session.exercises.map((e) => (e.name === exercise ? { ...e, sets: [set] } : e))
      : [...session.exercises, { name: exercise, sets: [set] }],
  };
}

const WEEKDAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * The rotation, in order, derived from the weekly schedule. Duplicates
 * collapse and rest days drop out, so mon..sun becomes the plain sequence of
 * sessions the programme cycles through.
 * @param {Record<string, string | null> | undefined} schedule
 * @returns {string[]}
 */
export function rotationOrder(schedule) {
  if (!schedule) return [];
  /** @type {string[]} */
  const out = [];
  for (const day of WEEKDAY_ORDER) {
    const id = schedule[day];
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * The next session to do, by POSITION in the rotation rather than by weekday.
 *
 * The weekday version punished a timetable: miss Monday and Lower A was simply
 * gone, because Tuesday showed Pull A. A pointer that advances only on a
 * completed session means a missed day makes the next session later, never
 * skipped, which is the only version that survives a semester schedule nobody
 * has seen yet. It also removes every "you are behind" signal from the app,
 * because being behind stops being representable.
 *
 * @param {Record<string, string | null> | undefined} schedule
 * @param {Record<string, any>[]} templates
 * @param {Record<string, any>[]} sessions
 * @returns {Record<string, any> | null}
 */
export function nextInRotation(schedule, templates, sessions) {
  const order = rotationOrder(schedule);
  if (!order.length) return null;
  const logged = [...(sessions ?? [])]
    .filter((s) => s && s.templateId)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const last = logged.length ? String(logged[logged.length - 1]?.templateId) : null;
  const at = last ? order.indexOf(last) : -1;
  // an unknown last id (a template that was renamed or removed) restarts the
  // cycle rather than throwing the pointer away
  const nextId = at === -1 ? order[0] : order[(at + 1) % order.length];
  return templates.find((t) => t.id === nextId) ?? null;
}

/**
 * Sessions logged on a given local date.
 * @param {Record<string, any>[]} sessions
 * @param {string} dateIso
 */
export function sessionsOn(sessions, dateIso) {
  return (sessions ?? []).filter((s) => s && s.date === dateIso);
}

/**
 * Parse a target rep range into [low, high]. Returns null for the entries that
 * are not rep ranges at all ("10 min", "max time", "superset rounds", "ext
 * rotations + face pulls"), because a progression rule must refuse to fire on
 * a prescription it cannot read rather than invent one.
 * @param {unknown} targetReps
 * @returns {[number, number] | null}
 */
export function repRange(targetReps) {
  const raw = String(targetReps ?? "").trim();
  if (/min|max|round|circuit|superset/i.test(raw)) return null;
  const m = raw.match(/^(\d+)\s*-\s*(\d+)/);
  if (m) {
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    return lo > 0 && hi >= lo ? [lo, hi] : null;
  }
  const one = raw.match(/^(\d+)/);
  if (one) {
    const n = Number(one[1]);
    return n > 0 ? [n, n] : null;
  }
  return null;
}

/**
 * DOUBLE PROGRESSION, the rule David's own corpus states operationally:
 * add reps toward the top of the range, and once the top is hit, add weight and
 * drop back to the bottom.
 *
 * This exists because the app was shipping a button that read "LOG · SAME AS
 * LAST" — prefilling last session's numbers and inviting him to repeat them
 * forever. The same corpus that built the warm-ups says in plain words that a
 * stimulus applied unchanged stops producing adaptation. The prefill was an
 * anti-progression default with a green button on it.
 *
 * Returns null when it cannot see a last set, or when the prescription is not a
 * rep range. Null means "no opinion", and the caller falls back to the plain
 * repeat, which is the honest behaviour when nothing is known.
 *
 * @param {Record<string, any>[]} sessions
 * @param {string} exercise
 * @param {unknown} targetReps
 * @param {number} increment pounds to add when the top of the range is cleared
 * @returns {{ weight: number, reps: number, kind: "load" | "rep", label: string, stalled: number } | null}
 */
export function progressionFor(sessions, exercise, targetReps, increment) {
  const range = repRange(targetReps);
  if (!range) return null;
  const [lo, hi] = range;

  const history = [...(sessions ?? [])]
    .filter((s) => s && Array.isArray(s.exercises))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((s) => s.exercises.find((/** @type {any} */ e) => e.name === exercise))
    .filter(Boolean)
    .map((/** @type {any} */ e) => e.sets?.[e.sets.length - 1])
    .filter((/** @type {any} */ x) => x && Number.isFinite(x.weight) && Number.isFinite(x.reps));

  const last = history[history.length - 1];
  if (!last) return null;

  // How many consecutive most-recent sessions sat on exactly this weight AND
  // these reps. Three is the point at which adding a rep is no longer the
  // answer and the exercise itself is the problem.
  let stalled = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (h && h.weight === last.weight && h.reps === last.reps) stalled++;
    else break;
  }

  if (last.reps >= hi) {
    const weight = Math.round((last.weight + increment) * 100) / 100;
    return {
      weight,
      reps: lo,
      kind: "load",
      label: `+${increment} lb, back to ${lo}`,
      stalled,
    };
  }
  return {
    weight: last.weight,
    reps: last.reps + 1,
    kind: "rep",
    label: `+1 rep`,
    stalled,
  };
}

/**
 * The lifts worth charting: the ones he has actually logged most often, and
 * failing that the first exercise of each template, which is the primary of
 * that session.
 *
 * Replaces a hard-coded list of four names carried over from Mise, THREE OF
 * WHICH DID NOT EXIST in this programme ("Squat", "Bench Press", "Deadlift or
 * Barbell Row" against a programme that says "Back Squat", "Flat Bench or
 * Machine Chest Press", "Romanian Deadlift"). Those three charts could never
 * have plotted a point no matter how long he trained, and a full test suite
 * did not notice because every test asserted on source text rather than data.
 *
 * @param {Record<string, any>[]} templates
 * @param {Record<string, any>[]} sessions
 * @param {number} [n]
 * @returns {string[]}
 */
export function primaryLifts(templates, sessions, n = 4) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const s of sessions ?? []) {
    for (const e of s?.exercises ?? []) {
      if (e?.name) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
    }
  }
  const logged = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  if (logged.length >= n) return logged.slice(0, n);

  const firsts = (templates ?? [])
    .map((t) => t?.exercises?.[0]?.name)
    .filter((/** @type {any} */ x) => typeof x === "string");
  const out = [...logged];
  for (const f of firsts) {
    if (out.length >= n) break;
    if (!out.includes(f)) out.push(f);
  }
  return out;
}

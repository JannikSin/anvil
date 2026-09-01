// Lifting data operations: today's session from the fixed rotation,
// last-time numbers beside each lift, PRs, and the progression series the
// SVG sparklines draw. Ported from mise app/lib/fitness.js on 2026-08-18;
// the calorie and allergen half of that file stayed in Mise as targets.js.
import { parseLocalIso, shiftIsoDate } from "./dates.js";

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
 * Today's conditioning, if the day carries any.
 *
 * Two hard sessions a week, on the upper-body mornings. This is a dose, not an
 * appetite: the VO2max dose-response curve flattens hard past two to three
 * quality sessions for a non-elite athlete, so a third hard day buys fatigue
 * rather than adaptation, and it would be spent against six lifting mornings.
 *
 * Every prescription carries a `fallback` for the same reason every session
 * carries a tier 3: the realistic alternative to the full version is nothing.
 *
 * @param {Record<string, any> | undefined} conditioning
 * @param {string} dateIso
 * @param {boolean} [short] true when the day has 20 minutes, not 40
 * @returns {Record<string, any> | null}
 */
export function conditioningForDate(conditioning, dateIso, short = false) {
  if (!conditioning) return null;
  const weekday = WEEKDAY_KEYS[parseLocalIso(dateIso).getDay()] ?? "sun";
  const plan = conditioning[weekday];
  if (!plan || typeof plan !== "object") return null;
  if (!short) return { ...plan, reduced: false };
  return {
    ...plan,
    reduced: true,
    minutes: plan.fallbackMinutes ?? plan.minutes,
    work: plan.fallback ?? plan.work,
  };
}

/**
 * P3: the three versions of today.
 *
 * The session as written assumes a normal day, and most days are not normal.
 * The realistic alternative to a full session is not a shorter session, it is
 * nothing at all, so every session carries a reduced version and picking one
 * is a button rather than a judgement made while tired.
 *
 *   Tier 1  the session as written
 *   Tier 2  the main work, accessories cut
 *   Tier 3  the one movement that matters most that day, done once
 *
 * An exercise's `tier` is the LOWEST tier it survives to, so tier N returns
 * everything with `tier >= N`. An exercise with no `tier` is an accessory.
 *
 * The caller must treat all three the same way afterwards. A tier 3 day is a
 * completed day and advances the rotation exactly as tier 1 does; the app is
 * never allowed to render a reduced session as a failure, because a person who
 * is told their 12 minutes did not count does not come back tomorrow.
 *
 * @param {Record<string, any> | null} template
 * @param {1 | 2 | 3} [tier]
 * @returns {Record<string, any> | null} the template with `exercises` filtered
 */
export function sessionAtTier(template, tier = 1) {
  if (!template) return null;
  const want = Math.min(3, Math.max(1, Math.round(tier)));
  const exercises = (template.exercises ?? []).filter(
    (/** @type {Record<string, any>} */ e) => (e.tier ?? 1) >= want,
  );
  // A template with no tier data would collapse to nothing at tier 2 or 3 and
  // silently offer an empty session, which reads as "you have no fallback"
  // exactly when the fallback is what is needed. Fall back to the full session.
  if (!exercises.length) return { ...template, tier: 1 };
  return { ...template, tier: want, exercises };
}

/** Seconds a working set actually occupies: unrack or set up, the reps under
 *  control, rack it. Thirty was the old figure and it is wrong for everything
 *  in this programme: five to eight back squats with the prescribed controlled
 *  eccentric does not fit in half a minute, and neither does getting under and
 *  out from under the bar. Forty-five is the honest floor for a compound and it
 *  is generous for a lateral raise, which is the right direction to err. */
const SECONDS_PER_SET = 45;

/**
 * Minutes a session honestly costs, from the sets and rests actually
 * prescribed. Used to label the tier buttons, because "Tier 2" means nothing at
 * 6am and "33 min" means everything.
 *
 * CORRECTED 2026-08-24, and the old version was not slightly wrong, it was
 * wrong by about a third. David asked why his sessions read as 30 minutes when
 * he is paying a fixed cost in travel and a shower to get there. The answer was
 * that they do not take 30 minutes and never did. Two errors compounded:
 *
 *   1. It counted `sets - 1` rests per exercise, on the reasoning that "the last
 *      set's rest is not spent in the gym." That is true of exactly ONE set in
 *      the whole session, the final one. You absolutely rest after the last set
 *      of Back Squat, because the next thing is Leg Press. So the rest count is
 *      one per set, and a single final rest comes off the total.
 *   2. It priced a working set at 30 seconds. See SECONDS_PER_SET.
 *
 * Lower A read 30 minutes and costs about 44 before the warm-up. The tier
 * buttons were therefore selling a 45-minute session as a half-hour one, which
 * is the opposite of what P3 is for: the tiers exist so a person can pick
 * honestly against the time they actually have.
 *
 * Still EXCLUDED, deliberately, because both are shown separately and adding
 * them here would double-count: the warm-up block (4 to 5 min, priced on its
 * own on the day screen) and any conditioning attached to the day.
 *
 * @param {Record<string, any> | null} template
 * @param {1 | 2 | 3} [tier]
 * @returns {number} whole minutes, 0 for a rest day
 */
export function tierMinutes(template, tier = 1) {
  const session = sessionAtTier(template, tier);
  if (!session) return 0;
  const exercises = session.exercises ?? [];
  const seconds = exercises.reduce(
    (/** @type {number} */ total, /** @type {Record<string, any>} */ e) => {
      const sets = Number(e.targetSets) || 0;
      const rest = Number(e.rest) || 90;
      return total + sets * SECONDS_PER_SET + sets * rest;
    },
    0,
  );
  // the one rest that genuinely is not spent in the gym: after the final set
  const last = exercises[exercises.length - 1];
  const tail = last ? Number(last.rest) || 90 : 0;
  return Math.round(Math.max(0, seconds - tail) / 60);
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
 * Append one set to an exercise in an in-progress session. Every set is a
 * record: David trains straight sets working up in weight ("then I work my
 * way up in weight", 2026-09-01), and the old replace-with-latest model
 * (setTopSet) either silently overwrote the earlier sets or, when the new
 * set matched the shown numbers, appeared to reject the entry outright.
 * Pure.
 * @param {Session} session
 * @param {string} exercise
 * @param {SetEntry} set
 * @returns {Session}
 */
export function addSet(session, exercise, set) {
  const existing = session.exercises.find((e) => e.name === exercise);
  return {
    ...session,
    exercises: existing
      ? session.exercises.map((e) => (e.name === exercise ? { ...e, sets: [...e.sets, set] } : e))
      : [...session.exercises, { name: exercise, sets: [set] }],
  };
}

/**
 * Remove the most recent set of one exercise; an exercise left with no sets
 * leaves the session entirely. The fat-thumb escape hatch: a wrong LOG press
 * used to be uncorrectable because the CHANGE IT button only rewrote keypad
 * state the pad never re-read. Pure.
 * @param {Session} session
 * @param {string} exercise
 * @returns {Session}
 */
export function undoSet(session, exercise) {
  return {
    ...session,
    exercises: session.exercises
      .map((e) => (e.name === exercise ? { ...e, sets: e.sets.slice(0, -1) } : e))
      .filter((e) => e.sets.length > 0),
  };
}

/**
 * The one place pad numbers are resolved. The render and the LOG press MUST
 * share this: until 2026-09-01 the pad displayed a seeded prefill while the
 * LOG handler read only the typed keypad state, so accepting the shown
 * numbers untouched — which is exactly a set identical to last time — filed
 * nothing and flashed invalid. David reported it as "sometimes I put
 * something in and it doesn't accept it".
 *
 * Precedence: what is typed right now, else the set just logged this session
 * (so the next straight set opens on the working weight), else the
 * progression proposal, else last session's top set, else the plan baseline,
 * else blanks.
 * @param {{ w: string, r: string } | undefined} typed
 * @param {SetEntry[] | undefined} loggedSets sets already filed this session
 * @param {{ weight: number, reps: number } | null} prog
 * @param {SetEntry[] | null} lastSets
 * @param {{ weight: number, reps: number } | undefined} baseline
 * @returns {{ w: string, r: string }}
 */
export function padValues(typed, loggedSets, prog, lastSets, baseline) {
  if (typed) return typed;
  const loggedSet = loggedSets?.[loggedSets.length - 1];
  if (loggedSet) return { w: String(loggedSet.weight), r: String(loggedSet.reps) };
  const seed = prog ?? lastSets?.[lastSets.length - 1] ?? baseline ?? null;
  return seed ? { w: String(seed.weight), r: String(seed.reps) } : { w: "", r: "" };
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

/**
 * THE QUEUE, which is what "what am I doing Tuesday" actually resolves to in
 * this programme, and the distinction matters enough to spell out.
 *
 * The rotation advances on COMPLETION, not on the weekday (see nextInRotation).
 * So there is no honest calendar to show: a session is not "Tuesday's session",
 * it is "the one after this one", and if Monday does not happen then Monday's
 * session is what Tuesday gets. Rendering a fixed weekly calendar would put
 * Lower A on a Monday he did not train and then quietly delete it, which is the
 * exact bug the completion pointer was built to remove.
 *
 * What this returns instead is the QUEUE laid onto dates: the next `count`
 * sessions in order, each landed on the next day the weekly shape trains,
 * with the rest days included as markers so a person can see that the rest is
 * real and where it falls. The dates are a projection, not a promise, and the
 * caller is required to say so.
 *
 * A day already carrying a filed session pushes the queue to the next training
 * day, so today does not show as still owing something already done (P9).
 *
 * @param {Record<string, string | null> | undefined} schedule
 * @param {Record<string, any>[]} templates
 * @param {Record<string, any>[]} sessions
 * @param {string} fromDate today, as YYYY-MM-DD
 * @param {number} [count] how many training sessions to project
 * @returns {{ date: string, weekday: string, rest: boolean, template: Record<string, any> | null }[]}
 */
export function upcomingSessions(schedule, templates, sessions, fromDate, count = 5) {
  const order = rotationOrder(schedule);
  if (!schedule || !order.length || !fromDate) return [];
  const next = nextInRotation(schedule, templates, sessions);
  if (!next) return [];
  let at = order.indexOf(String(next.id));
  if (at === -1) at = 0;

  // a session already filed today means today is spent; the queue starts
  // tomorrow. Never renders as "you still owe today's session".
  let cursor = sessionsOn(sessions, fromDate).length ? shiftIsoDate(fromDate, 1) : fromDate;

  /** @type {{ date: string, weekday: string, rest: boolean, template: Record<string, any> | null }[]} */
  const out = [];
  let trained = 0;
  // 21 days is three full weeks: enough to project six sessions past any
  // arrangement of rest days, and a hard stop so a malformed schedule with no
  // training day at all cannot spin.
  for (let i = 0; i < 21 && trained < count; i++) {
    const weekday = WEEKDAY_KEYS[parseLocalIso(cursor).getDay()] ?? "sun";
    if (schedule[weekday]) {
      const id = order[at % order.length];
      out.push({
        date: cursor,
        weekday,
        rest: false,
        template: templates.find((t) => t.id === id) ?? null,
      });
      at++;
      trained++;
    } else {
      // A rest day is a FEATURE of this programme and it is shown, because
      // "is there a rest day or is it just different muscle groups" is a
      // question the app should answer without being asked. It is not counted
      // against `count`: five sessions means five sessions.
      out.push({ date: cursor, weekday, rest: true, template: null });
    }
    cursor = shiftIsoDate(cursor, 1);
  }
  return out;
}

/**
 * Pre-lift quality work for a day: plyometrics, sprints, jump rope, med ball.
 *
 * Shipped 2026-08-24 with the rebuilt week (Crystal Life/Training-Rebuild,
 * ratified by David the same day). It runs AFTER the warm-up and BEFORE the
 * lifting, fresh, because explosive qualities are the first thing fatigue
 * erases, and it is deliberately NOT modelled as working sets: it never enters
 * the double progression, because rate of force development is not volume.
 *
 * Keyed by weekday rather than by session, for the same reason conditioning is:
 * the plyo and sprint blocks belong on lower-body days and the schedule was
 * reordered to put those on Monday and Thursday.
 *
 * @param {Record<string, any> | undefined} quality
 * @param {string} dateIso
 * @param {boolean} [short] true when the day has collapsed to a tier 3
 * @returns {Record<string, any> | null}
 */
export function qualityForDate(quality, dateIso, short = false) {
  if (!quality) return null;
  const weekday = WEEKDAY_KEYS[parseLocalIso(dateIso).getDay()] ?? "sun";
  const plan = quality[weekday];
  if (!plan || typeof plan !== "object") return null;
  if (!short) return { ...plan, reduced: false };
  return { ...plan, reduced: true, work: plan.fallback ?? plan.work };
}

/**
 * Is this date a rest day in the weekly shape? Note the deliberate asymmetry
 * with the rest of this file: the ROTATION never asks what day it is, because
 * it advances on completion. The rest day is the one place the weekday
 * genuinely matters, because the seventh day exists to pay a sleep debt that
 * accrues on a calendar.
 * @param {Record<string, string | null> | undefined} schedule
 * @param {string} dateIso
 * @returns {boolean}
 */
export function isRestDay(schedule, dateIso) {
  if (!schedule) return false;
  const weekday = WEEKDAY_KEYS[parseLocalIso(dateIso).getDay()] ?? "sun";
  return !schedule[weekday];
}

/**
 * How to get to the gym, by what today's session is. Push and pull days jog in,
 * lower days walk, and the cap is the whole point: prior aerobic work degrades
 * the lifting that follows, the impairment is localised to the muscles just
 * used, and it scales with volume. Ten easy minutes is a warm-up. Half an hour
 * before squats is a leg pre-fatigue protocol wearing a warm-up costume.
 * @param {Record<string, any> | undefined} commute
 * @param {string | null | undefined} templateId
 * @returns {string | null}
 */
export function commuteFor(commute, templateId) {
  if (!commute || !templateId) return null;
  const id = String(templateId);
  const kind = id.startsWith("lower") ? "lower" : id.startsWith("push") ? "push" : "pull";
  return typeof commute[kind] === "string" ? commute[kind] : null;
}

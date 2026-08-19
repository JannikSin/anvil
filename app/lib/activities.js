// Everything that is training but is not a barbell: runs, tennis, bouldering,
// swims, and the odd walk that counts as a Tier 4 morning.
//
// This exists because David's goals changed on 2026-08-19 from hypertrophy
// alone to hypertrophy PLUS aerobic capacity, agility, mobility and a lower
// resting heart rate, and nothing in the app could measure any of it. The data
// file (activities.json) had existed since the split, empty, with no view able
// to write to it.
//
// The aerobic prescription this supports, from the concurrent-training
// research: 120 to 150 minutes a week total, of which 100 to 120 is true
// Zone 2, plus one short interval block. That volume sits below the dose where
// running measurably interferes with hypertrophy (3 runs a week or fewer, 30
// minutes or less each, hard running kept 24h+ from a lower-body lift).

/**
 * @typedef {{
 *   id: string,
 *   date: string,
 *   type: "run" | "tennis" | "climb" | "swim" | "walk" | "other",
 *   minutes: number,
 *   miles?: number,
 *   avgHr?: number,
 *   hrDrop60?: number,
 *   note?: string
 * }} Activity
 */

/** Types that count toward the weekly aerobic target. Bouldering does not:
 *  it is intermittent, low sweat rate, and its training stress is grip and
 *  back, which the lifting log already has to account for. */
export const AEROBIC = ["run", "swim", "tennis", "walk"];

export const TYPES = ["run", "tennis", "climb", "swim", "walk", "other"];

/**
 * Append an activity. Pure. Carries an id for the same reason sessions do:
 * it is the merge key, so two same-day entries from two devices cannot
 * collapse into each other on a conflict.
 * @param {{ activities?: Activity[] }} book
 * @param {Omit<Activity, "id">} entry
 * @param {string} id
 * @returns {{ activities: Activity[] }}
 */
export function addActivity(book, entry, id) {
  const activities = book?.activities ?? [];
  return { ...book, activities: [...activities, { ...entry, id }] };
}

/**
 * Minutes of aerobic work in the 7 days ending on todayIso, inclusive.
 * @param {Activity[]} activities
 * @param {string} todayIso
 * @returns {{ minutes: number, runs: number, byType: Record<string, number> }}
 */
export function weeklyAerobic(activities, todayIso) {
  const end = new Date(`${todayIso}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  // Format from LOCAL parts. toISOString() converts to UTC, which in a positive
  // UTC offset slides a local-midnight date back a day and silently shifts the
  // whole window by one.
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

  /** @type {Record<string, number>} */
  const byType = {};
  let minutes = 0;
  let runs = 0;
  for (const a of activities ?? []) {
    if (!a || a.date < from || a.date > todayIso) continue;
    byType[a.type] = (byType[a.type] ?? 0) + (Number(a.minutes) || 0);
    if (AEROBIC.includes(a.type)) minutes += Number(a.minutes) || 0;
    if (a.type === "run") runs++;
  }
  return { minutes, runs, byType };
}

/**
 * The interference guard, and the only rule in here with teeth.
 *
 * The evidence: concurrent training costs explosive strength most when cardio
 * and lifting share a session, and hard running should sit 24h or more from a
 * lower-body lift. Three runs a week or fewer, 30 minutes or less each, keeps
 * the whole thing below the dose where hypertrophy measurably suffers.
 *
 * Returns a warning string, or null when the week is inside the safe band.
 * @param {Activity[]} activities
 * @param {string} todayIso
 * @returns {string | null}
 */
export function interferenceWarning(activities, todayIso) {
  const { minutes, runs } = weeklyAerobic(activities, todayIso);
  if (runs > 3) return `${runs} runs in 7 days. Three or fewer keeps the lifting intact.`;
  if (minutes > 180) {
    return `${minutes} aerobic minutes in 7 days, against a 120 to 150 target.`;
  }
  return null;
}

/**
 * HR-gated rest, the defensible version of David's "wait until it drops 40
 * beats" idea.
 *
 * As he stated it, it is arbitrary: a fixed 40 bpm drop from 170 leaves him at
 * 130 and under-rested, while 40 from 120 is a long wait that buys nothing. It
 * also confuses cardiovascular recovery with phosphocreatine resynthesis, which
 * is the actual limiter on a heavy compound set and runs its own 2 to 3 minute
 * course regardless of pulse.
 *
 * So heart rate chooses only INSIDE a window the literature supports, and never
 * overrides it:
 *   target  = restHr + 0.60 x (maxHr - restHr)      60% of heart rate reserve
 *   floor   = the exercise's own prescribed rest     PCr does not care about HR
 *   ceiling = 240 s                                  failing to recover IS data
 *
 * A browser cannot read HealthKit, so the peak comes from him glancing at the
 * watch he is already wearing. He supplies the one number a PWA cannot get.
 *
 * @param {number} peakHr what the watch showed at the end of the set
 * @param {number} restHr his measured resting HR
 * @param {number} maxHr his measured or estimated max
 * @param {number} floorSeconds the exercise's own rest interval
 * @returns {{ target: number, seconds: number, capped: "floor" | "ceiling" | null }}
 */
export function hrRest(peakHr, restHr, maxHr, floorSeconds) {
  const target = Math.round(restHr + 0.6 * (maxHr - restHr));
  // Recovery is roughly exponential; this approximates the time to fall from
  // peak to target with a ~60 s half-life, which is a normal 1-minute HRR.
  const excess = Math.max(0, peakHr - target);
  const span = Math.max(1, peakHr - restHr);
  const estimate = excess <= 0 ? 0 : Math.round(60 * Math.log2(1 + (2 * excess) / span));
  const bounded = Math.min(240, Math.max(floorSeconds, estimate));
  return {
    target,
    seconds: bounded,
    capped: bounded === floorSeconds && estimate < floorSeconds
      ? "floor"
      : bounded === 240 && estimate > 240
        ? "ceiling"
        : null,
  };
}

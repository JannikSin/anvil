// Everything that is training but is not a barbell: runs, tennis, bouldering,
// swims, and the odd walk that counts as a Tier 4 morning.
//
// This exists because David's goals changed on 2026-08-19 from hypertrophy
// alone to hypertrophy PLUS aerobic capacity, agility, mobility and a lower
// resting heart rate, and nothing in the app could measure any of it. The data
// file (activities.json) had existed since the split, empty, with no view able
// to write to it.
//
// The aerobic prescription this supports: 120 to 150 minutes a week, of which
// 100 to 120 is true Zone 2, plus one short interval block.
//
// 2026-08-19 CORRECTION, and it rewrote the guard below. This comment used to
// claim that volume "sits below the dose where running measurably interferes
// with hypertrophy." A deep literature pass says hypertrophy is not measurably
// interfered with at all: Schumann 2022 (43 studies, n=1090) puts concurrent
// hypertrophy at SMD -0.01, p=0.919. Only EXPLOSIVE strength is significantly
// hurt (SMD -0.28), and even that only when both are trained in one session.
//
// The "3 sessions a week, 20 to 30 minutes" rule this file was built on is one
// sentence in Wilson 2012's practical-applications section, read off a
// continuous correlation with no breakpoint analysis behind it, and quoted for
// fourteen years as a measured inflection point. Schumann 2022 directly tested
// 4.1 vs 6.1 weekly concurrent sessions and found nothing.
//
// What the same data DOES support, and what the guard now watches:
//   - DURATION beats frequency, roughly 2 to 1. Wilson's own correlations are
//     frequency r = -0.26 to -0.35 against duration r = -0.29 to -0.75. The
//     strongest number in that meta-analysis is the duration one.
//   - Hottenrott 2012 is the direct demonstration: two groups matched at 2.5 h
//     of running a week, one on long continuous runs, one on short sessions.
//     Same half-marathon time. The LONG-RUN group lost fat-free mass.
//   - Pollock 1977 doubled injury rate going from 30 to 45 minute sessions.
//   - Murphy & Koehler 2022: a ~500 kcal/day deficit abolishes lean-mass gain,
//     and a peak half-marathon week costs about that. The real failure mode is
//     an unreplaced calorie cost, not a molecular one.
//
// So: no run-count warning. Watch the single longest session and the weekly
// total, and say the calorie number out loud, because that is the one that
// actually ends a gain phase.

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
 * @returns {{ minutes: number, runs: number, longest: number, byType: Record<string, number> }}
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
  // The single longest aerobic session in the window. Tracked here rather than
  // recomputed by the caller so the date-window logic, which has already been
  // wrong once over a timezone, lives in exactly one place.
  let longest = 0;
  for (const a of activities ?? []) {
    if (!a || a.date < from || a.date > todayIso) continue;
    const mins = Number(a.minutes) || 0;
    byType[a.type] = (byType[a.type] ?? 0) + mins;
    if (AEROBIC.includes(a.type)) {
      minutes += mins;
      if (mins > longest) longest = mins;
    }
    if (a.type === "run") runs++;
  }
  return { minutes, runs, longest, byType };
}

/** Single-session ceiling, minutes. Not a cliff, a slope: it is where the plan
 *  caps the half-marathon long run, so the guard fires when a session runs past
 *  the plan rather than at an invented threshold. See the header for why
 *  duration is the moderator worth watching and frequency is not. */
export const LONG_SESSION_MIN = 110;

/** Weekly aerobic minutes before the calorie note fires, against a 120 to 150
 *  target. */
export const WEEKLY_MINUTES_MAX = 180;

/** ~1 kcal per kg per km, so ~600 kcal/h at 89 kg on a 9 to 10 min mile.
 *  Deliberately NOT the 100 kcal/mile figure that circulates online: that one
 *  is for a 62 kg runner and understates his cost by about a third. */
export const RUN_KCAL_PER_HOUR = 600;

/**
 * The interference guard.
 *
 * It does NOT count runs. A fourth 25-minute run is not a finding, and the
 * threshold that said otherwise came from a correlation misread as a
 * breakpoint (header, 2026-08-19). What it watches instead:
 *
 *   1. The longest single session, because duration carries the strongest
 *      correlation in the source data and is the variable that showed up as
 *      lost fat-free mass at MATCHED weekly volume.
 *   2. Weekly total, stated as the calories it costs, because the failure mode
 *      that actually ends a gain phase is not eating them back.
 *
 * A warning that always fires is noise, so a normal week returns null.
 *
 * @param {Activity[]} activities
 * @param {string} todayIso
 * @returns {string | null}
 */
export function interferenceWarning(activities, todayIso) {
  const { minutes, longest } = weeklyAerobic(activities, todayIso);

  if (longest > LONG_SESSION_MIN) {
    return (
      `A ${longest} min session this week. Past ~${LONG_SESSION_MIN} min, ` +
      `session length is the variable with real evidence against it.`
    );
  }

  if (minutes > WEEKLY_MINUTES_MAX) {
    const kcal = Math.round((minutes / 60) * RUN_KCAL_PER_HOUR);
    return (
      `${minutes} aerobic minutes in 7 days, against a 120 to 150 target. ` +
      `Roughly ${kcal} kcal to put back, or the surplus is gone.`
    );
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
    capped:
      bounded === floorSeconds && estimate < floorSeconds
        ? "floor"
        : bounded === 240 && estimate > 240
          ? "ceiling"
          : null,
  };
}

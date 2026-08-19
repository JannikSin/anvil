// The daily check-in row, ported from mise app/lib/fitness.js on 2026-08-18.
//
// This is the one file where anvil and Mise genuinely overlap. One row per
// day in mise-data fitness/daily.json carries anvil's fields (sleepHours,
// weight, pushups) alongside Mise's (water, supplements, dailyDozen). Both
// apps patch the same row and merge.js resolves field-wise on conflict, so
// this function must stay a PURE, shallow field patch in both repos. Anything
// that rewrites a whole day object here would silently drop the other app's
// fields on every write.

/**
 * @typedef {{ days: Record<string, any>[] }} Daily
 */

/**
 * Patch (or create) one day's check-in row. Pure.
 * @param {Daily} daily
 * @param {string} date
 * @param {Record<string, any>} patch
 * @returns {Daily}
 */
export function upsertDay(daily, date, patch) {
  const days = daily.days ?? [];
  const existing = days.find((d) => d.date === date);
  return {
    ...daily,
    days: existing
      ? days.map((d) => (d.date === date ? { ...d, ...patch } : d))
      : [...days, { date, ...patch }],
  };
}

/** The check-in fields anvil owns. Mise owns everything else on the row. */
export const ANVIL_FIELDS = ["sleepHours", "weight", "pushups"];

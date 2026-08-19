// Apple Health vitals ingest, ported from mise worker/src/lib.js on
// 2026-08-18. Unchanged logic: the metric map and the field-wise day merge
// are the part that was verified against a real Health Auto Export payload,
// and re-deriving them would throw that away.

// ---- Apple Health vitals ingest ------------------------------------------
// Health Auto Export (healthyapps.dev) posts HealthKit data straight to a REST
// endpoint on a schedule. That replaces the 14-action Apple Shortcut this
// project originally specced: no Shortcuts app, no PAT on the phone clipboard,
// and a scheduled app export does not silently fail the way a locked-phone
// automation can.
//
// Its payload is {"data":{"metrics":[{name, units, data:[{date, qty}]}]}}.
// The exact metric NAMES are the one thing not verified against a live export,
// so nothing here fails silently: unrecognised metric names are collected and
// echoed back in the response, which turns the first real post into the
// documentation. Fix the map below from that response, do not guess twice.

/**
 * normalise a metric name for matching: lowercase, alphanumerics only
 * @param {unknown} name
 */
function metricKey(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * HealthKit metric name (normalised) -> the vitals.json field it feeds
 * @type {Record<string, string>}
 */
const METRIC_FIELD = {
  stepcount: "steps",
  steps: "steps",
  walkingrunningdistance: "distanceMi",
  distancewalkingrunning: "distanceMi",
  activeenergy: "activeKcal",
  activeenergyburned: "activeKcal",
  restingheartrate: "restingHR",
  heartratevariability: "hrvMs",
  heartratevariabilitysdnn: "hrvMs",
  sleepanalysis: "sleepHours",
  vo2max: "vo2max",
};

/**
 * how many decimals each field is stored with
 * @type {Record<string, number>}
 */
const FIELD_ROUND = {
  steps: 0,
  distanceMi: 1,
  activeKcal: 0,
  restingHR: 0,
  hrvMs: 1,
  sleepHours: 1,
  vo2max: 1,
};

/**
 * Convert a raw quantity into the unit vitals.json stores. Health Auto Export
 * reports in the phone's locale units, so a device set to metric would
 * otherwise write kilometres into a field the dashboard labels miles.
 * @param {string} field
 * @param {number} qty
 * @param {string} units
 */
function toStoredUnit(field, qty, units) {
  const u = String(units ?? "").toLowerCase();
  if (field === "distanceMi") {
    if (u.includes("km")) return qty * 0.621371;
    if (u === "m" || u.includes("meter")) return qty * 0.000621371;
  }
  if (field === "activeKcal" && u.includes("kj")) return qty / 4.184;
  if (field === "sleepHours" && (u.includes("min") || u.includes("sec"))) {
    return u.includes("sec") ? qty / 3600 : qty / 60;
  }
  return qty;
}

/**
 * Sleep entries are not a single quantity: Health Auto Export reports the
 * stages separately. Prefer an explicit total, else asleep, else the sum of
 * the asleep stages. inBed and awake are deliberately excluded, because time
 * in bed is not sleep and counting it inflates every downstream number.
 * @param {Record<string, any>} entry
 * @returns {number | null}
 */
function sleepHoursFrom(entry) {
  for (const k of ["totalsleep", "asleep"]) {
    const hit = Object.keys(entry).find((key) => metricKey(key) === k);
    if (hit && typeof entry[hit] === "number") return entry[hit];
  }
  const stages = ["deep", "core", "rem", "light"];
  let sum = 0;
  let found = false;
  for (const key of Object.keys(entry)) {
    if (stages.includes(metricKey(key)) && typeof entry[key] === "number") {
      sum += entry[key];
      found = true;
    }
  }
  return found ? sum : null;
}

/**
 * Parse a Health Auto Export payload (or a plain {days:[...]} body) into
 * vitals.json day rows.
 * @param {Record<string, any> | null} body
 * @returns {{ days: Record<string, any>[], recognized: string[], ignored: string[] }}
 */
export function parseHealthExport(body) {
  /** @type {string[]} */
  const ignored = [];
  /** @type {string[]} */
  const recognized = [];
  /** @type {Record<string, Record<string, any>>} */
  const byDate = {};

  /**
   * @param {string} date
   * @param {string} field
   * @param {number} value
   */
  const put = (date, field, value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value)) return;
    const decimals = FIELD_ROUND[field] ?? 1;
    const rounded = Number(value.toFixed(decimals));
    if (rounded <= 0) return; // a zero-step day is a phone left at home, not data
    byDate[date] = byDate[date] ?? { date };
    byDate[date][field] = rounded;
  };

  // Direct shape: {days:[{date, steps, ...}]} or a single {date, ...}.
  // Kept because it makes this endpoint testable with curl and gives a manual
  // fallback if the app is ever uninstalled.
  const direct = Array.isArray(body?.days) ? body.days : body?.date ? [body] : null;
  if (direct) {
    for (const row of direct) {
      const date = String(row?.date ?? "").slice(0, 10);
      for (const [field, decimals] of Object.entries(FIELD_ROUND)) {
        void decimals;
        if (typeof row?.[field] === "number") put(date, field, row[field]);
      }
    }
    return {
      days: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)),
      recognized,
      ignored,
    };
  }

  const metrics = body?.data?.metrics ?? body?.metrics ?? [];
  if (!Array.isArray(metrics)) return { days: [], recognized, ignored };

  for (const metric of metrics) {
    const field = METRIC_FIELD[metricKey(metric?.name)];
    if (!field) {
      const raw = String(metric?.name ?? "?");
      if (!ignored.includes(raw)) ignored.push(raw);
      continue;
    }
    if (!recognized.includes(field)) recognized.push(field);
    for (const entry of Array.isArray(metric?.data) ? metric.data : []) {
      const date = String(entry?.date ?? "").slice(0, 10);
      const raw =
        field === "sleepHours"
          ? sleepHoursFrom(entry)
          : typeof entry?.qty === "number"
            ? entry.qty
            : typeof entry?.Avg === "number"
              ? entry.Avg
              : typeof entry?.avg === "number"
                ? entry.avg
                : null;
      if (raw === null) continue;
      put(date, field, toStoredUnit(field, raw, metric?.units));
    }
  }
  return {
    days: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)),
    recognized,
    ignored,
  };
}

/**
 * Upsert incoming days into the stored day list, newest data winning per
 * FIELD (not per row), so a partial re-post never blanks a field an earlier
 * post already filled. Sorted oldest-first, which is how the dashboard reads.
 * @param {Record<string, any>[]} existing
 * @param {Record<string, any>[]} incoming
 */
export function mergeVitalsDays(existing, incoming) {
  /** @type {Record<string, Record<string, any>>} */
  const byDate = {};
  for (const row of Array.isArray(existing) ? existing : []) {
    const date = String(row?.date ?? "").slice(0, 10);
    if (date) byDate[date] = { ...row, date };
  }
  for (const row of Array.isArray(incoming) ? incoming : []) {
    const date = String(row?.date ?? "").slice(0, 10);
    if (!date) continue;
    byDate[date] = { ...(byDate[date] ?? {}), ...row, date };
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

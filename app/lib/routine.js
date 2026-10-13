// THE ROUTINE CARD (Core Purpose P14; decisions 0003 and 0012, 2026-10-12).
//
// Every daily routine tick lives in Anvil and nowhere else: two places to tick
// the same thing is how neither gets ticked. The card is built from the
// person's profile, never from a list in this code:
//
//   - supplements: the profile's `supplementPlan` (id, name, dose, timing),
//     ticked into the shared row's `supplements` field by the plan's own id,
//     so the history Mise wrote before 2026-10-12 lines up;
//   - water: one tick, when the profile tracks water;
//   - everything else: the one fixed routine that ships with the programme
//     (program.json `routine`, David 2026-10-13: "There is one set routine
//     that I do, and that's it"), ticked into the row's `routine` field.
//
// The morning check-in stays at its three fields (weight, sleep, push-ups);
// nothing here is ever added to it.

/**
 * @typedef {{ id: string, label: string, when: "morning" | "evening", kind: "tick" | "text", at?: string, from?: string, days?: number[] }} CustomItem
 * @typedef {{ items: CustomItem[], supplementAt?: { morning?: string, evening?: string } }} Routine
 * @typedef {{ id: string, label: string, sub: string, when: "morning" | "evening", kind: "tick" | "text", field: "supplements" | "routine", at?: string }} CardItem
 */

/**
 * Morning or evening, from the plan's own timing words. Evening only when the
 * timing names the evening, the night or bed AND does not also name a morning
 * meal ("with morning coffee, or solo in the evening" is a morning dose).
 * @param {string | undefined} timing
 * @returns {"morning" | "evening"}
 */
export function supplementWhen(timing) {
  const t = (timing ?? "").toLowerCase();
  if (/\b(bed|bedtime|evening|night)\b/.test(t) && !/\b(morning|breakfast)\b/.test(t)) {
    return "evening";
  }
  return "morning";
}

/**
 * The card, in the order the day happens: morning items, then evening.
 * @param {Record<string, any> | null | undefined} targets the person's profile targets
 * @param {Routine | null | undefined} routine anvil-data routine.json
 * @param {string} [date] the day shown; an item queued to start later is not on it yet
 * @returns {CardItem[]}
 */
export function routineItems(targets, routine, date = undefined) {
  /** @type {CardItem[]} */
  const out = [];
  const plan = Array.isArray(targets?.supplementPlan) ? targets.supplementPlan : [];
  for (const s of plan) {
    if (!s || typeof s.id !== "string" || !s.id) continue;
    out.push({
      id: s.id,
      label: String(s.name ?? s.id),
      sub: [s.dose, s.timing].filter((x) => typeof x === "string" && x).join(" · "),
      when: supplementWhen(s.timing),
      kind: "tick",
      field: "supplements",
    });
    const last = /** @type {CardItem} */ (out[out.length - 1]);
    const at = routine?.supplementAt?.[last.when];
    if (at) last.at = at;
  }
  const tracks = Array.isArray(targets?.tracks) ? targets.tracks : [];
  if (tracks.includes("water")) {
    const l = Number(targets?.waterLiters);
    out.push({
      id: "water",
      label: "Water",
      sub: Number.isFinite(l) && l > 0 ? `${l} L` : "",
      when: "morning",
      kind: "tick",
      field: "routine",
    });
  }
  for (const it of routine?.items ?? []) {
    if (!it || typeof it.id !== "string" || !it.label) continue;
    if (date && it.from && it.from > date) continue;
    if (
      date &&
      Array.isArray(it.days) &&
      !it.days.includes(new Date(`${date}T12:00:00`).getDay())
    ) {
      continue;
    }
    out.push({
      id: it.id,
      label: it.label,
      sub: "",
      ...(it.at ? { at: it.at } : {}),
      when: it.when === "evening" ? "evening" : "morning",
      kind: it.kind === "text" ? "text" : "tick",
      field: "routine",
    });
  }
  // the day in order: morning then evening, and inside each by clock time; an
  // item with no time keeps its place after the timed ones
  const rank = { morning: 0, evening: 1 };
  const clock = (/** @type {CardItem} */ x) => minutesOf(x.at) ?? 24 * 60;
  return out
    .map((x, i) => ({ x, i }))
    .sort((a, b) => rank[a.x.when] - rank[b.x.when] || clock(a.x) - clock(b.x) || a.i - b.i)
    .map(({ x }) => x);
}

/**
 * The recorded value for an item on a day row: true for a tick, the text for
 * a text item, or null when nothing is recorded.
 * @param {Record<string, any> | null | undefined} day
 * @param {CardItem} item
 * @returns {true | string | null}
 */
export function recorded(day, item) {
  const v = day?.[item.field]?.[item.id];
  if (item.kind === "text") return typeof v === "string" && v.trim() ? v : null;
  return v === true ? true : null;
}

/**
 * The shallow patch for one tick (or one line of text). It carries the whole
 * field map for that day, so the other ticks already on the row survive; the
 * row itself is patched field by field (upsertDay), never rewritten.
 * @param {Record<string, any> | null | undefined} day
 * @param {CardItem} item
 * @param {boolean | string} value true / false for a tick, the text for a text item
 * @returns {Record<string, any>}
 */
export function tickPatch(day, item, value) {
  const prev = day?.[item.field] && typeof day[item.field] === "object" ? day[item.field] : {};
  /** @type {Record<string, any>} */
  const next = { ...prev };
  if (value === false || value === "" || value == null) delete next[item.id];
  else next[item.id] = item.kind === "text" ? String(value).trim() : true;
  return { [item.field]: next };
}

/**
 * How many of the card's items are recorded on a day.
 * @param {Record<string, any> | null | undefined} day
 * @param {CardItem[]} items
 */
export function recordedCount(day, items) {
  return items.filter((it) => recorded(day, it) !== null).length;
}

/**
 * Minutes after midnight for "6:35 am", "11:30 pm", "22:45" or an <input
 * type=time> value; null when it cannot be read.
 * @param {string | undefined} t
 * @returns {number | null}
 */
export function minutesOf(t) {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(t ?? "");
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const ap = (m[3] ?? "").toLowerCase();
  if (h > 23 || min > 59 || (ap && (h < 1 || h > 12))) return null;
  if (ap === "pm" && h !== 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + min;
}


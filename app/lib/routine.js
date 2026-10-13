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
//   - everything else (kitchen closed, tomorrow's first line, reading, a
//     reward): the person's own items, added from Settings and kept in
//     anvil-data `routine.json`, ticked into the row's `routine` field.
//
// The morning check-in stays at its three fields (weight, sleep, push-ups);
// nothing here is ever added to it.

/**
 * @typedef {{ id: string, label: string, when: "morning" | "evening", kind: "tick" | "text", at?: string }} CustomItem
 * @typedef {{ items: CustomItem[] }} Routine
 * @typedef {{ id: string, label: string, sub: string, when: "morning" | "evening", kind: "tick" | "text", field: "supplements" | "routine" }} CardItem
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
 * @returns {CardItem[]}
 */
export function routineItems(targets, routine) {
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
    out.push({
      id: it.id,
      label: it.label,
      sub: it.at ?? "",
      when: it.when === "evening" ? "evening" : "morning",
      kind: it.kind === "text" ? "text" : "tick",
      field: "routine",
    });
  }
  const rank = { morning: 0, evening: 1 };
  return out
    .map((x, i) => ({ x, i }))
    .sort((a, b) => rank[a.x.when] - rank[b.x.when] || a.i - b.i)
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
 * Add one of the person's own items. Ids are `r-` plus a slug of the label,
 * unique within the routine, and never reused for a different label.
 * @param {Routine | null | undefined} routine
 * @param {{ label: string, when?: string, kind?: string, at?: string }} input
 * @returns {Routine}
 */
export function addRoutineItem(routine, input) {
  const items = [...(routine?.items ?? [])];
  const label = String(input.label ?? "")
    .trim()
    .slice(0, 60);
  if (!label) return { items };
  const base =
    "r-" +
    (label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "item");
  const taken = new Set(items.map((x) => x.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  /** @type {CustomItem} */
  const item = {
    id,
    label,
    when: input.when === "evening" ? "evening" : "morning",
    kind: input.kind === "text" ? "text" : "tick",
  };
  const at = String(input.at ?? "")
    .trim()
    .slice(0, 20);
  if (at) item.at = at;
  return { items: [...items, item] };
}

/**
 * @param {Routine | null | undefined} routine
 * @param {string} id
 * @returns {Routine}
 */
export function removeRoutineItem(routine, id) {
  return { items: (routine?.items ?? []).filter((x) => x.id !== id) };
}

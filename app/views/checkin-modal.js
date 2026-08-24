import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { relativeDayLabel, shiftIsoDate } from "../lib/dates.js";

/**
 * The once-a-day check-in.
 *
 * David's rule, 2026-08-18: "I'm not going to wake up in the morning and open
 * three apps and put the same thing in each of the three." So this asks once,
 * on the first open of a day, and then never again that day whether he filled
 * it in or not. Anvil is the surface he opens on a training day, so this is
 * where the numbers get caught.
 *
 * Typed inputs on purpose, also his call: he would rather type 196 than nudge
 * a stepper to it.
 *
 * Standing protocol note (Crystal System/Protocol, from the 2026-07-26 breath
 * trainer council): new daily experiments attach to the nightly pushups and
 * NEVER to the weigh-in, because the weigh-in's whole value is that it is
 * frictionless. So this dialog stays at three fields and does not grow.
 *
 * The date steps back, for the same reason the session's does: P4 says a late
 * entry is a first-class entry, and a weigh-in missed on Saturday is exactly
 * the gap the gain phase's 7-day average keeps failing to fill. It opens on
 * today and needs no interaction to stay there.
 *
 * @param {{
 *   today: string,
 *   days: Record<string, any>[],
 *   onSave: (patch: Record<string, any>, date: string) => void,
 *   onClose: () => void
 * }} props
 * @returns {import("preact").VNode}
 */
export function CheckinModal({ today, days, onSave, onClose }) {
  const [date, setDate] = useState(today);
  const row = (days ?? []).find((d) => d.date === date) ?? {};
  const [weight, setWeight] = useState(row.weight != null ? String(row.weight) : "");
  const [sleep, setSleep] = useState(row.sleepHours != null ? String(row.sleepHours) : "");
  const [pushups, setPushups] = useState(row.pushups != null ? String(row.pushups) : "");
  const firstRef = useRef(/** @type {any} */ (null));
  // one interpolation, one line: htm eats any whitespace run containing a
  // newline where it touches a tag, and prettier rewraps a long line straight
  // back into that bug (CLAUDE.md, "htm whitespace, learned the hard way")
  const dayLabel = relativeDayLabel(date, today);

  /** Stepping the date reloads the fields from that day's row, so the dialog
   *  never shows Saturday's weight under Thursday's heading. */
  const moveTo = (/** @type {string} */ next) => {
    if (!next || next > today) return;
    const r = (days ?? []).find((d) => d.date === next) ?? {};
    setDate(next);
    setWeight(r.weight != null ? String(r.weight) : "");
    setSleep(r.sleepHours != null ? String(r.sleepHours) : "");
    setPushups(r.pushups != null ? String(r.pushups) : "");
  };

  // focus the weight field: it is the one number the gain phase is steered by,
  // and the only one whose absence has actually cost him anything
  useEffect(() => {
    firstRef.current?.focus?.();
  }, []);

  // Escape closes, same as NOT NOW. A modal you cannot dismiss on a phone in a
  // gym is a modal that gets the app deleted.
  useEffect(() => {
    const onKey = (/** @type {KeyboardEvent} */ e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = () => {
    /** @type {Record<string, any>} */
    const patch = {};
    const put = (/** @type {string} */ field, /** @type {string} */ raw) => {
      const v = raw.trim();
      if (v === "") return; // a blank field means "not today", never zero
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) patch[field] = n;
    };
    put("weight", weight);
    put("sleepHours", sleep);
    put("pushups", pushups);
    if (Object.keys(patch).length) onSave(patch, date);
    onClose();
  };

  const field = (
    /** @type {string} */ label,
    /** @type {string} */ unit,
    /** @type {string} */ value,
    /** @type {(v: string) => void} */ set,
    /** @type {string} */ step,
    /** @type {boolean} */ first,
  ) => html`
    <label class="askrow" key=${label}>
      <span>
        <span class="askrow__k">${label}</span>
        <span class="askrow__u">${unit || "count"}</span>
      </span>
      <input
        class="well"
        ref=${first ? firstRef : undefined}
        type="number"
        inputmode="decimal"
        step=${step}
        placeholder="—"
        aria-label=${`${label} today`}
        value=${value}
        onInput=${(/** @type {any} */ e) => set(e.currentTarget.value)}
        onKeyDown=${(/** @type {any} */ e) => {
          if (e.key === "Enter") save();
        }}
      />
    </label>
  `;

  return html`
    <div class="scrim" onClick=${onClose}>
      <div
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Daily check-in"
        onClick=${(/** @type {any} */ e) => e.stopPropagation()}
      >
        <h2 class="band">Check-in<span class="band__sub">${dayLabel}</span></h2>
        <div class="datepad">
          <button
            class="knob"
            type="button"
            aria-label="Check in for a day earlier"
            onClick=${() => moveTo(shiftIsoDate(date, -1))}
          >
            ‹
          </button>
          <input
            class="datepad__well"
            type="date"
            max=${today}
            value=${date}
            aria-label="Date these numbers are for"
            onInput=${(/** @type {any} */ e) => moveTo(e.currentTarget.value)}
          />
          <button
            class="knob"
            type="button"
            aria-label="Check in for a day later"
            disabled=${date >= today}
            onClick=${() => moveTo(shiftIsoDate(date, 1))}
          >
            ›
          </button>
        </div>
        <p class="note">Once a day, here only. Blank means skip that one.</p>
        <div>
          ${field("Weight", "lb", weight, setWeight, "0.1", true)}
          ${field("Sleep", "h", sleep, setSleep, "0.25", false)}
          ${field("Pushups so far", "", pushups, setPushups, "1", false)}
        </div>
        <div class="act">
          <button class="cta" onClick=${save}>SAVE</button>
          <button class="ghost" onClick=${onClose}>NOT NOW</button>
        </div>
      </div>
    </div>
  `;
}

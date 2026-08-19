import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";

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
 * @param {{
 *   today: string,
 *   row: Record<string, any>,
 *   onSave: (patch: Record<string, any>) => void,
 *   onClose: () => void
 * }} props
 * @returns {import("preact").VNode}
 */
export function CheckinModal({ today, row, onSave, onClose }) {
  const [weight, setWeight] = useState(row.weight != null ? String(row.weight) : "");
  const [sleep, setSleep] = useState(row.sleepHours != null ? String(row.sleepHours) : "");
  const [pushups, setPushups] = useState(row.pushups != null ? String(row.pushups) : "");
  const firstRef = useRef(/** @type {any} */ (null));

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
    if (Object.keys(patch).length) onSave(patch);
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
    <label class="lift" key=${label}>
      <div class="liftrow">
        <span class="food">${label}</span>
        <span class="q num">${unit}</span>
      </div>
      <div class="setform">
        <input
          ref=${first ? firstRef : undefined}
          type="number"
          inputmode="decimal"
          step=${step}
          placeholder=${unit}
          aria-label=${`${label} today`}
          value=${value}
          onInput=${(/** @type {any} */ e) => set(e.currentTarget.value)}
          onKeyDown=${(/** @type {any} */ e) => {
            if (e.key === "Enter") save();
          }}
        />
      </div>
    </label>
  `;

  return html`
    <div class="modal-overlay" onClick=${onClose}>
      <div
        class="modal checkin"
        role="dialog"
        aria-modal="true"
        aria-label="Daily check-in"
        onClick=${(/** @type {any} */ e) => e.stopPropagation()}
      >
        <h2 class="block-title">Check-in · ${today}</h2>
        <p class="hint">Once a day, here only. Blank means skip that one.</p>
        <div class="slots">
          ${field("Weight", "lb", weight, setWeight, "0.1", true)}
          ${field("Sleep", "h", sleep, setSleep, "0.25", false)}
          ${field("Pushups so far", "", pushups, setPushups, "1", false)}
        </div>
        <div class="actions wrap">
          <button class="primary" onClick=${save}>SAVE</button>
          <button class="secondary" onClick=${onClose}>NOT NOW</button>
        </div>
      </div>
    </div>
  `;
}

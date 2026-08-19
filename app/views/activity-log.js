import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { TYPES, interferenceWarning, weeklyAerobic } from "../lib/activities.js";

/**
 * Logging for everything that is not a barbell.
 *
 * Deliberately NOT a sixth tab. It sits under the lifts on Today, because the
 * moment he logs a run is the same moment he logs a session, and a tab he has
 * to remember to visit is a tab that stays empty. The app already proved that
 * with a Vitals screen nobody could fill.
 *
 * Everything except type and minutes is optional. A run with only a duration
 * is a logged run; demanding distance and heart rate is how you get zero runs
 * logged instead of ten imprecise ones.
 *
 * @param {{
 *   activities: import("../lib/activities.js").Activity[],
 *   today: string,
 *   onLog: (entry: Record<string, any>) => void
 * }} props
 * @returns {import("preact").VNode}
 */
export function ActivityLog({ activities, today, onLog }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("run");
  const [minutes, setMinutes] = useState("");
  const [miles, setMiles] = useState("");
  const [avgHr, setAvgHr] = useState("");
  const [hrDrop, setHrDrop] = useState("");

  const week = weeklyAerobic(activities, today);
  const warn = interferenceWarning(activities, today);
  const todays = (activities ?? []).filter((a) => a.date === today);

  const save = () => {
    const m = Number(minutes);
    if (!Number.isFinite(m) || m <= 0) return;
    /** @type {Record<string, any>} */
    const entry = { date: today, type, minutes: Math.round(m) };
    const opt = (/** @type {string} */ k, /** @type {string} */ raw) => {
      const v = Number(raw);
      if (raw.trim() !== "" && Number.isFinite(v) && v > 0) entry[k] = v;
    };
    opt("miles", miles);
    opt("avgHr", avgHr);
    opt("hrDrop60", hrDrop);
    onLog(entry);
    setMinutes("");
    setMiles("");
    setAvgHr("");
    setHrDrop("");
    setOpen(false);
  };

  const num = (
    /** @type {string} */ label,
    /** @type {string} */ value,
    /** @type {(v: string) => void} */ set,
    /** @type {string} */ hint,
  ) => html`
    <label class="lift" key=${label}>
      <div class="liftrow">
        <span class="food">${label}</span>
        <span class="q num">${hint}</span>
      </div>
      <div class="setform">
        <input
          type="number"
          inputmode="decimal"
          aria-label=${label}
          value=${value}
          onInput=${(/** @type {any} */ e) => set(e.currentTarget.value)}
        />
      </div>
    </label>
  `;

  return html`
    <h2 class="block-title">Aerobic</h2>
    <div class="grid">
      <div class="tile">
        <div class="k">This week</div>
        <div class="v num">${week.minutes}<small> min</small></div>
        <div class="d num">${`${week.runs} run${week.runs === 1 ? "" : "s"} · target 120-150`}</div>
      </div>
      <div class="tile ${warn ? "warn" : ""}">
        <div class="k">Interference</div>
        <div class="v">${warn ? "over" : "clear"}</div>
        <div class="d">
          ${warn ?? "3 runs or fewer, 30 min or less each, keeps the lifting intact"}
        </div>
      </div>
    </div>

    ${
      todays.length > 0 &&
      html`<div class="slots">
        ${todays.map(
          (a) => html`
            <div class="checkrow static" key=${a.id}>
              <span class="food">${a.type}</span>
              <span class="q num">
                ${`${a.minutes} min${a.miles ? ` · ${a.miles} mi` : ""}${a.avgHr ? ` · ${a.avgHr} bpm` : ""}${a.hrDrop60 ? ` · −${a.hrDrop60} in 60s` : ""}`}
              </span>
            </div>
          `,
        )}
      </div>`
    }

    ${
      !open &&
      html`<button class="secondary" onClick=${() => setOpen(true)}>+ LOG A RUN OR ACTIVITY</button>`
    }
    ${
      open &&
      html`
        <div class="chips wrapchips" role="group" aria-label="Activity type">
          ${TYPES.map(
            (t) => html`
              <button
                key=${t}
                class=${type === t ? "chip on" : "chip"}
                aria-pressed=${type === t}
                onClick=${() => setType(t)}
              >
                ${t}
              </button>
            `,
          )}
        </div>
        <div class="slots">
          ${num("Minutes", minutes, setMinutes, "required")}
          ${num("Miles", miles, setMiles, "optional")}
          ${num("Average HR", avgHr, setAvgHr, "optional")}
          ${num("HR drop, 60s after", hrDrop, setHrDrop, "optional")}
        </div>
        <p class="hint">
          The 60-second drop is the one worth catching: more than 12 bpm is normal, and it is the
          cheapest fitness signal you own. Everything except minutes can stay blank.
        </p>
        <div class="actions wrap">
          <button class="primary" onClick=${save} disabled=${!minutes.trim()}>LOG IT</button>
          <button class="secondary" onClick=${() => setOpen(false)}>CANCEL</button>
        </div>
      `
    }
  `;
}

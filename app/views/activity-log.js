import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { TYPES, interferenceWarning, weeklyAerobic } from "../lib/activities.js";

/**
 * Logging for everything that is not a barbell.
 *
 * Deliberately NOT a sixth tab. It sits under the lifts on the Bar screen,
 * because the moment a run is logged is the same moment a session is logged,
 * and a tab you have to remember to visit is a tab that stays empty. This app
 * already proved that with a Watch screen nobody could fill.
 *
 * Everything except type and minutes is optional. A run with only a duration is
 * a logged run; demanding distance and heart rate is how you get zero runs
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

  const ask = (
    /** @type {string} */ label,
    /** @type {string} */ value,
    /** @type {(v: string) => void} */ set,
    /** @type {string} */ hint,
  ) => html`
    <label class="askrow" key=${label}>
      <span>
        <span class="askrow__k">${label}</span>
        <span class="askrow__u">${hint}</span>
      </span>
      <input
        class="well"
        type="number"
        inputmode="decimal"
        placeholder="—"
        aria-label=${label}
        value=${value}
        onInput=${(/** @type {any} */ e) => set(e.currentTarget.value)}
      />
    </label>
  `;

  return html`
    <h2 class="band">Everything else</h2>
    <div class="plates">
      <div class="plate">
        <div class="plate__k">Aerobic this week</div>
        <div class="plate__v">
          ${week.minutes}
          <small>MIN</small>
        </div>
        <div class="plate__d num">
          ${`${week.runs} run${week.runs === 1 ? "" : "s"} · target 120-150`}
        </div>
      </div>
      <div class=${`plate ${warn ? "plate--warn" : ""}`}>
        <div class="plate__k">Interference</div>
        <div class="plate__v">${warn ? "OVER" : "CLEAR"}</div>
        <div class="plate__d">
          ${warn ?? "Run count does not matter. Session length and replacing the calories do."}
        </div>
      </div>
    </div>

    ${
      todays.length > 0 &&
      html`<div class="rack">
        ${todays.map(
          (a) => html`
            <div class="bar" key=${a.id}>
              <span class="bar__name">${a.type}</span>
              <span class="bar__meta num">
                ${`${a.minutes} min${a.miles ? ` · ${a.miles} mi` : ""}${a.avgHr ? ` · ${a.avgHr} bpm` : ""}${a.hrDrop60 ? ` · −${a.hrDrop60} in 60s` : ""}`}
              </span>
            </div>
          `,
        )}
      </div>`
    }
    ${
      !open &&
      html`<div class="act">
        <button class="ghost" onClick=${() => setOpen(true)}>+ LOG A RUN OR ACTIVITY</button>
      </div>`
    }
    ${
      open &&
      html`
        <div class="chiprow" role="group" aria-label="Activity type">
          ${TYPES.map(
            (t) => html`
              <button
                key=${t}
                class=${type === t ? "chip is-on" : "chip"}
                aria-pressed=${type === t}
                onClick=${() => setType(t)}
              >
                ${t}
              </button>
            `,
          )}
        </div>
        <div>
          ${ask("Minutes", minutes, setMinutes, "required")}
          ${ask("Miles", miles, setMiles, "optional")}
          ${ask("Average HR", avgHr, setAvgHr, "optional")}
          ${ask("HR drop, 60s after", hrDrop, setHrDrop, "optional")}
        </div>
        <p class="note">
          ${"The 60-second drop is the one worth catching: more than 12 bpm is normal, and it is the cheapest fitness signal you own. Everything except minutes can stay blank."}
        </p>
        <div class="act">
          <button class="cta" onClick=${save} disabled=${!minutes.trim()}>LOG IT</button>
          <button class="ghost" onClick=${() => setOpen(false)}>CANCEL</button>
        </div>
      `
    }
  `;
}

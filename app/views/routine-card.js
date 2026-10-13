import { html } from "htm/preact";
import { useState } from "preact/hooks";
import {
  addRoutineItem,
  nextSundayFrom,
  recorded,
  recordedCount,
  removeRoutineItem,
  routineItems,
  starterRoutine,
  tickPatch,
} from "../lib/routine.js";
import { relativeDayLabel, shiftIsoDate } from "../lib/dates.js";

/**
 * The day's routine on the Today screen (Core Purpose P14, tenet 6): a sheet
 * to read first and tick second, in the order the day happens. One tap per
 * item, the whole row is the button, and the day steps back so a late tick is
 * filed against its own date (P4: a late entry is first class). Nothing on
 * this card is ever shown as missed: an untouched item is just an item, never
 * a red one (P9).
 *
 * @param {{
 *   targets: Record<string, any> | null,
 *   routine: import("../lib/routine.js").Routine,
 *   daily: { days: Record<string, any>[] },
 *   today: string,
 *   onPatch: (patch: Record<string, any>, date: string) => void
 * }} props
 * @returns {import("preact").VNode | null}
 */
export function RoutineCard({ targets, routine, daily, today, onPatch }) {
  const [back, setBack] = useState(0);
  const [texts, setTexts] = useState(/** @type {Record<string, string>} */ ({}));
  const date = shiftIsoDate(today, -back);
  const items = routineItems(targets, routine, date);
  if (items.length === 0) {
    return html`<section class="routine" aria-label="Today's routine">
      <p class="note">
        Your daily routine lives here. Set it up once in Settings, under Your routine.
      </p>
    </section>`;
  }
  const day = (daily?.days ?? []).find((d) => d.date === date) ?? null;
  const done = recordedCount(day, items);
  const line = (/** @type {import("../lib/routine.js").CardItem} */ it) =>
    [it.at, it.sub].filter(Boolean).join(" · ");

  /** @param {"morning" | "evening"} when */
  const group = (when) => {
    const list = items.filter((it) => it.when === when);
    if (list.length === 0) return null;
    return html`
      <div class="band">${when === "morning" ? "morning" : "evening"}</div>
      <div class="rack">
        ${list.map((it) => {
          const v = recorded(day, it);
          if (it.kind === "text") {
            const key = `${date}:${it.id}`;
            const draft = texts[key] ?? (typeof v === "string" ? v : "");
            return html`<div class="bar routine__textrow" key=${it.id}>
              <span class="routine__what">
                <span class="bar__name">${it.label}</span>
                ${line(it) && html`<span class="routine__sub">${line(it)}</span>`}
              </span>
              <input
                class="well"
                type="text"
                aria-label=${it.label}
                placeholder="one physical action"
                value=${draft}
                onInput=${(/** @type {any} */ e) =>
                  setTexts({ ...texts, [key]: e.currentTarget.value })}
                onBlur=${() => {
                  if ((draft || "") !== (typeof v === "string" ? v : "")) {
                    onPatch(tickPatch(day, it, draft), date);
                  }
                }}
              />
            </div>`;
          }
          return html`<button
            class="bar"
            key=${it.id}
            aria-pressed=${v === true}
            aria-label=${`${it.label}${v === true ? ", recorded" : ""}`}
            onClick=${() => onPatch(tickPatch(day, it, v !== true), date)}
          >
            <span class="routine__what">
              <span class="bar__name">${it.label}</span>
              ${line(it) && html`<span class="routine__sub">${line(it)}</span>`}
            </span>
            <span class=${`knob ${v === true ? "is-on" : ""}`} aria-hidden="true">
              ${v === true ? "✓" : ""}
            </span>
          </button>`;
        })}
      </div>
    `;
  };

  return html`<section class="routine" aria-label="Today's routine">
    <div class="crest__body">
      <p class="crest__sub num">
        your day · ${relativeDayLabel(date, today)} · ${done} of ${items.length} recorded
      </p>
    </div>
    <div class="chiprow" role="group" aria-label="Which day">
      ${[0, 1, 2].map(
        (n) =>
          html`<button
            key=${n}
            class=${`chip ${back === n ? "is-on" : ""}`}
            aria-pressed=${back === n}
            onClick=${() => setBack(n)}
          >
            ${relativeDayLabel(shiftIsoDate(today, -n), today)}
          </button>`,
      )}
    </div>
    ${group("morning")} ${group("evening")}
  </section>`;
}

/**
 * Settings > Your routine. The button that replaces editing a file:
 *   - START FROM THE DAILY ROUTINE builds the whole spine from three times;
 *   - each row can be removed;
 *   - a new habit is added for today, or queued to start next Sunday (the
 *     habit ramp: one new habit a week, ratified on Sundays).
 * Supplements and water come from the profile and are not edited here.
 *
 * @param {{
 *   routine: import("../lib/routine.js").Routine,
 *   today: string,
 *   onChange: (r: import("../lib/routine.js").Routine) => void
 * }} props
 * @returns {import("preact").VNode}
 */
export function RoutineEditor({ routine, today, onChange }) {
  const [label, setLabel] = useState("");
  const [at, setAt] = useState("");
  const [when, setWhen] = useState(/** @type {"morning" | "evening"} */ ("evening"));
  const [kind, setKind] = useState(/** @type {"tick" | "text"} */ ("tick"));
  const [sunday, setSunday] = useState(true);
  const [wake, setWake] = useState("");
  const [breakfast, setBreakfast] = useState("");
  const [lightsOut, setLightsOut] = useState("");
  const items = routine?.items ?? [];
  const nextSunday = nextSundayFrom(today);
  const starter = starterRoutine({ wake, breakfast, lightsOut });

  /** @param {string} v */
  const time = (v) => {
    // an <input type=time> gives "06:35"; keep the 12-hour form on screen
    const m = /^(\d{2}):(\d{2})$/.exec(v);
    if (!m) return v;
    const h = Number(m[1]);
    return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
  };

  return html`<section class="routine" aria-label="Your routine">
    <div class="band">your routine</div>
    ${
      items.length === 0 &&
      html`<div class="plate">
        <div class="plate__k">start from the daily routine</div>
        <p class="note">
          Three times build the whole morning and evening: wake, weigh in and the check-in, push-ups
          and abs, supplements with breakfast, shower; last plate, tomorrow's first line, phone
          away, read, lights out. Change or remove any row after.
        </p>
        <label class="field"
          >Wake up
          <input
            class="well"
            type="time"
            value=${wake}
            onInput=${(/** @type {any} */ e) => setWake(time(e.currentTarget.value))}
        /></label>
        <label class="field"
          >Breakfast
          <input
            class="well"
            type="time"
            value=${breakfast}
            onInput=${(/** @type {any} */ e) => setBreakfast(time(e.currentTarget.value))}
        /></label>
        <label class="field"
          >Lights out
          <input
            class="well"
            type="time"
            value=${lightsOut}
            onInput=${(/** @type {any} */ e) => setLightsOut(time(e.currentTarget.value))}
        /></label>
        <div class="act">
          <button class="cta" disabled=${!starter} onClick=${() => starter && onChange(starter)}>
            START FROM THE DAILY ROUTINE
          </button>
        </div>
      </div>`
    }
    ${
      items.length > 0 &&
      html`<div class="rack">
        ${items.map(
          (it) =>
            html`<div class="bar" key=${it.id}>
              <span class="routine__what">
                <span class="bar__name">${it.label}</span>
                <span class="routine__sub"
                  >${[
                    it.when,
                    it.at,
                    it.kind === "text" ? "a line of text" : "",
                    it.from && it.from > today ? `starts ${it.from}` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}</span
                >
              </span>
              <button
                class="ghost"
                aria-label=${`Remove ${it.label}`}
                onClick=${() => onChange(removeRoutineItem(routine, it.id))}
              >
                REMOVE
              </button>
            </div>`,
        )}
      </div>`
    }
    <div class="band">add one habit</div>
    <p class="note">
      One new habit a week keeps the ones you have. Queue it for Sunday, or add it today.
    </p>
    <div class="field">
      <input
        class="well"
        type="text"
        placeholder="what to do, e.g. mobility, 10 min"
        aria-label="New routine item"
        value=${label}
        onInput=${(/** @type {any} */ e) => setLabel(e.currentTarget.value)}
      />
      <input
        class="well"
        type="text"
        placeholder="time, e.g. 11:05 pm (optional)"
        aria-label="Time for the new item"
        value=${at}
        onInput=${(/** @type {any} */ e) => setAt(e.currentTarget.value)}
      />
    </div>
    <div class="chiprow" role="group" aria-label="Morning or evening">
      ${/** @type {const} */ (["morning", "evening"]).map(
        (w) =>
          html`<button
            key=${w}
            class=${`chip ${when === w ? "is-on" : ""}`}
            aria-pressed=${when === w}
            onClick=${() => setWhen(w)}
          >
            ${w}
          </button>`,
      )}
      ${/** @type {const} */ (["tick", "text"]).map(
        (k) =>
          html`<button
            key=${k}
            class=${`chip ${kind === k ? "is-on" : ""}`}
            aria-pressed=${kind === k}
            onClick=${() => setKind(k)}
          >
            ${k === "tick" ? "a tick" : "a line of text"}
          </button>`,
      )}
    </div>
    <div class="chiprow" role="group" aria-label="When it starts">
      <button
        class=${`chip ${sunday ? "is-on" : ""}`}
        aria-pressed=${sunday}
        onClick=${() => setSunday(true)}
      >
        ${`+ next Sunday, ${nextSunday.slice(5)}`}
      </button>
      <button
        class=${`chip ${!sunday ? "is-on" : ""}`}
        aria-pressed=${!sunday}
        onClick=${() => setSunday(false)}
      >
        today
      </button>
    </div>
    <div class="act">
      <button
        class="cta"
        disabled=${!label.trim()}
        onClick=${() => {
          onChange(
            addRoutineItem(routine, {
              label,
              when,
              kind,
              at,
              ...(sunday ? { from: nextSunday } : {}),
            }),
          );
          setLabel("");
          setAt("");
        }}
      >
        ADD TO MY ROUTINE
      </button>
    </div>
  </section>`;
}

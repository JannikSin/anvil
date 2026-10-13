import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { recorded, recordedCount, tickPatch } from "../lib/routine.js";
import { relativeDayLabel, shiftIsoDate } from "../lib/dates.js";

/**
 * The day's routine on the Today screen (Core Purpose P14, tenet 6). One tap
 * per item, the whole row is the button, and the day steps back so a late
 * tick is filed against its own date (P4: a late entry is first class).
 * Nothing on this card is ever shown as missed: an untouched item is just
 * an item, never a red one (P9).
 *
 * @param {{
 *   items: import("../lib/routine.js").CardItem[],
 *   daily: { days: Record<string, any>[] },
 *   today: string,
 *   onPatch: (patch: Record<string, any>, date: string) => void
 * }} props
 * @returns {import("preact").VNode | null}
 */
export function RoutineCard({ items, daily, today, onPatch }) {
  const [back, setBack] = useState(0);
  const [texts, setTexts] = useState(/** @type {Record<string, string>} */ ({}));
  if (items.length === 0) return null;
  const date = shiftIsoDate(today, -back);
  const day = (daily?.days ?? []).find((d) => d.date === date) ?? null;
  const done = recordedCount(day, items);

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
            return html`<div class="bar" key=${it.id}>
              <span class="bar__name">${it.label}</span>
              <input
                class="well"
                type="text"
                aria-label=${it.label}
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
              ${it.sub && html`<span class="routine__sub">${it.sub}</span>`}
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
        routine · ${relativeDayLabel(date, today)} · ${done} of ${items.length} recorded
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
 * Settings: the person's own routine items (kitchen closed, tomorrow's first
 * line, reading, a reward). Supplements and water come from the profile and
 * are not edited here. This is the button that replaces editing a file.
 *
 * @param {{
 *   routine: import("../lib/routine.js").Routine,
 *   onChange: (r: import("../lib/routine.js").Routine) => void,
 *   add: typeof import("../lib/routine.js").addRoutineItem,
 *   remove: typeof import("../lib/routine.js").removeRoutineItem
 * }} props
 * @returns {import("preact").VNode}
 */
export function RoutineEditor({ routine, onChange, add, remove }) {
  const [label, setLabel] = useState("");
  const [at, setAt] = useState("");
  const [when, setWhen] = useState(/** @type {"morning" | "evening"} */ ("evening"));
  const [kind, setKind] = useState(/** @type {"tick" | "text"} */ ("tick"));
  const items = routine?.items ?? [];
  return html`<section class="routine" aria-label="Your routine items">
    <div class="band">your routine</div>
    <p class="note">
      Supplements and water come from your profile. Add anything else you want to tick each day.
    </p>
    ${
      items.length > 0 &&
      html`<div class="rack">
        ${items.map(
          (it) =>
            html`<div class="bar" key=${it.id}>
              <span class="bar__name">${it.label}</span>
              <span class="bar__meta num"
                >${`${it.when}${it.at ? ` · ${it.at}` : ""}${it.kind === "text" ? " · text" : ""}`}</span
              >
              <button
                class="ghost"
                aria-label=${`Remove ${it.label}`}
                onClick=${() => onChange(remove(routine, it.id))}
              >
                REMOVE
              </button>
            </div>`,
        )}
      </div>`
    }
    <div class="field">
      <input
        class="well"
        type="text"
        placeholder="what to tick, e.g. read 20 min"
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
      ${
        /** @type {const} */ (["morning", "evening"]).map(
          (w) =>
            html`<button
              key=${w}
              class=${`chip ${when === w ? "is-on" : ""}`}
              aria-pressed=${when === w}
              onClick=${() => setWhen(w)}
            >
              ${w}
            </button>`,
        )
      }
      ${
        /** @type {const} */ (["tick", "text"]).map(
          (k) =>
            html`<button
              key=${k}
              class=${`chip ${kind === k ? "is-on" : ""}`}
              aria-pressed=${kind === k}
              onClick=${() => setKind(k)}
            >
              ${k === "tick" ? "a tick" : "a line of text"}
            </button>`,
        )
      }
    </div>
    <div class="act">
      <button
        class="cta"
        disabled=${!label.trim()}
        onClick=${() => {
          onChange(add(routine, { label, when, kind, at }));
          setLabel("");
          setAt("");
        }}
      >
        ADD TO MY ROUTINE
      </button>
    </div>
  </section>`;
}

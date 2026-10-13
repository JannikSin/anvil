import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { recorded, recordedCount, routineItems, tickPatch } from "../lib/routine.js";

/**
 * The day's routine on the Today screen (Core Purpose P14, tenet 6): a sheet
 * to read first and tick second, in the order the day happens. One fixed
 * routine (David, 2026-10-13), one tap per item, today only: a missed day
 * stays missed (decision 0012). Nothing on
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
  const [texts, setTexts] = useState(/** @type {Record<string, string>} */ ({}));
  // today only (decision 0012): a missed day stays missed
  const date = today;
  const items = routineItems(targets, routine, date);
  if (items.length === 0) {
    return html`<section class="routine" aria-label="Today's routine">
      <p class="note">No routine loaded yet.</p>
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
      <p class="crest__sub num">your day · ${done} of ${items.length} recorded</p>
    </div>
    ${group("morning")} ${group("evening")}
  </section>`;
}

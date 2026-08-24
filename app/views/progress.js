import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { formatSets, personalRecords, primaryLifts, seriesFor } from "../lib/workouts.js";
import { relativeDayLabel } from "../lib/dates.js";
import { weightTrend } from "../lib/weight.js";
import { Sparkline } from "./spark.js";
import { Crest } from "./glyphs.js";

/** @type {Record<string, string>} */
const VERDICT_COPY = {
  "no-data": "no weigh-ins yet",
  building: "building the baseline, needs 7 weigh-ins",
  "on-target": "on target",
  "too-slow": "under the target band",
  "too-fast": "over the target band",
};

/**
 * The record: lift progression, the record book, the sessions filed, and the
 * bodyweight trend.
 *
 * Nothing on this screen can render a missed session, a streak or a percentage
 * of a plan completed. That is P9, and it is a hard constraint on the whole
 * application rather than a default: a person who has missed four days needs
 * the next session, not a number quantifying the four days.
 *
 * @param {{
 *   workouts: { templates: Record<string, any>[], sessions: Record<string, any>[] },
 *   daily: { days: Record<string, any>[] },
 *   targets: Record<string, any> | null,
 *   today: string,
 *   loading: boolean
 * }} props
 * @returns {import("preact").VNode}
 */
export function ProgressView({ workouts, daily, targets, today, loading }) {
  // Which filed session is open. A session used to be one line reading
  // "lower-a · 2026-08-24 · 7 sets", which is the id of a template and a
  // count: it cannot answer "what did I actually lift on Saturday", which is
  // the only question anyone opens this screen to ask. One tap opens the
  // lifts. Nothing is expanded by default — the list is the index, not the
  // record — and the state is per-view because it is a reading position, not
  // data.
  const [openId, setOpenId] = useState(/** @type {string | null} */ (null));
  const nameFor = (/** @type {string | null | undefined} */ id) =>
    workouts.templates.find((t) => t.id === id)?.name ?? id ?? "freeform";
  const prs = personalRecords(/** @type {any} */ (workouts.sessions));
  const phase = targets?.phase === "loss" ? "loss" : "gain";
  const trend = weightTrend(daily.days ?? [], today, phase);

  return html`
    <div class="deck">
      <div class="crest">
        <${Crest} name="progress" />
        <div class="crest__body">
          <h1 class="crest__title">Record</h1>
          <p class="crest__sub">${`${workouts.sessions.length} sessions filed`}</p>
        </div>
      </div>

      <h2 class="band">Bodyweight</h2>
      <div class="plates">
        <div class="plate">
          <div class="plate__k">Now</div>
          <div class="plate__v">
            ${trend.current ?? (loading ? "…" : "—")}
            <small>LB</small>
          </div>
          <div class="plate__d num">
            ${`7-day avg ${trend.avg7 != null ? trend.avg7.toFixed(1) : "—"}`}
          </div>
        </div>
        <div class=${`plate ${trend.verdict === "on-target" ? "" : "plate--warn"}`}>
          <div class="plate__k">${`Trend · ${phase}`}</div>
          <div class="plate__v">
            ${trend.lbPerWeek != null ? `${trend.lbPerWeek > 0 ? "+" : ""}${trend.lbPerWeek.toFixed(2)}` : "—"}
            <small>LB/WK</small>
          </div>
          <div class="plate__d">${VERDICT_COPY[trend.verdict] ?? trend.verdict}</div>
        </div>
      </div>
      <p class="note">
        ${"Weigh-ins come from the shared daily row, so a morning logged in the food app counts here too."}
      </p>

      <h2 class="band">Progression</h2>
      <div class="rack">
        ${
          // Derived from the real programme and the real log. This used to be
          // four hard-coded names carried over from the sibling app, three of
          // which did not exist in this programme, so three of these charts
          // could never plot a point.
          primaryLifts(
            /** @type {any} */ (workouts.templates),
            /** @type {any} */ (workouts.sessions),
          ).map((name) => {
            const series = seriesFor(/** @type {any} */ (workouts.sessions), name);
            return html`
              <div class="chartrow" key=${name}>
                <span class="bar__name">${name}</span>
                <${Sparkline} series=${series} label=${name} loading=${loading} />
              </div>
            `;
          })
        }
        ${
          primaryLifts(
            /** @type {any} */ (workouts.templates),
            /** @type {any} */ (workouts.sessions),
          ).length === 0 && html`<div class="void">${loading ? "loading" : "no lifts yet"}</div>`
        }
      </div>

      <h2 class="band">Record book</h2>
      <div class="rack">
        ${[...prs.entries()].map(
          ([name, pr]) => html`
            <div class="bar" key=${name}>
              <span class="bar__name">${name}</span>
              <span class="bar__meta num">
                ${`${pr.weight > 0 ? pr.weight : "bw"}×${pr.reps} · ${pr.date}`}
              </span>
            </div>
          `,
        )}
        ${
          prs.size === 0 &&
          html`<div class="void">
            ${loading ? "loading" : "file a session to start the record book"}
          </div>`
        }
      </div>

      <h2 class="band">Filed<span class="band__sub">tap one to see the lifts</span></h2>
      <div class="rack">
        ${[...workouts.sessions]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 20)
          .map((s) => {
            const key = String(s.id ?? s.date + (s.templateId ?? ""));
            const open = openId === key;
            const sets = s.exercises.reduce(
              (/** @type {number} */ n, /** @type {any} */ e) => n + e.sets.length,
              0,
            );
            // Tonnage, because it is the one number that separates two sessions
            // with the same set count, and it is arithmetic the app already has
            // every input for. Bodyweight sets contribute nothing to it, which
            // is honest rather than clever: the app does not know what he weighs
            // on a given day and will not guess.
            const volume = s.exercises.reduce(
              (/** @type {number} */ n, /** @type {any} */ e) =>
                n +
                e.sets.reduce(
                  (/** @type {number} */ m, /** @type {any} */ x) =>
                    m + Math.max(0, x.weight) * Math.max(0, x.reps),
                  0,
                ),
              0,
            );
            return html`
              <div class=${`filed ${open ? "is-open" : ""}`} key=${key}>
                <button
                  class="bar"
                  aria-expanded=${open}
                  onClick=${() => setOpenId(open ? null : key)}
                >
                  <span class="bar__name">${nameFor(s.templateId)}</span>
                  <span class="bar__meta num">
                    ${`${relativeDayLabel(s.date, today)} · ${sets} ${sets === 1 ? "set" : "sets"}`}
                  </span>
                </button>
                ${
                  open &&
                  html`<div class="filed__body">
                    <div class="filed__meta num">
                      ${`${s.date}${volume > 0 ? ` · ${volume.toLocaleString()} lb moved` : ""}`}
                    </div>
                    ${s.exercises.map(
                      (/** @type {any} */ e) => html`
                        <div class="filed__lift" key=${e.name}>
                          <span class="filed__liftname">${e.name}</span>
                          <span class="filed__sets num">${formatSets(e.sets)}</span>
                        </div>
                      `,
                    )}
                    ${s.notes && html`<div class="filed__note">${s.notes}</div>`}
                  </div>`
                }
              </div>
            `;
          })}
        ${
          workouts.sessions.length === 0 &&
          html`<div class="void">${loading ? "loading" : "nothing filed yet"}</div>`
        }
      </div>
    </div>
  `;
}

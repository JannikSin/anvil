import { html } from "htm/preact";
import { personalRecords, seriesFor } from "../lib/workouts.js";
import { weightTrend } from "../lib/weight.js";
import { Sparkline } from "./spark.js";

const PRIMARY_LIFTS = ["Squat", "Bench Press", "Deadlift or Barbell Row", "Overhead Press"];

/** @type {Record<string, string>} */
const VERDICT_COPY = {
  "no-data": "no weigh-ins yet",
  building: "building the baseline — needs 7 weigh-ins",
  "on-target": "on target",
  "too-slow": "under the target band",
  "too-fast": "over the target band",
};

/**
 * Progress: lift progression, the record book, recent sessions, and the
 * weight trend.
 *
 * The weight trend is the reason this screen exists. `weightTrend()` has been
 * sitting in Mise since 2026-07-12 with zero consumers anywhere in the app —
 * fully written, fully tested, never once rendered. Here it is finally wired
 * to something a human can see.
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
  const prs = personalRecords(/** @type {any} */ (workouts.sessions));
  const phase = targets?.phase === "loss" ? "loss" : "gain";
  const trend = weightTrend(daily.days ?? [], today, phase);

  return html`
    <div class="view">
      <div class="hero"><h1>Progress</h1></div>

      <h2 class="block-title">Weight</h2>
      <div class="grid">
        <div class="tile">
          <div class="k">Now</div>
          <div class="v num">
            ${trend.current ?? (loading ? "…" : "—")}<small> lb</small>
          </div>
          <div class="d num">7-day avg ${trend.avg7 != null ? trend.avg7.toFixed(1) : "—"}</div>
        </div>
        <div class="tile ${trend.verdict === "on-target" ? "" : "warn"}">
          <div class="k">Trend (${phase})</div>
          <div class="v num">
            ${trend.lbPerWeek != null ? `${trend.lbPerWeek > 0 ? "+" : ""}${trend.lbPerWeek.toFixed(2)}` : "—"}<small>
              lb/wk</small
            >
          </div>
          <div class="d">${VERDICT_COPY[trend.verdict] ?? trend.verdict}</div>
        </div>
      </div>
      <p class="hint">
        weigh-ins come from the shared daily row, so a morning logged in Mise counts here too.
      </p>

      <h2 class="block-title">Progression</h2>
      ${PRIMARY_LIFTS.map((name) => {
        const series = seriesFor(/** @type {any} */ (workouts.sessions), name);
        return html`
          <div class="liftrow chartrow" key=${name}>
            <span class="food">${name}</span>
            <${Sparkline} series=${series} label=${name} loading=${loading} />
          </div>
        `;
      })}

      <h2 class="block-title">PRs</h2>
      <div class="slots">
        ${[...prs.entries()].map(
          ([name, pr]) => html`
            <div class="checkrow static" key=${name}>
              <span class="food">${name}</span>
              <span class="q num">${pr.weight > 0 ? pr.weight : "bw"}×${pr.reps} · ${pr.date}</span>
            </div>
          `,
        )}
        ${
          prs.size === 0 &&
          html`<div class="empty">
            ${loading ? "loading…" : "log a session to start the record book"}
          </div>`
        }
      </div>

      <h2 class="block-title">Sessions</h2>
      <div class="slots">
        ${[...workouts.sessions]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 14)
          .map(
            (s) => html`
              <div class="checkrow static" key=${s.id ?? s.date + (s.templateId ?? "")}>
                <span class="food">${s.templateId ?? "freeform"}</span>
                <span class="q num">
                  ${`${s.date} · ${s.exercises.reduce(
                    (/** @type {number} */ n, /** @type {any} */ e) => n + e.sets.length,
                    0,
                  )} sets`}
                </span>
              </div>
            `,
          )}
        ${
          workouts.sessions.length === 0 &&
          html`<div class="empty">${loading ? "loading…" : "nothing logged yet"}</div>`
        }
      </div>
    </div>
  `;
}

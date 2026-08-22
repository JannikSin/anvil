import { html } from "htm/preact";
import { latestWith, series, average, sparkPoints, latestEkg } from "../lib/vitals.js";
import { Ring } from "./ring.js";
import { Crest } from "./glyphs.js";

/**
 * The watch: a read-only mirror of Apple Health. Populated by the Health Auto
 * Export app posting to Anvil's Worker, which writes vitals.json (a PWA cannot
 * read HealthKit itself), so an empty file is the normal pre-connection state
 * and not an error.
 *
 * Each metric is a ring. THE RING IS THE OBSERVED 14-DAY RANGE, not a goal:
 * a full ring means "the highest this has been in a fortnight", an empty one
 * means the lowest. No threshold on this screen was invented, because inventing
 * one would make the app quietly grade a person against a number nobody chose,
 * and this application does not grade people.
 *
 * @param {{ vitals: import("../lib/vitals.js").Vitals | null, loading: boolean, hasToken: boolean, today: string }} props
 * @returns {import("preact").VNode}
 */
export function VitalsView({ vitals, loading, hasToken, today }) {
  const days = vitals?.days ?? [];
  const ekg = latestEkg(vitals?.ekg ?? []);

  // Is this feed actually live? Health Auto Export posts on a schedule, so a
  // newest row more than a few days old means the pipe is dead, not that
  // nobody moved. This matters more than it looks: the file this app reads
  // still contains the seven SEED rows written to prove the endpoint worked,
  // and a screen rendering month-old invented numbers as if they were this
  // morning's is worse than a blank one.
  const newest = days.length ? String(days[days.length - 1]?.date ?? "") : "";
  const staleDays = (() => {
    if (!newest || !today) return null;
    const ms = new Date(`${today}T00:00:00`).getTime() - new Date(`${newest}T00:00:00`).getTime();
    return Number.isFinite(ms) ? Math.round(ms / 86400000) : null;
  })();
  const stale = staleDays !== null && staleDays > 3;

  /**
   * @param {string} label
   * @param {keyof import("../lib/vitals.js").VitalsDay} field
   * @param {string} unit
   * @param {(v: number) => string} fmt
   * @param {boolean} spark
   */
  const gauge = (label, field, unit, fmt, spark) => {
    const latest = latestWith(days, field);
    if (!latest) return null;
    const pts = spark ? series(days, field, 14) : [];
    const decimals = field === "distanceMi" || field === "hrvMs" ? 1 : 0;
    const avg = pts.length > 2 ? average(pts, decimals) : null;
    const poly = sparkPoints(pts, 120, 26);

    // where the latest reading sits inside the fortnight's own range
    const values = pts.map((p) => p.value);
    const lo = values.length ? Math.min(...values) : null;
    const hi = values.length ? Math.max(...values) : null;
    const frac =
      lo == null || hi == null || pts.length < 3
        ? 1
        : hi === lo
          ? 1
          : (latest.value - lo) / (hi - lo);

    return html`
      <div class="gauge" key=${field}>
        <div class="gauge__k">${label}</div>
        <div class="gauge__face">
          <${Ring} frac=${frac} width=${6} tone="ion" />
          <div>
            <div class="gauge__v">${fmt(latest.value)}</div>
            ${unit && html`<span class="gauge__u">${unit}</span>`}
          </div>
        </div>
        ${
          poly &&
          html`<svg
            class="gauge__trace"
            viewBox="0 0 120 26"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polyline points=${poly} fill="none" stroke="currentColor" stroke-width="1.6" />
          </svg>`
        }
        <div class="gauge__d">
          ${
            avg !== null && lo != null && hi != null
              ? `14d avg ${fmt(avg)} · range ${fmt(lo)}–${fmt(hi)}`
              : `as of ${latest.date}`
          }
        </div>
      </div>
    `;
  };

  const tiles = [
    gauge("Steps", "steps", "", (v) => v.toLocaleString("en-US"), true),
    gauge("Distance", "distanceMi", "mi", (v) => v.toFixed(1), true),
    gauge("Active", "activeKcal", "kcal", (v) => Math.round(v).toLocaleString("en-US"), true),
    gauge("Resting HR", "restingHR", "bpm", (v) => String(Math.round(v)), true),
    gauge("HRV", "hrvMs", "ms", (v) => v.toFixed(0), true),
    gauge("Sleep", "sleepHours", "h", (v) => v.toFixed(1), true),
    gauge("VO₂ max", "vo2max", "", (v) => v.toFixed(1), false),
  ].filter(Boolean);

  return html`
    <div class="deck">
      ${
        stale &&
        html`<p class="alarm alarm--hot">
          ${`NOT LIVE. The newest row here is ${staleDays} days old (${newest}), so nothing is arriving from the watch. Anything below is history, not today. Fix: install Health Auto Export and point it at Anvil's Worker.`}
        </p>`
      }
      <div class="crest">
        <${Crest} name="vitals" />
        <div class="crest__body">
          <h1 class="crest__title">Watch</h1>
          <p class="crest__sub">${newest ? `last row ${newest}` : "nothing posted yet"}</p>
        </div>
      </div>
      ${loading && html`<p class="note">loading…</p>`}
      ${
        !loading &&
        tiles.length === 0 &&
        html`<div class="void">
          ${
            hasToken
              ? "no watch data yet — connect the export automation that posts to vitals.json"
              : "connect a token in Rig"
          }
        </div>`
      }
      ${tiles.length > 0 && html`<div class="gauges">${tiles}</div>`}
      ${
        ekg &&
        html`
          <h2 class="band">Latest EKG</h2>
          <div class="rack">
            <div class="bar">
              <span class="bar__name">${ekg.result}</span>
              <span class="bar__meta num">
                ${`${ekg.avgBpm ? `${ekg.avgBpm} bpm · ` : ""}${ekg.date}`}
              </span>
            </div>
          </div>
        `
      }
      <p class="note">
        ${"Read-only mirror of Apple Health, written by Anvil's Worker. Nothing on this screen is editable, and no ring here is a target: each one shows where the latest reading sits inside its own last fortnight."}
      </p>
    </div>
  `;
}

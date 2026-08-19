import { html } from "htm/preact";

// Progression sparkline, ported verbatim from mise app/views/fitness.js.


/**
 * Single-series progression sparkline (dataviz: 2px line, endpoint marker,
 * values as adjacent text in text tokens, aria summary, no legend needed).
 * @param {{ series: { date: string, top: number }[], label: string, loading: boolean }} props
 */
export function Sparkline({ series, label, loading }) {
  if (series.length < 2) {
    return html`<div class="spark-empty hint">
      ${
        loading
          ? "loading…"
          : series.length === 1
            ? `one session — ${series[0]?.top || "bw"}`
            : "no sessions yet"
      }
    </div>`;
  }
  const W = 100;
  const H = 28;
  const PAD = 3;
  const tops = series.map((p) => p.top);
  const min = Math.min(...tops);
  const max = Math.max(...tops);
  const span = max - min || 1;
  const x = (/** @type {number} */ i) => PAD + (i * (W - 2 * PAD)) / (series.length - 1);
  const y = (/** @type {number} */ v) => H - PAD - ((v - min) * (H - 2 * PAD)) / span;
  const points = series.map((p, i) => `${x(i).toFixed(1)},${y(p.top).toFixed(1)}`).join(" ");
  const last = series[series.length - 1];
  const desc = `${label}: ${series.length} sessions, ${series[0]?.top} to ${last?.top}, best ${max}`;
  return html`
    <div class="spark">
      <svg viewBox="0 0 ${W} ${H}" class="sparksvg" role="img" aria-label=${desc}>
        <line x1="0" y1=${H - 1} x2=${W} y2=${H - 1} class="spark-base" />
        <polyline points=${points} class="spark-line" />
        <circle cx=${x(series.length - 1)} cy=${y(last?.top ?? min)} r="2.5" class="spark-dot" />
      </svg>
      <span class="spark-vals num">${last?.top} <small>best ${max}</small></span>
    </div>
  `;
}


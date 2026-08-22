import { html } from "htm/preact";

// The one radial primitive. Everything in Anvil that is being consumed —
// a rest interval, a timed move, a tier's cost in minutes, a day's steps
// against a norm — is drawn as an arc eating a ring, and all of it comes
// through here so the stroke weights, the cap and the start angle can never
// drift apart between screens.
//
// Plain SVG with stroke-dasharray rather than a conic-gradient: conic
// gradients cannot be given a round cap, cannot be animated smoothly in
// Safari, and degrade to a hard-edged pie on the older iOS this app is
// actually opened on. The whole element is rotated -90deg in CSS so an arc
// starts at twelve o'clock, which is the only place a countdown may start.

const R = 44;
const C = 2 * Math.PI * R;

/**
 * @param {{
 *   frac?: number,
 *   tone?: "arc" | "ion" | "ember",
 *   width?: number,
 *   tick?: number | null,
 *   label?: string
 * }} props
 */
export function Ring({ frac = 0, tone = "arc", width = 6, tick = null, label }) {
  // clamped, because a timer that overruns must show a full ring rather than
  // an arc that wraps back around and reads as nearly empty
  const f = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
  const tickAt = tick == null ? null : Math.max(0, Math.min(1, tick));
  const point = (/** @type {number} */ at, /** @type {number} */ r) => {
    const a = at * 2 * Math.PI;
    return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
  };
  const inner = point(tickAt ?? 0, R - width / 2 - 1);
  const outer = point(tickAt ?? 0, R + width / 2 + 1);

  return html`
    <svg
      class=${`ring ring--${tone}`}
      viewBox="0 0 100 100"
      role=${label ? "img" : "presentation"}
      aria-label=${label}
      aria-hidden=${label ? undefined : "true"}
    >
      <circle class="ring__track" cx="50" cy="50" r=${R} style=${`stroke-width:${width}`} />
      <circle
        class="ring__arc"
        cx="50"
        cy="50"
        r=${R}
        style=${`stroke-width:${width}`}
        stroke-dasharray=${C.toFixed(2)}
        stroke-dashoffset=${(C * (1 - f)).toFixed(2)}
      />
      ${
        tickAt != null &&
        html`<line
          class="ring__tick"
          x1=${inner.x.toFixed(2)}
          y1=${inner.y.toFixed(2)}
          x2=${outer.x.toFixed(2)}
          y2=${outer.y.toFixed(2)}
        />`
      }
    </svg>
  `;
}

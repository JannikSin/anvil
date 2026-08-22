import { html } from "htm/preact";

// The icon set. Drawn here rather than pulled from a font or a sprite for the
// same reason the figures are: the app ships under a strict CSP with no
// external hosts and every byte is precached for a gym with no signal.
//
// All five are built from the same two elements — a circle and a straight
// stroke — at one weight, so the tab rail reads as one instrument and not as
// five borrowed pictograms. The old rail used ▲ ◇ ◫ ◉ ☰ typed as text, which
// renders at a different size, weight and baseline on every phone.

/** @type {Record<string, () => any>} */
const PATHS = {
  // a loaded bar, seen end-on: the plates are the circles
  today: () => html`
    <circle cx="5.5" cy="12" r="3.2" />
    <circle cx="18.5" cy="12" r="3.2" />
    <path d="M8.7 12h6.6" />
    <path d="M2 9.6v4.8M22 9.6v4.8" />
  `,
  // floor work: a body on a mat, drawn as expanding arcs from a single point
  floor: () => html`
    <path d="M12 20.5h9" />
    <circle cx="7" cy="8.5" r="2.4" />
    <path d="M9.2 9.6c3.4 1.4 6.6 2.9 9.8 4.4" />
    <path d="M4.4 20.5h4.2" />
    <path d="M9.4 10.4 7.2 20.5" />
  `,
  // progression: an arc climbing out of a ring, with the newest point on it
  progress: () => html`
    <path d="M3.2 19.4A11 11 0 0 1 20 8.6" />
    <path d="M3.2 19.4h17.6" />
    <circle cx="20" cy="8.6" r="2.1" />
    <path d="M8.4 19.4v-4.2M13 19.4v-7" />
  `,
  // vitals: a pulse crossing a ring
  vitals: () => html`
    <circle cx="12" cy="12" r="8.6" />
    <path d="M6 12h2.4l1.6-3.4 2.6 6.8L14.4 12H18" />
  `,
  // settings: a bezel — a ring with the calibration ticks around it
  system: () => html`
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1.8v2.6M12 19.6v2.6M22.2 12h-2.6M4.4 12H1.8" />
    <path d="M19.2 4.8 17.4 6.6M6.6 17.4l-1.8 1.8M19.2 19.2l-1.8-1.8M6.6 6.6 4.8 4.8" />
  `,
};

/**
 * A 24×24 line glyph. Unknown names render nothing rather than a broken box.
 * @param {{ name: string, size?: number }} props
 */
export function Glyph({ name, size = 24 }) {
  const draw = PATHS[name];
  if (!draw) return null;
  return html`
    <svg
      viewBox="0 0 24 24"
      width=${size}
      height=${size}
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      ${draw()}
    </svg>
  `;
}

/**
 * The section emblem: the screen's own glyph sitting inside a ring with a gap
 * struck out of the top of it. Same ring the rest of the app uses to mean
 * "this is measured", so a page header and a rest timer are visibly relatives.
 * @param {{ name: string }} props
 */
export function Crest({ name }) {
  return html`
    <svg class="crest__ring" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle
        cx="24"
        cy="24"
        r="21"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-dasharray="98 34"
        stroke-dashoffset="66"
        opacity="0.55"
      />
      <circle cx="24" cy="24" r="17" stroke="currentColor" stroke-width="0.8" opacity="0.22" />
      <g transform="translate(12 12)">
        <g
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        >
          ${(PATHS[name] ?? PATHS.today ?? (() => null))()}
        </g>
      </g>
    </svg>
  `;
}

/** The wordmark lamp in the status bar: an anvil reduced to three strokes. */
export function Sigil() {
  return html`
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 8.5h11.5l4.2 3.2H21l-2.6 3.1H7.4L3 11.2z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path
        d="M9.5 14.8v2.4l-2.3 2.3h9l-2.3-2.3v-2.4"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

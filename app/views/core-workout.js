import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { CORE_SESSIONS, coreStepAt, LEAD_IN, sessionForDay, sessionSeconds } from "../lib/core.js";
import { CoreFigure } from "./core-figure.js";
import { Ring } from "./ring.js";
import { keepAwake } from "../lib/awake.js";
import { pickForTraining } from "../lib/music.js";
import { localIsoDate } from "../lib/dates.js";

/** short beep via WebAudio — no asset, no CSP issue. Three tones: high =
 * new exercise, mid = the last 3 seconds ticking, low double = all done.
 * Fails silently where audio is blocked (the vibration still fires). */
function beep(/** @type {"phase" | "tick" | "done"} */ kind) {
  try {
    const Ctx = window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext;
    const ctx = new Ctx();
    const times = kind === "done" ? [0, 0.25] : [0];
    for (const t of times) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = kind === "done" ? 440 : kind === "tick" ? 660 : 880;
      gain.gain.setValueAtTime(kind === "tick" ? 0.12 : 0.2, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        ctx.currentTime + t + (kind === "tick" ? 0.1 : 0.18),
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.2);
    }
    setTimeout(() => void ctx.close(), 800);
  } catch {
    /* audio blocked — vibration covers it */
  }
}

/** "45s" / "1:30" */
const dur = (/** @type {number} */ s) =>
  s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`;

const titleOf = (/** @type {any} */ step) =>
  step ? `${step.name}${step.side ? ` · ${step.side === "L" ? "LEFT" : "RIGHT"}` : ""}` : "";

/**
 * A directed timed session: pick one, press START, and it calls every move,
 * counts it down and moves itself on. The screen stays awake while it runs.
 *
 * Generalised 2026-08-18 from "the core session" to any list of timed steps,
 * so warm-ups and mobility run on the same engine rather than getting a second
 * timer written for them. The engine was the hard-won part: it derives from a
 * start timestamp so backgrounding never drifts it, beeps and buzzes on every
 * change, ticks the last three seconds, and previews the next move during rest.
 *
 * @param {{
 *   open?: boolean,
 *   sessions?: import("../lib/core.js").CoreSession[],
 *   title?: string,
 *   subtitle?: string,
 *   rotate?: boolean
 * }} props
 */
export function CoreWorkout({
  open = false,
  sessions = CORE_SESSIONS,
  title = "🧱 Core session",
  subtitle = "floor, no kit, it calls every move",
  rotate = true,
}) {
  const today = localIsoDate(new Date());
  const [pickedId, setPickedId] = useState(/** @type {string | null} */ (null));
  // rotate=false (warm-ups, mobility): no day-of-week pick, first is default.
  // Nothing here should imply a schedule the lifting programme no longer has.
  // Every caller passes a non-empty list, so the cast states that rather than
  // scattering optional chaining through the render.
  const CS = (/** @type {any} */ x) => /** @type {import("../lib/core.js").CoreSession} */ (x);
  const dayPick = CS(rotate ? sessionForDay(today, sessions) : sessions[0]);
  const session = CS(sessions.find((s) => s.id === pickedId) ?? dayPick);
  // null = idle; { startedAt, elapsed } drives everything else
  const [run, setRun] = useState(
    /** @type {{ startedAt: number | null, elapsed: number } | null} */ (null),
  );
  const [, forceTick] = useState(0);
  const lastPhaseRef = useRef("");
  const lastTickRef = useRef(-1);
  const [tune, setTune] = useState(0);

  const elapsed = run
    ? run.elapsed + (run.startedAt != null ? (Date.now() - run.startedAt) / 1000 : 0)
    : 0;
  const at = coreStepAt(Math.floor(elapsed), session.steps, LEAD_IN);
  const running = Boolean(run && run.startedAt != null);
  const total = sessionSeconds(session);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => forceTick((n) => n + 1), 250);
    // one shared implementation, which RE-ACQUIRES when you come back to the
    // app. The old inline version dropped the lock the first time the phone
    // was glanced away from and never asked for it again, so a session longer
    // than one glance ended with the screen asleep.
    const release = keepAwake();
    // a backgrounded tab has its timers throttled to about once a minute, so
    // coming back to the app can show a stale number for a beat. The clock
    // itself is derived from the start timestamp and was never wrong, but the
    // PAINT was, so repaint the moment the tab is looked at again.
    const onVisible = () => forceTick((n) => n + 1);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      release();
    };
  }, [running]);

  // cues: a beep and a buzz when the exercise changes, a quieter tick through
  // the last 3 seconds so you can finish a hold without looking at the phone
  useEffect(() => {
    if (!run) {
      lastPhaseRef.current = "";
      lastTickRef.current = -1;
      return;
    }
    const key = `${at.phase}|${at.index}`;
    if (lastPhaseRef.current && lastPhaseRef.current !== key) {
      beep(at.phase === "done" ? "done" : "phase");
      if ("vibrate" in navigator) navigator.vibrate(at.phase === "done" ? [200, 100, 200] : 150);
    }
    lastPhaseRef.current = key;
    const left = Math.ceil(at.remaining);
    if (at.phase !== "done" && left <= 3 && left > 0 && left !== lastTickRef.current) {
      lastTickRef.current = left;
      beep("tick");
    }
    if (at.phase === "done" && run.startedAt != null) setRun({ startedAt: null, elapsed });
  }, [at.phase, at.index, Math.ceil(at.remaining), run !== null]);

  const start = () => {
    lastPhaseRef.current = "";
    lastTickRef.current = -1;
    setRun({ startedAt: Date.now(), elapsed: 0 });
  };

  // SKIP jumps the clock to the start of the next step, so the rest of the
  // session keeps its own timings instead of being shifted by a partial step
  const skip = () => {
    const steps = session.steps;
    let mark = LEAD_IN;
    for (let i = 0; i <= at.index && i < steps.length; i++) {
      if (i < 0) continue;
      const s = /** @type {any} */ (steps[i]);
      mark += s.seconds + (steps[i + 1] ? s.rest : 0);
    }
    setRun({ startedAt: running ? Date.now() : null, elapsed: mark });
  };

  // What the ring is a fraction of, per phase. A countdown drawn against the
  // wrong span is worse than no ring: it would read as nearly done at the start
  // of a long hold.
  const span =
    at.phase === "ready"
      ? LEAD_IN
      : at.phase === "work"
        ? (at.step?.seconds ?? 1)
        : at.phase === "rest"
          ? (at.step?.rest ?? 1)
          : 1;
  const frac = at.phase === "done" ? 1 : span > 0 ? at.remaining / span : 0;

  return html`
    <details class="block" open=${open}>
      <summary class="band">${title}<span class="band__sub">${subtitle}</span></summary>

      ${
        run === null &&
        html`
          <div class="chiprow" role="group" aria-label="Which session">
            ${sessions.map(
              (s) => html`
                <button
                  key=${s.id}
                  class=${session.id === s.id ? "chip is-on" : "chip"}
                  aria-pressed=${session.id === s.id}
                  onClick=${() => setPickedId(s.id)}
                >
                  ${s.name}${rotate && dayPick.id === s.id ? " · today" : ""}
                </button>
              `,
            )}
          </div>
          <p class="note">
            ${`${session.focus}. ${session.steps.length} moves, ${dur(total)} including rest. ${session.note}`}
          </p>
          <div class="rack">
            ${session.steps.map(
              (/** @type {any} */ s, /** @type {number} */ i) => html`
                <div class="bar figrow" key=${`${s.name}-${i}`}>
                  <${CoreFigure} name=${s.name} small=${true} />
                  <span class="bar__name">${titleOf(s)}</span>
                  <span class="bar__meta num">
                    ${`${dur(s.seconds)}${s.rest > 0 ? ` · ${s.rest}s rest` : " · straight in"}`}
                  </span>
                </div>
              `,
            )}
          </div>
        `
      }
      ${
        run !== null &&
        html`
          <div class=${`timer ${at.phase}`} role="timer" aria-live="polite">
            <div class="timer__phase">
              ${
                at.phase === "done"
                  ? "SESSION COMPLETE"
                  : at.phase === "ready"
                    ? "GET READY · FIRST UP"
                    : at.phase === "rest"
                      ? "REST · NEXT UP"
                      : `${at.index + 1}/${session.steps.length} · ${dur(Math.ceil(at.workLeft))} of work left`
              }
            </div>
            <div class="timer__name">
              ${
                at.phase === "done"
                  ? session.name
                  : at.phase === "ready"
                    ? titleOf(at.next)
                    : at.phase === "rest"
                      ? titleOf(at.next)
                      : titleOf(at.step)
              }
            </div>
            <div class="timer__face">
              <${Ring}
                frac=${frac}
                width=${5}
                tone=${at.phase === "work" ? "arc" : "ion"}
                label=${`${Math.ceil(at.remaining)} seconds left`}
              />
              <div class="timer__inner">
                <div class="timer__clock num">
                  ${at.phase === "done" ? "✓" : String(Math.ceil(at.remaining))}
                </div>
              </div>
            </div>
            ${
              // the figure for whatever is being asked for NEXT: during the
              // lead-in and during a rest that is the move about to start, so
              // the shape is on screen before you have to be in it
              at.phase !== "done" &&
              html`<${CoreFigure} name=${(at.phase === "work" ? at.step : at.next)?.name ?? ""} />`
            }
            ${
              // the cue shows during the lead-in and the rest as well, which
              // is the actual fix: you read it BEFORE you are in position
              at.phase !== "done" &&
              (at.phase === "work" ? at.step : at.next) &&
              html`<p class="timer__cue">
                ${/** @type {any} */ (at.phase === "work" ? at.step : at.next).cue}
              </p>`
            }
            ${
              at.phase === "work" &&
              at.next &&
              at.step &&
              at.step.rest === 0 &&
              html`<p class="timer__cue">${`Straight into ${titleOf(at.next)}, no rest.`}</p>`
            }
            ${
              at.phase === "done" &&
              html`<p class="timer__cue">
                ${`${session.steps.length} moves done.${
                  rotate
                    ? ` Tomorrow's rotation: ${sessionForDay(localIsoDate(new Date(Date.now() + 86400000)), sessions).name}.`
                    : ""
                }`}
              </p>`
            }
          </div>
          <div class="timer__acts">
            ${
              at.phase !== "done" &&
              html`
                <button
                  class="ghost"
                  onClick=${() =>
                    running
                      ? setRun({ startedAt: null, elapsed })
                      : setRun({ startedAt: Date.now(), elapsed: run.elapsed })}
                >
                  ${running ? "PAUSE" : "RESUME"}
                </button>
                <button class="ghost" onClick=${skip}>SKIP</button>
              `
            }
            <button class="ghost" onClick=${() => setRun(null)}>
              ${at.phase === "done" ? "BACK" : "STOP"}
            </button>
          </div>
        `
      }
      ${
        run === null &&
        html`
          <button class="startdial" onClick=${start}>
            <span class="startdial__word">START</span>
            <span class="startdial__len num">${dur(total)}</span>
          </button>
          ${(() => {
            const p = pickForTraining(tune);
            return html`<div class="act">
              <a class="ghost" href=${p.url} rel="noopener noreferrer">${p.label}</a>
              <button
                class="linkish"
                aria-label="Suggest something else"
                onClick=${() => setTune(tune + 1)}
              >
                ${"something else ↻"}
              </button>
            </div>`;
          })()}
        `
      }
    </details>
  `;
}

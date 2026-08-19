import { html } from "htm/preact";
import { CoreWorkout } from "./core-workout.js";
import { CORE_SESSIONS } from "../lib/core.js";
import { MOBILITY_SESSIONS, PREHAB_SESSIONS, WARMUPS } from "../lib/routines.js";

/**
 * Floor work: the three families of timed session, all driven by the same
 * engine and all runnable with no equipment.
 *
 *   CORE      the four ab/trunk sessions, on a daily rotation
 *   MOBILITY  static holds, placed after training or on a rest day
 *   WARM-UP   dynamic, before lifting, also reachable from Today
 *
 * The order on the page is deliberate: core is the daily habit and goes
 * first; warm-up sits last here because its real home is the Today screen,
 * one tap from the session it warms up for. This page is where you go to run
 * one on purpose.
 * @returns {import("preact").VNode}
 */
export function CoreView() {
  return html`
    <div class="view">
      <div class="hero"><h1>Floor</h1></div>

      <${CoreWorkout}
        open=${true}
        sessions=${CORE_SESSIONS}
        title="🧱 Core"
        subtitle="abs and trunk, 4-6 min, daily rotation"
      />

      <${CoreWorkout}
        sessions=${MOBILITY_SESSIONS}
        title="🧘 Mobility + stretch"
        subtitle="static holds — after training, never before"
        rotate=${false}
      />

      <${CoreWorkout}
        sessions=${PREHAB_SESSIONS}
        title="🛡️ Shoulder prehab"
        subtitle="after tennis or on a rest day, never on a press day"
        rotate=${false}
      />

      <${CoreWorkout}
        sessions=${WARMUPS}
        title="🔥 Warm-up"
        subtitle="dynamic, 3-4 min, before you lift"
        rotate=${false}
      />

      <p class="hint">
        Static stretching before a heavy session measurably lowers force output, so the warm-ups
        here hold nothing and the stretching lives in mobility, on purpose.
      </p>
    </div>
  `;
}

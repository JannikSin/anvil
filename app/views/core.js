import { html } from "htm/preact";
import { CoreWorkout } from "./core-workout.js";
import { CORE_SESSIONS } from "../lib/core.js";
import { MOBILITY_SESSIONS, PREHAB_SESSIONS, WARMUPS } from "../lib/routines.js";
import { Crest } from "./glyphs.js";

/**
 * Floor work: the four families of timed session, all driven by the same
 * engine and all runnable with no equipment.
 *
 *   CORE      the ab/trunk sessions, on a daily rotation
 *   MOBILITY  static holds, placed after training or on a rest day
 *   PREHAB    shoulders, after tennis or on a rest day
 *   WARM-UP   dynamic, before lifting, also reachable from the Bar screen
 *
 * The order is deliberate: core is the daily habit and goes first; warm-up
 * sits last because its real home is the Bar screen, one press from the session
 * it warms up for. This screen is where you go to run one on purpose.
 * @returns {import("preact").VNode}
 */
export function CoreView() {
  return html`
    <div class="deck">
      <div class="crest">
        <${Crest} name="floor" />
        <div class="crest__body">
          <h1 class="crest__title">Floor</h1>
          <p class="crest__sub">no kit · it calls every move</p>
        </div>
      </div>

      <${CoreWorkout}
        open=${true}
        sessions=${CORE_SESSIONS}
        title="Core"
        subtitle="abs and trunk, 4-6 min, daily rotation"
      />

      <${CoreWorkout}
        sessions=${MOBILITY_SESSIONS}
        title="Mobility"
        subtitle="static holds, after training, never before"
        rotate=${false}
      />

      <${CoreWorkout}
        sessions=${PREHAB_SESSIONS}
        title="Shoulder prehab"
        subtitle="after tennis or on a rest day, never on a press day"
        rotate=${false}
      />

      <${CoreWorkout}
        sessions=${WARMUPS}
        title="Warm-up"
        subtitle="dynamic, 3-4 min, before you lift"
        rotate=${false}
      />

      <p class="note">
        ${"Static stretching before a heavy session measurably lowers force output, so the warm-ups here hold nothing and the stretching lives in mobility, on purpose."}
      </p>
    </div>
  `;
}

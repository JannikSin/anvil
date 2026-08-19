import { html } from "htm/preact";
import { CoreWorkout } from "./core-workout.js";

/**
 * Core: the directed floor sessions with the step timer and the wake lock.
 * In Mise this was mounted at the bottom of the Train tab, where it competed
 * for the same screen as set entry; here it gets its own tab, because you are
 * on the floor and not touching the phone while it runs.
 * @returns {import("preact").VNode}
 */
export function CoreView() {
  return html`
    <div class="view">
      <div class="hero"><h1>Core</h1></div>
      <${CoreWorkout} />
    </div>
  `;
}

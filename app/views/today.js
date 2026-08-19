import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { tokenBroken } from "../lib/github.js";
import {
  formatSets,
  lastSetsFor,
  nextInRotation,
  progressionFor,
  sessionsOn,
  setTopSet,
} from "../lib/workouts.js";
import { warmupFor } from "../lib/routines.js";
import { CoreWorkout } from "./core-workout.js";

const REST_SECONDS = 90;

/**
 * Today: what is on, the set-entry form for it, and the fitness half of the
 * daily check-in. Merged from Mise's TRAIN segment and the check-in row that
 * used to live on Mise's Home tab.
 *
 * Deliberately ONE screen rather than the Today/Log pair the build spec drew.
 * Logging happens between sets with a bar racked and forearms pumped; making
 * David change tab to enter the number he just lifted is a tap he would pay
 * for forty times a session.
 *
 * @param {{
 *   workouts: { templates: Record<string, any>[], sessions: Record<string, any>[], schedule?: Record<string, string | null>, baselines?: Record<string, any> },
 *   daily: { days: Record<string, any>[] },
 *   targets: Record<string, any> | null,
 *   today: string,
 *   hasToken: boolean,
 *   repo: Record<string, any> | null,
 *   loading: boolean,
 *   draft: { templateId: string | null, session: Record<string, any> | null, inputs: Record<string, { w: string, r: string }> },
 *   onDraft: (d: { templateId: string | null, session: Record<string, any> | null, inputs: Record<string, { w: string, r: string }> }) => void,
 *   onSaveSession: (session: Record<string, any>) => void,
 *   onOpenCheckin: () => void
 * }} props
 * @returns {import("preact").VNode}
 */
export function TodayView({
  workouts,
  daily,
  targets,
  today,
  hasToken,
  repo,
  loading,
  draft,
  onDraft,
  onSaveSession,
  onOpenCheckin,
}) {
  const [rest, setRest] = useState(0);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [invalid, setInvalid] = useState(/** @type {string | null} */ (null));
  const [showPicker, setShowPicker] = useState(false);
  const restRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null));

  useEffect(() => {
    return () => {
      if (restRef.current) clearInterval(restRef.current);
    };
  }, []);

  const startRest = () => {
    if (restRef.current) clearInterval(restRef.current);
    setRest(REST_SECONDS);
    restRef.current = setInterval(() => {
      setRest((r) => {
        if (r <= 1 && restRef.current) clearInterval(restRef.current);
        return Math.max(0, r - 1);
      });
    }, 1000);
  };

  const { session, inputs } = draft;
  // Today's session comes from the fixed rotation — nothing to pick.
  // draft.templateId is only set when David explicitly overrides through the
  // escape hatch, and that pick wins over the schedule for this draft.
  const hasSchedule = workouts.schedule !== undefined;
  // POSITION in the rotation, not the day of the week. A missed Monday used to
  // delete Lower A outright, because Tuesday showed Pull A; now it just makes
  // Lower A the next thing whenever he next trains. Nothing in the app can
  // say he is behind, because behind is no longer representable.
  const scheduled = nextInRotation(
    workouts.schedule,
    /** @type {any} */ (workouts.templates),
    /** @type {any} */ (workouts.sessions),
  );
  const doneToday = sessionsOn(/** @type {any} */ (workouts.sessions), today);
  const pickedTemplate = draft.templateId
    ? workouts.templates.find((t) => t.id === draft.templateId)
    : null;
  const template = hasSchedule ? (pickedTemplate ?? scheduled) : pickedTemplate;
  const tokenBad = tokenBroken(repo?.auth);
  const baselines = /** @type {Record<string, any>} */ (workouts.baselines ?? {});
  const todayRow = (daily.days ?? []).find((d) => d.date === today) ?? {};

  const logSet = (/** @type {string} */ name) => {
    const inp = inputs[name] ?? { w: "", r: "" };
    const weight = Number(inp.w);
    const reps = Number(inp.r);
    // a BLANK weight is invalid (0 must be an explicit bodyweight entry) —
    // silently logging 0 would corrupt PRs for weighted lifts
    if (
      inp.w.trim() === "" ||
      !Number.isFinite(weight) ||
      weight < 0 ||
      !Number.isInteger(reps) ||
      reps <= 0
    ) {
      setInvalid(name);
      setTimeout(() => setInvalid(null), 1200);
      return;
    }
    const base = session ?? { date: today, templateId: template?.id ?? null, exercises: [] };
    onDraft({
      ...draft,
      session: setTopSet(/** @type {any} */ (base), name, { weight, reps }),
    });
    startRest();
  };

  const finishSession = () => {
    if (!session || session.exercises.length === 0) return;
    if (!confirmFinish) {
      setConfirmFinish(true);
      setTimeout(() => setConfirmFinish(false), 4000);
      return;
    }
    onSaveSession(session);
    onDraft({ templateId: null, session: null, inputs: {} });
    setConfirmFinish(false);
    setShowPicker(false);
  };

  return html`
    <div class="view">
      ${rest > 0 && html`<div class="restpill num" role="timer">REST ${rest}s</div>`}
      <div class="hero"><h1>Today</h1></div>

      ${
        tokenBad &&
        html`<p class="hint">
          not syncing — token needs fixing in Settings (sets still save locally)
        </p>`
      }
      ${
        // Cold start. A fresh install has no schedule because it has no TOKEN,
        // not because the schedule is missing: David's six-day split has been
        // sitting in anvil-data the whole time. Telling him to go and edit a
        // JSON file is both wrong and the kind of dead end that gets an app
        // deleted on first open.
        !hasSchedule &&
        !hasToken &&
        html`<p class="hint">
          nothing here yet because anvil cannot reach your data. Add a GitHub token in
          <a href="#/system">Settings</a> and your split appears.
        </p>`
      }
      ${
        !hasSchedule &&
        hasToken &&
        html`<p class="hint">
          no weekly schedule in workouts.json yet. Pick a session below and it still logs
          normally.
        </p>`
      }
      ${
        doneToday.length > 0 &&
        !session &&
        html`<p class="hint">
          ${`${doneToday.length === 1 ? "One session" : `${doneToday.length} sessions`} logged today. ${template ? `${template.name} is next whenever you train again.` : ""}`}
        </p>`
      }
      ${
        template &&
        html`
          <div class="actions wrap">
            <button class="primary" onClick=${startRest}>REST ${REST_SECONDS}s</button>
            <button
              class="secondary ${confirmFinish ? "arm" : ""}"
              onClick=${finishSession}
              disabled=${!session || session.exercises.length === 0}
            >
              ${confirmFinish ? "TAP AGAIN TO FINISH" : "FINISH SESSION"}
            </button>
          </div>
          <${CoreWorkout}
            sessions=${[warmupFor(template.id)]}
            title="🔥 Warm up"
            subtitle=${`${Math.round(warmupFor(template.id).steps.reduce((n, x) => n + x.seconds + x.rest, 0) / 60)} min, dynamic, before you lift`}
            rotate=${false}
          />
          <h2 class="block-title">${template.name}</h2>
          <div class="slots">
            ${template.exercises.map((/** @type {Record<string, any>} */ ex) => {
              const last = lastSetsFor(/** @type {any} */ (workouts.sessions), ex.name);
              const baseline = last ? null : baselines[ex.name];
              const logged = session?.exercises.find((/** @type {any} */ e) => e.name === ex.name);

              // PREFILL, and it prefills the NEXT set rather than the last one.
              //
              // The first version seeded last session's numbers and the button
              // read "LOG · SAME AS LAST", which is an anti-progression default
              // with a green button on it: his own corpus says a stimulus
              // applied unchanged stops producing adaptation. Now the seed is
              // double progression, the rule that corpus states operationally
              // (add reps to the top of the range, then add load and reset),
              // and the button says which one it is.
              //
              // progressionFor returns null when it has no history or cannot
              // read the prescription ("10 min", "max time"), and null means no
              // opinion, so the fallback is the honest plain repeat.
              // the programme's own step for this lift: 10 lb lower, 5 upper,
              // which is the corpus's range. The steppers use it too, so a
              // squat moves in plate-sized jumps and a curl does not.
              const inc = Number(ex.increment) || 5;
              const prog = progressionFor(
                /** @type {any} */ (workouts.sessions),
                ex.name,
                ex.targetReps,
                inc,
              );
              const seed = prog ?? last?.[last.length - 1] ?? baseline ?? null;
              const inp = inputs[ex.name] ?? {
                w: seed ? String(seed.weight) : "",
                r: seed ? String(seed.reps) : "",
              };
              const onTarget =
                seed && inp.w === String(seed.weight) && inp.r === String(seed.reps);
              const set = (/** @type {Record<string, string>} */ patch) =>
                onDraft({ ...draft, inputs: { ...inputs, [ex.name]: { ...inp, ...patch } } });
              const nudge = (/** @type {"w" | "r"} */ field, /** @type {number} */ by) => {
                const cur = Number(inp[field]);
                const next = Math.max(0, (Number.isFinite(cur) ? cur : 0) + by);
                set({ [field]: String(Math.round(next * 100) / 100) });
              };
              const stepBtn = (
                /** @type {string} */ label,
                /** @type {"w" | "r"} */ field,
                /** @type {number} */ by,
                /** @type {string} */ aria,
              ) => html`
                <button class="step" aria-label=${aria} onClick=${() => nudge(field, by)}>
                  ${label}
                </button>
              `;

              return html`
                <div class="lift ${logged ? "islogged" : ""}" key=${ex.name}>
                  <div class="liftrow">
                    <span class="food">${ex.name}</span>
                    <span class="q num">${ex.targetSets}×${ex.targetReps}</span>
                  </div>
                  <div class="liftmeta num">
                    ${
                      logged
                        ? `logged ${formatSets(logged.sets)}`
                        : last
                          ? `last: ${formatSets(last)}`
                          : baseline
                            ? `plan: ${baseline.weight}×${baseline.reps}`
                            : "last: —"
                    }
                  </div>
                  ${
                    // Three sessions at the same weight AND reps means the
                    // exercise is the problem, not the effort. Straight out of
                    // the corpus's overload list.
                    !logged &&
                    prog &&
                    prog.stalled >= 3 &&
                    html`<div class="hint stall">
                      ${`stuck at ${inp.w || "?"}×${last?.[last.length - 1]?.reps ?? "?"} for ${prog.stalled} sessions. Add a set, or swap the exercise.`}
                    </div>`
                  }
                  ${ex.note && !logged && html`<div class="hint">${ex.note}</div>`}
                  ${
                    logged &&
                    html`<button class="secondary logagain" onClick=${() => set({})}>CHANGE</button>`
                  }
                  ${
                    !logged &&
                    html`
                      <div class="setform steppers ${invalid === ex.name ? "inputerr" : ""}">
                        ${stepBtn(`−${inc}`, "w", -inc, `${inc} pounds off ${ex.name}`)}
                        <input
                          type="number"
                          inputmode="decimal"
                          placeholder="lb"
                          aria-label=${`Weight for ${ex.name}, 0 for bodyweight`}
                          value=${inp.w}
                          onFocus=${(/** @type {any} */ e) => e.currentTarget.select()}
                          onInput=${(/** @type {any} */ e) => set({ w: e.currentTarget.value })}
                        />
                        ${stepBtn(`+${inc}`, "w", inc, `${inc} pounds on ${ex.name}`)}
                        <span class="by num">×</span>
                        ${stepBtn("−", "r", -1, `one rep off ${ex.name}`)}
                        <input
                          type="number"
                          inputmode="numeric"
                          placeholder="reps"
                          aria-label=${`Reps for ${ex.name}`}
                          value=${inp.r}
                          onFocus=${(/** @type {any} */ e) => e.currentTarget.select()}
                          onInput=${(/** @type {any} */ e) => set({ r: e.currentTarget.value })}
                        />
                        ${stepBtn("+", "r", 1, `one rep on ${ex.name}`)}
                      </div>
                      <button class="primary logbtn" onClick=${() => logSet(ex.name)}>
                        ${onTarget && prog ? `LOG · ${prog.label}` : "LOG"}
                      </button>
                    `
                  }
                </div>
              `;
            })}
          </div>
        `
      }
      ${
        hasSchedule &&
        html`<button class="secondary" onClick=${() => setShowPicker((s) => !s)}>
          ${showPicker ? "hide session picker" : "log a different session"}
        </button>`
      }
      ${
        ((hasSchedule && showPicker) || (!hasSchedule && !template)) &&
        html`
          <h2 class="block-title">
            ${hasSchedule ? "Pick a different session" : "Pick today's split"}
          </h2>
          <div class="slots">
            ${workouts.templates.map(
              (t) => html`
                <button
                  class="checkrow"
                  key=${t.id}
                  onClick=${() => {
                    onDraft({ ...draft, templateId: t.id });
                    setShowPicker(false);
                  }}
                >
                  <span class="food">${t.name}</span>
                  <span class="q num">${t.exercises.length} lifts</span>
                </button>
              `,
            )}
            ${
              workouts.templates.length === 0 &&
              html`<div class="empty">
                ${hasToken ? (loading ? "loading…" : "no split templates yet") : "add a token in Settings to load your split"}
              </div>`
            }
          </div>
        `
      }

      <h2 class="block-title">Check-in</h2>
      ${
        // The dialog on first open of the day is the place these get typed.
        // This is the read-back, plus a way in if he wants to correct a number
        // later: the same three fields inline as well would be the third copy
        // of one surface, which is the thing he objected to.
        html`<button class="checkrow" onClick=${onOpenCheckin}>
          <span class="food">
            ${`${todayRow.weight != null ? `${todayRow.weight} lb` : "no weight"} · ${todayRow.sleepHours != null ? `${todayRow.sleepHours} h` : "no sleep"} · ${todayRow.pushups != null ? `${todayRow.pushups} pushups` : "no pushups"}`}
          </span>
          <span class="q num">EDIT</span>
        </button>`
      }
      ${
        targets?.sleepHoursTarget &&
        html`<p class="hint">
          ${`sleep target ${targets.sleepHoursTarget}h${targets?.pushupTarget ? `, pushups ${targets.pushupTarget}` : ""} — read from Mise, never written here`}
        </p>`
      }
    </div>
  `;
}

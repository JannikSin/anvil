import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { tokenBroken } from "../lib/github.js";
import {
  formatSets,
  lastSetsFor,
  nextInRotation,
  padValues,
  progressionFor,
  rotationOrder,
  sessionsOn,
  addSet,
  undoSet,
} from "../lib/workouts.js";
import { relativeDayLabel, shiftIsoDate } from "../lib/dates.js";
import { draftSetCount } from "../lib/draft.js";
import { hrRest } from "../lib/activities.js";
import { ActivityLog } from "./activity-log.js";
import { Ring } from "./ring.js";
import { Crest } from "./glyphs.js";

// Rest is a property of the LIFT, not a constant. The training principles this
// programme came from prescribe 3 to 5 minutes on heavy compounds where
// performance matters and 1 to 2 on isolation; the app shipped a flat 90
// seconds for everything, which under-rests every compound in the programme.
// 90 is now only the fallback for an exercise that carries no rest of its own.
const REST_FALLBACK = 90;

/**
 * Today: what is on the bar, the entry pad for it, the floor warm-up, whatever
 * else was trained, and the read-back of the daily check-in.
 *
 * Deliberately ONE screen. Logging happens between sets with a bar racked and
 * forearms pumped; making anyone change tab to enter the number they just
 * lifted is a tap paid forty times a session, and P4 is the promise that
 * outranks the others when they conflict.
 *
 * @param {{
 *   workouts: { templates: Record<string, any>[], sessions: Record<string, any>[], schedule?: Record<string, string | null>, conditioning?: Record<string, any>, quality?: Record<string, any>, commute?: Record<string, any>, restDay?: Record<string, any>, baselines?: Record<string, any> },
 *   daily: { days: Record<string, any>[] },
 *   targets: Record<string, any> | null,
 *   today: string,
 *   hasToken: boolean,
 *   repo: Record<string, any> | null,
 *   sync: Record<string, any>,
 *   loading: boolean,
 *   draft: import("../lib/draft.js").Draft,
 *   onDraft: (d: import("../lib/draft.js").Draft) => void,
 *   onSaveSession: (session: Record<string, any>) => void,
 *   onOpenCheckin: () => void,
 *   activities: Record<string, any>[],
 *   onLogActivity: (entry: Record<string, any>) => void
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
  sync,
  loading,
  draft,
  onDraft,
  onSaveSession,
  onOpenCheckin,
  activities,
  onLogActivity,
}) {
  const [rest, setRest] = useState(0);
  // what the ring is a fraction OF. Kept beside the countdown so an HR reading
  // that extends the rest also stretches the ring rather than overflowing it.
  const [restSpan, setRestSpan] = useState(REST_FALLBACK);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [invalid, setInvalid] = useState(/** @type {string | null} */ (null));
  const restRef = useRef(/** @type {ReturnType<typeof setInterval> | null} */ (null));
  // the floor for the lift currently resting, so an HR entry cannot undercut it
  const restFloorRef = useRef(REST_FALLBACK);
  // Measured numbers replace these the moment vitals or a real max exist.
  const restHr = Number(targets?.restingHr) || 60;
  const maxHr = Number(targets?.maxHr) || 195;

  useEffect(() => {
    return () => {
      if (restRef.current) clearInterval(restRef.current);
    };
  }, []);

  const startRest = (/** @type {number} */ seconds = REST_FALLBACK) => {
    if (restRef.current) clearInterval(restRef.current);
    restFloorRef.current = seconds;
    setRest(seconds);
    setRestSpan(seconds);
    restRef.current = setInterval(() => {
      setRest((r) => {
        if (r <= 1 && restRef.current) clearInterval(restRef.current);
        return Math.max(0, r - 1);
      });
    }, 1000);
  };

  const { session, inputs } = draft;
  // The DATE lives in the draft rather than in view state, for the same reason
  // the sets do: view state dies with the page.
  // Feasibility notes, one per lift, Block 1 week one (2026-10-11): David is
  // trying every exercise and writing what he thinks of each. They ride in the
  // draft like the sets do, so a killed page cannot eat them.
  const notes = /** @type {Record<string, string>} */ (draft.notes ?? {});
  const setNote = (/** @type {string} */ name, /** @type {string} */ text) =>
    onDraft({ ...draft, notes: { ...notes, [name]: text } });
  // P4, job 1 on the fix list: "a late entry is a first-class entry". Every
  // session used to be stamped with today and there was no way to say
  // otherwise, so a session trained on Tuesday and remembered on Thursday
  // could not be recorded at all — and the log's job is to be complete, not
  // to be live. logDate defaults to today and steps back a day at a tap.
  const logDate = typeof draft.date === "string" ? draft.date : today;
  const backdated = logDate !== today;
  // one interpolation, one line, for the htm whitespace reason above
  const whenSub = backdated ? "a late entry counts the same" : "logging live";
  // Today's session comes from the fixed rotation — nothing to pick.
  // draft.templateId is only set on an explicit override through the escape
  // hatch, and that pick wins over the schedule for this draft.
  const hasSchedule = workouts.schedule !== undefined;
  // POSITION in the rotation, not the day of the week. A missed Monday used to
  // delete Lower A outright, because Tuesday showed Pull A; now it just makes
  // Lower A the next thing whenever training next happens. Nothing in the app
  // can say anyone is behind, because behind is no longer representable.
  const scheduled = nextInRotation(
    workouts.schedule,
    /** @type {any} */ (workouts.templates),
    /** @type {any} */ (workouts.sessions),
  );
  const doneToday = sessionsOn(/** @type {any} */ (workouts.sessions), logDate);
  const pickedTemplate = draft.templateId
    ? workouts.templates.find((t) => t.id === draft.templateId)
    : null;
  const full = hasSchedule ? (pickedTemplate ?? scheduled) : pickedTemplate;
  // Tiers were cut with Block 1: the session is the session as written, and
  // the lifts marked first cut are what goes when a day runs long.
  const template = full ?? null;
  const order = rotationOrder(workouts.schedule);
  const tokenBad = tokenBroken(repo?.auth);
  // The reason from the last FAILED PUSH beats the reason from a probe: one is
  // what actually happened to his data, the other is a guess about the token.
  const syncError = sync?.needsYou ? sync.lastError : null;
  const repoReason =
    repo?.auth === "norepo"
      ? 'The token works but cannot see the data repo. On the token page, Repository access defaults to "Public repositories" and silently fails on a private one: switch it to "Only select repositories" and tick both data repos. Do not mint a new token.'
      : repo?.auth === "ratelimited"
        ? "GitHub is rate-limiting this token. It clears within the hour on its own."
        : "GitHub rejected the token itself. Paste a fresh one in Setup (bottom right).";
  const baselines = /** @type {Record<string, any>} */ (workouts.baselines ?? {});
  const todayRow = (daily.days ?? []).find((d) => d.date === today) ?? {};
  const logSet = (/** @type {string} */ name) => {
    const ex = template?.exercises?.find((/** @type {any} */ e) => e.name === name);
    const already = session?.exercises.find((/** @type {any} */ e) => e.name === name);
    // THE SAME resolution the pad renders with (padValues), not the raw keypad
    // state: the pad shows a seeded prefill before anything is typed, and a
    // press on LOG must file the numbers the person is looking at. Reading
    // only `inputs` here is the 2026-09-01 "it doesn't accept it" bug.
    const inp = padValues(
      inputs[name],
      already?.sets,
      ex
        ? progressionFor(
            /** @type {any} */ (workouts.sessions),
            name,
            ex.targetReps,
            Number(ex.increment) || 5,
          )
        : null,
      lastSetsFor(/** @type {any} */ (workouts.sessions), name),
      baselines[name],
    );
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
    const base = session ?? { date: logDate, templateId: template?.id ?? null, exercises: [] };
    onDraft({
      ...draft,
      session: addSet(/** @type {any} */ (base), name, { weight, reps }),
    });
    // rest 0 marks the first lift of a superset: go straight into its partner
    const r = ex?.rest === 0 ? 0 : Number(ex?.rest) || REST_FALLBACK;
    if (r > 0) startRest(r);
  };

  /** Take back the most recent set of one lift, reopening its numbers on the
   *  pad so a mispress is a two-tap correction rather than a lost record. */
  const undoLast = (/** @type {string} */ name) => {
    if (!session) return;
    const ex = session.exercises.find((/** @type {any} */ e) => e.name === name);
    const removed = ex?.sets?.[ex.sets.length - 1];
    onDraft({
      ...draft,
      session: undoSet(/** @type {any} */ (session), name),
      inputs: removed
        ? { ...inputs, [name]: { w: String(removed.weight), r: String(removed.reps) } }
        : inputs,
    });
  };

  // Notes typed against lifts that were never logged still belong in the
  // record: "skipped, the machine was taken" is exactly the feasibility data
  // week one exists to collect.
  const noted = Object.keys(notes).filter((n) => notes[n]?.trim());
  const canFile = Boolean((session && session.exercises.length > 0) || noted.length > 0);

  const finishSession = () => {
    if (!canFile) return;
    if (!confirmFinish) {
      setConfirmFinish(true);
      setTimeout(() => setConfirmFinish(false), 4000);
      return;
    }
    // stamp the date at the moment of filing, not at the moment the first set
    // was logged: stepping the date control after logging must move the whole
    // session, which is what a person back-dating one expects it to do
    const base = session ?? { date: logDate, templateId: template?.id ?? null, exercises: [] };
    const noteFor = (/** @type {string} */ name) => (notes[name] ?? "").trim();
    const exercises = base.exercises.map((/** @type {any} */ e) =>
      noteFor(e.name) ? { ...e, note: noteFor(e.name) } : e,
    );
    for (const name of noted) {
      if (!exercises.some((/** @type {any} */ e) => e.name === name))
        exercises.push({ name, sets: [], note: noteFor(name) });
    }
    onSaveSession({ ...base, exercises, date: logDate });
    // App clears the persisted draft; nothing to do here but reset the view
    setConfirmFinish(false);
  };

  /** Move the whole in-progress session to another date. */
  const setLogDate = (/** @type {string} */ next) => {
    if (!next || next > today) return; // no logging into the future
    onDraft({
      ...draft,
      date: next,
      session: session ? { ...session, date: next } : null,
    });
  };

  return html`
    <div class="deck">
      ${
        rest > 0 &&
        html`<div class=${`restdial ${rest <= 10 ? "is-closing" : ""}`} role="timer">
          <div class="restdial__face">
            <${Ring}
              frac=${restSpan > 0 ? rest / restSpan : 0}
              width=${7}
              tick=${restSpan > 0 ? Math.min(1, restFloorRef.current / restSpan) : null}
              label=${`${rest} seconds of rest left`}
            />
            <div>
              <div class="restdial__num">${rest}</div>
              <div class="restdial__cap">rest</div>
            </div>
          </div>
          ${
            // A browser cannot read HealthKit, so the peak comes from the watch
            // already on the wrist. One number a PWA cannot get is supplied by
            // hand and the app does the arithmetic: resume at 60% of heart rate
            // reserve, never below this lift's own floor, never past 240s.
            html`<input
              class="restdial__hr num"
              type="number"
              inputmode="numeric"
              placeholder="peak bpm"
              aria-label="Peak heart rate from your watch, to set this rest"
              onChange=${(/** @type {any} */ e) => {
                const peak = Number(e.currentTarget.value);
                if (!Number.isFinite(peak) || peak <= 0) return;
                const r = hrRest(peak, restHr, maxHr, restFloorRef.current);
                setRest(r.seconds);
                setRestSpan(Math.max(r.seconds, restFloorRef.current));
                e.currentTarget.value = "";
              }}
            />`
          }
        </div>`
      }

      <div class="crest">
        <${Crest} name="today" />
        <div class="crest__body">
          <h1 class="crest__title">${full ? full.name : "Today"}</h1>
          <p class="crest__sub">
            ${full ? `${full.focus ?? "next in the queue"} · about ${full.minutes ?? 50} min` : hasToken ? "no session resolved" : "not connected"}
          </p>
        </div>
      </div>

      ${
        // THE QUEUE, as six chips. The highlighted one is next by completion,
        // not by weekday; tapping another logs that one instead for this draft.
        order.length > 0 &&
        html`<div class="chiprow" role="group" aria-label="The six days, in order">
          ${order.map((id) => {
            const t = workouts.templates.find((x) => x.id === id);
            if (!t) return null;
            const on = full?.id === id;
            return html`<button
              key=${id}
              class=${`chip ${on ? "is-on" : ""}`}
              aria-pressed=${on}
              onClick=${() => onDraft({ ...draft, templateId: id === scheduled?.id ? null : id })}
            >
              ${t.name}
            </button>`;
          })}
        </div>`
      }
      <p class="note">
        ${scheduled && full && scheduled.id !== full.id ? `Logging ${full.name} instead of ${scheduled.name}. Tap ${scheduled.name} to go back.` : "Next in the queue. A missed day never skips one; the next session is just the next in line. Save your heaviest set per lift."}
      </p>

      ${
        // The draft survives a killed page (lib/draft.js), so a session logged
        // and never filed comes back instead of vanishing. Worded as a held
        // session rather than a missed one: P9 forbids rendering anyone as
        // behind.
        session &&
        session.exercises.length > 0 &&
        backdated &&
        html`<p class="alarm">
          ${`Held: ${draftSetCount(draft)} ${draftSetCount(draft) === 1 ? "set" : "sets"} logged for ${relativeDayLabel(logDate, today)}, still unfiled. They are saved on this device but they are not in your record until you file the session.`}
        </p>`
      }
      ${
        // ONE STORY, AND IT NAMES THE FIX: the reason from the last failed
        // push wins over a probe, because it is what actually happened.
        (syncError || tokenBad) &&
        html`<p class="alarm">
          ${`Not syncing, and nothing you log is leaving this phone until it is fixed. ${syncError ?? repoReason}`}
        </p>`
      }
      ${
        // Gated on the token alone. It was unreachable for a month once, and
        // an un-backed-up training log is a broken pipe, not a preference.
        !hasToken &&
        html`<p class="alarm">
          ${"Nothing is leaving this phone. Sets save here and only here: no backup, no second device, and clearing the browser takes them with it. Add a GitHub token in Setup to start syncing."}
        </p>`
      }
      ${
        doneToday.length > 0 &&
        !session &&
        html`<p class="note">
          ${`${doneToday.length === 1 ? "One session" : `${doneToday.length} sessions`} already filed for ${relativeDayLabel(logDate, today)}. ${full ? `${full.name} is next whenever you train again.` : ""}`}
        </p>`
      }
      ${
        !template &&
        html`<div class="void">${loading ? "loading" : "no programme loaded"}</div>`
      }

      ${
        template &&
        html`
          <div class="lifts">
            ${(template.exercises ?? []).map((/** @type {Record<string, any>} */ ex) => {
              const last = lastSetsFor(/** @type {any} */ (workouts.sessions), ex.name);
              const baseline = last ? null : baselines[ex.name];
              const logged = session?.exercises.find((/** @type {any} */ e) => e.name === ex.name);
              // LAST TIME'S TOP SET, the one number the progression reads. A
              // session logged under the old every-set scheme carries several
              // sets, so the heaviest is shown, not the last.
              const top = last
                ? [...last].sort((x, y) => y.weight - x.weight || y.reps - x.reps)[0]
                : null;
              const inc = Number(ex.increment) || 5;
              const prog = progressionFor(
                /** @type {any} */ (workouts.sessions),
                ex.name,
                ex.targetReps,
                inc,
              );
              const seed = prog ?? top ?? baseline ?? null;
              // Resolved by padValues, the SAME function the SAVE press reads,
              // so what the pad shows is always what a press files.
              const inp = padValues(inputs[ex.name], logged?.sets, prog, last, baselines[ex.name]);
              // Top set only (Block 1, 2026-10-11): one saved set is the lift done.
              const done = Boolean(logged && logged.sets.length >= 1);
              const onTarget = seed && inp.w === String(seed.weight) && inp.r === String(seed.reps);
              const hasNumbers = inp.w.trim() !== "" && inp.r.trim() !== "";
              const restFor = ex.rest === 0 ? 0 : Number(ex.rest) || REST_FALLBACK;
              const restText =
                restFor === 0 ? `straight into ${ex.superset}` : `rest ${fmtRest(restFor)}`;
              const set = (/** @type {Record<string, string>} */ patch) =>
                onDraft({ ...draft, inputs: { ...inputs, [ex.name]: { ...inp, ...patch } } });
              const nudge = (/** @type {"w" | "r"} */ field, /** @type {number} */ by) => {
                const cur = Number(inp[field]);
                const next = Math.max(0, (Number.isFinite(cur) ? cur : 0) + by);
                set({ [field]: String(Math.round(next * 100) / 100) });
              };
              const knob = (
                /** @type {string} */ label,
                /** @type {"w" | "r"} */ field,
                /** @type {number} */ by,
                /** @type {string} */ aria,
              ) => html`
                <button
                  class="knob"
                  type="button"
                  aria-label=${aria}
                  onClick=${() => nudge(field, by)}
                >
                  ${label}
                </button>
              `;
              const tags = [
                ex.main ? "MAIN LIFT" : null,
                ex.superset ? `⇄ ${ex.superset}` : null,
                ex.cut ? "FIRST CUT" : null,
              ].filter(Boolean);
              const restBtn =
                restFor > 0 &&
                html`<button class="ghost" onClick=${() => startRest(restFor)}>
                  ${`REST ${fmtRest(restFor)}`}
                </button>`;

              return html`
                <div class=${`lift ${done ? "is-logged" : ""}`} key=${ex.name}>
                  <div class="lift__head">
                    <span class="lift__name">${ex.name}</span>
                    <span class="lift__pres num">${`${ex.targetSets}×${ex.targetReps}`}</span>
                  </div>
                  <div class="lift__rx num">
                    ${`${String(ex.load ?? "").toUpperCase()} · ${ex.effort ?? ""} · ${restText}`}
                  </div>
                  ${tags.length > 0 && html`<div class="lift__tags num">${tags.join("   ")}</div>`}
                  <div class="lift__last num">
                    ${logged ? `top set: ${formatSets(logged.sets)}` : top ? `last top set: ${formatSets([top])}` : baseline ? `plan: ${baseline.weight}×${baseline.reps}` : "last top set: none yet"}
                  </div>
                  ${
                    !logged &&
                    prog &&
                    prog.stalled >= 3 &&
                    html`<div class="lift__stall">
                      ${`Stuck at ${inp.w || "?"}×${top?.reps ?? "?"} for ${prog.stalled} sessions. Swap the exercise or clean up the reps.`}
                    </div>`
                  }
                  ${ex.cue && html`<div class="lift__note">${ex.cue}</div>`}
                  ${
                    logged &&
                    html`<div class="act">
                      <button class="ghost" onClick=${() => undoLast(ex.name)}>UNDO</button>
                      ${restBtn}
                    </div>`
                  }
                  ${
                    !logged &&
                    html`
                      <div class=${`setpad ${invalid === ex.name ? "is-bad" : ""}`}>
                        ${knob(`−${inc}`, "w", -inc, `${inc} pounds off ${ex.name}`)}
                        <input
                          class="well"
                          type="number"
                          inputmode="decimal"
                          placeholder="LB"
                          aria-label=${`Weight for ${ex.name}, 0 for bodyweight`}
                          value=${inp.w}
                          onFocus=${(/** @type {any} */ e) => e.currentTarget.select()}
                          onInput=${(/** @type {any} */ e) => set({ w: e.currentTarget.value })}
                        />
                        ${knob(`+${inc}`, "w", inc, `${inc} pounds on ${ex.name}`)}
                        <span class="setpad__x num">×</span>
                        ${knob("−", "r", -1, `one rep off ${ex.name}`)}
                        <input
                          class="well"
                          type="number"
                          inputmode="numeric"
                          placeholder="REPS"
                          aria-label=${`Reps for ${ex.name}`}
                          value=${inp.r}
                          onFocus=${(/** @type {any} */ e) => e.currentTarget.select()}
                          onInput=${(/** @type {any} */ e) => set({ r: e.currentTarget.value })}
                        />
                        ${knob("+", "r", 1, `one rep on ${ex.name}`)}
                      </div>
                      <div class="strikerow">
                        <button
                          class="strike"
                          aria-label=${`Save the top set for ${ex.name}`}
                          onClick=${() => logSet(ex.name)}
                        >
                          SAVE
                        </button>
                        <span class="strike__why">
                          <b>${onTarget && prog ? prog.label : hasNumbers ? "your call" : "no history yet"}</b>
                          ${hasNumbers ? ` Heaviest set: ${inp.w}×${inp.r}.` : " Put in your heaviest set."}
                        </span>
                      </div>
                      ${restBtn && html`<div class="act">${restBtn}</div>`}
                    `
                  }
                  <textarea
                    class="lift__memo"
                    rows="2"
                    placeholder="Feasibility note: like it? machine free? swap?"
                    aria-label=${`Your note on ${ex.name}`}
                    value=${notes[ex.name] ?? ""}
                    onInput=${(/** @type {any} */ e) => setNote(ex.name, e.currentTarget.value)}
                  ></textarea>
                </div>
              `;
            })}
          </div>

          <h2 class="band">When<span class="band__sub">${whenSub}</span></h2>
          <div class=${`datepad ${backdated ? "is-back" : ""}`}>
            <button
              class="knob"
              type="button"
              aria-label="File this session a day earlier"
              onClick=${() => setLogDate(shiftIsoDate(logDate, -1))}
            >
              ‹
            </button>
            <input
              class="datepad__well"
              type="date"
              max=${today}
              value=${logDate}
              aria-label="Date this session was trained"
              onInput=${(/** @type {any} */ e) => setLogDate(e.currentTarget.value)}
            />
            <button
              class="knob"
              type="button"
              aria-label="File this session a day later"
              disabled=${logDate >= today}
              onClick=${() => setLogDate(shiftIsoDate(logDate, 1))}
            >
              ›
            </button>
          </div>
          <div class="act">
            <button
              class=${`cta ${confirmFinish ? "is-armed" : ""}`}
              onClick=${finishSession}
              disabled=${!canFile}
            >
              ${confirmFinish ? "TAP AGAIN TO FILE" : "FILE SESSION"}
            </button>
          </div>
          <p class="note">
            ${"Filing saves every top set and every note, and moves the queue to the next day. Lifts you skipped just stay blank."}
          </p>
        `
      }

      <${ActivityLog} activities=${activities} today=${today} onLog=${onLogActivity} />

      <h2 class="band">Check-in</h2>
      <div class="rack">
        <button class="bar" onClick=${onOpenCheckin}>
          <span class="bar__name">
            ${`${todayRow.weight != null ? `${todayRow.weight} lb` : "no weight"} · ${todayRow.sleepHours != null ? `${todayRow.sleepHours} h` : "no sleep"} · ${todayRow.pushups != null ? `${todayRow.pushups} pushups` : "no pushups"}`}
          </span>
          <span class="bar__meta num">EDIT</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Rest reads as a clock, never as a count of seconds: 150 is "2:30".
 * @param {number} sec
 * @returns {string}
 */
function fmtRest(sec) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

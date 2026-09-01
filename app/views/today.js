import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { tokenBroken } from "../lib/github.js";
import {
  commuteFor,
  conditioningForDate,
  isRestDay,
  qualityForDate,
  formatSets,
  lastSetsFor,
  nextInRotation,
  padValues,
  progressionFor,
  sessionAtTier,
  sessionsOn,
  addSet,
  undoSet,
  tierMinutes,
  upcomingSessions,
} from "../lib/workouts.js";
import { CORE_SESSIONS, sessionForDay } from "../lib/core.js";
import { warmupFor } from "../lib/routines.js";
import { parseLocalIso, relativeDayLabel, shiftIsoDate } from "../lib/dates.js";
import { draftSetCount } from "../lib/draft.js";
import { hrRest } from "../lib/activities.js";
import { CoreWorkout } from "./core-workout.js";
import { ActivityLog } from "./activity-log.js";
import { Ring } from "./ring.js";
import { Crest } from "./glyphs.js";

// Rest is a property of the LIFT, not a constant. The training principles this
// programme came from prescribe 3 to 5 minutes on heavy compounds where
// performance matters and 1 to 2 on isolation; the app shipped a flat 90
// seconds for everything, which under-rests every compound in the programme.
// 90 is now only the fallback for an exercise that carries no rest of its own.
const REST_FALLBACK = 90;

/** The three tiers, named for what they cost rather than for their number.
 *  "Tier 2" means nothing at 6am; "18 min" means everything. Nothing here is
 *  styled or worded as a lesser day — P3 says a reduced session is a completed
 *  session, and the app is never allowed to imply otherwise. */
const TIERS = /** @type {{ tier: 1 | 2 | 3, name: string, blurb: string }[]} */ ([
  { tier: 1, name: "Full", blurb: "the session as written" },
  { tier: 2, name: "Trim", blurb: "main lifts and top sets, accessories cut" },
  { tier: 3, name: "Core", blurb: "the one movement that matters today" },
]);

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
  const [showPicker, setShowPicker] = useState(false);
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
  // The tier and the DATE both live in the draft rather than in view state,
  // for the same reason the sets do: view state dies with the page. A session
  // half-logged at tier 2 that comes back as tier 1 has silently changed what
  // is on the bar.
  const tier = /** @type {1 | 2 | 3} */ (draft.tier ?? 1);
  const setTier = (/** @type {1 | 2 | 3} */ t) => onDraft({ ...draft, tier: t });
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
  // P3: the same session at the tier chosen. sessionAtTier keeps the id, so a
  // tier 3 day logs against the same template and advances the same rotation.
  const template = full ? sessionAtTier(full, tier) : null;
  const tokenBad = tokenBroken(repo?.auth);
  // The reason from the last FAILED PUSH beats the reason from a probe: one is
  // what actually happened to his data, the other is a guess about the token.
  const syncError = sync?.needsYou ? sync.lastError : null;
  const repoReason =
    repo?.auth === "norepo"
      ? 'The token works but cannot see the data repo. On the token page, Repository access defaults to "Public repositories" and silently fails on a private one: switch it to "Only select repositories" and tick both data repos. Do not mint a new token.'
      : repo?.auth === "ratelimited"
        ? "GitHub is rate-limiting this token. It clears within the hour on its own."
        : "GitHub rejected the token itself. Paste a fresh one in Rig.";
  const baselines = /** @type {Record<string, any>} */ (workouts.baselines ?? {});
  const todayRow = (daily.days ?? []).find((d) => d.date === today) ?? {};
  const fullMinutes = full ? tierMinutes(full, 1) : 0;
  // The two hard interval sessions a week. Written 2026-08-19, carried by
  // program.json, tested since, and rendered NOWHERE until 2026-08-24 because
  // the app shell's bundle dropped the key. It attaches to the weekday rather
  // than to the session, because the reason it sits on an upper-body morning is
  // that concurrent training costs explosive strength and it is worst in the
  // same session as heavy lower work.
  // Pre-lift quality: plyos Monday, sprints Thursday, rope on the upper days,
  // med ball Friday. Shipped with the rebuilt week 2026-08-24. It is rendered
  // ABOVE the lifts on purpose, because the whole prescription is "fresh".
  const qual = qualityForDate(/** @type {any} */ (workouts.quality), logDate, tier === 3);
  const commute = commuteFor(/** @type {any} */ (workouts.commute), full?.id);
  const resting = isRestDay(workouts.schedule, logDate);
  const restPlan = /** @type {Record<string, any> | undefined} */ (workouts.restDay);
  const cond = conditioningForDate(/** @type {any} */ (workouts.conditioning), logDate, tier === 3);
  // The queue, laid onto dates. NOT a calendar: the rotation advances on
  // completion, so these dates are a projection and the copy says so.
  const queue = upcomingSessions(
    workouts.schedule,
    /** @type {any} */ (workouts.templates),
    /** @type {any} */ (workouts.sessions),
    today,
    // seven, not six: six sessions from a Monday runs out on Saturday and the
    // rest day never appears, and "is there a rest day or is it just different
    // muscle groups" is a question the queue should answer without being asked
    7,
  );
  const dayName = (/** @type {string} */ iso) =>
    parseLocalIso(iso).toLocaleDateString([], { weekday: "short" }).toUpperCase();
  // Saturday's prescription is named "Alternating: sprints one week, long run
  // the next", which is the right sentence in the session and two wrapped lines
  // in a queue row. Names that fit are shown; names that do not become the word
  // that is still true, and the full prescription waits on the day it is due.
  const condTag = (/** @type {string} */ name) => (name.length <= 22 ? name : "cardio");

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
    startRest(Number(ex?.rest) || REST_FALLBACK);
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

  const finishSession = () => {
    if (!session || session.exercises.length === 0) return;
    if (!confirmFinish) {
      setConfirmFinish(true);
      setTimeout(() => setConfirmFinish(false), 4000);
      return;
    }
    // stamp the date at the moment of filing, not at the moment the first set
    // was logged: stepping the date control after logging must move the whole
    // session, which is what a person back-dating one expects it to do
    onSaveSession({ ...session, date: logDate });
    // App clears the persisted draft; nothing to do here but reset the view
    setConfirmFinish(false);
    setShowPicker(false);
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
            ${
              full
                ? `next in rotation · ${fullMinutes} min at full`
                : hasToken
                  ? "no session resolved"
                  : "not connected"
            }
          </p>
        </div>
      </div>

      ${
        // THE SEVENTH DAY, and it is the one place in this app where the
        // weekday genuinely matters. The rotation never asks what day it is,
        // because it advances on completion. The rest day does ask, because
        // the sleep debt it exists to pay accrues on a calendar.
        //
        // It does not hide the session: P1 says opening the app resolves
        // something to do with zero taps, and a person who wants to train on a
        // Sunday is not doing anything wrong. It says what the day is FOR, and
        // leaves the session below it.
        resting &&
        restPlan &&
        doneToday.length === 0 &&
        html`
          <h2 class="band">Rest<span class="band__sub">no alarm</span></h2>
          <div class="rack">
            <div class="bar">
              <span class="bar__name">${restPlan.job}</span>
              <span class="bar__meta num">OPTIONAL</span>
            </div>
          </div>
          <p class="note">${restPlan.why}</p>
          <p class="note">${restPlan.notRest}</p>
        `
      }
      ${
        // The draft survives a killed page now (lib/draft.js), so a session
        // logged and never filed comes back instead of vanishing. It has to
        // ANNOUNCE itself: sets sitting in a draft are not in the record, do
        // not feed progression, and do not advance the rotation. Worded as a
        // held session rather than a missed one — P9 forbids the app rendering
        // anyone as behind, and this is a recovery, not a failure.
        session &&
        session.exercises.length > 0 &&
        backdated &&
        html`<p class="alarm">
          ${`Held: ${draftSetCount(draft)} ${draftSetCount(draft) === 1 ? "set" : "sets"} logged for ${relativeDayLabel(logDate, today)}, still unfiled. They are saved on this device but they are not in your record until you file the session.`}
        </p>`
      }
      ${
        // ONE STORY, AND IT NAMES THE FIX. Until 2026-08-24 this line said
        // "the token needs fixing in Rig" while the status lamp, reading a
        // different code path, said "can't reach GitHub right now
        // (auto-retrying)". Both were on screen at once, they contradicted
        // each other, and the one that was actually true was the one you had
        // to leave the screen to find. David: "The token was accepted, but,
        // like, GitHub rejected it. I don't understand what this means."
        //
        // `syncError` is the real reason from the last failed push, already
        // written as the remedy (github.js describeSyncError). It wins,
        // because it comes from the write that actually failed rather than
        // from a probe.
        (syncError || tokenBad) &&
        html`<p class="alarm">
          ${`Not syncing, and nothing you log is leaving this phone until it is fixed. ${syncError ?? repoReason}`}
        </p>`
      }
      ${
        // THIS WARNING WAS UNREACHABLE FROM 2026-08-18 TO 2026-08-24 and the
        // cost was a month of training that never left one phone.
        //
        // It used to be gated on `!hasSchedule && !hasToken`: a cold-start
        // note for an install that had no split. Then the split was bundled
        // into the app shell so first open would work offline — a good change
        // — and `hasSchedule` became permanently true. The condition could
        // never fire again, so the only remaining sign that nothing was being
        // saved anywhere was a 7px lamp in the corner reading NO TOKEN.
        //
        // A person cannot act on a state the app will not name. It is now
        // gated on the token alone, it says what is actually at risk, and it
        // is an alarm rather than a note because an un-backed-up training log
        // is a broken pipe, not a preference.
        !hasToken &&
        html`<p class="alarm">
          ${"Nothing is leaving this phone. Sets save here and only here — no backup, no second device, and clearing the browser takes them with it. Add a GitHub token in Rig to start syncing."}
        </p>`
      }
      ${
        !hasSchedule &&
        hasToken &&
        html`<p class="note">
          ${"No weekly schedule in workouts.json yet. Pick a session below and it still logs normally."}
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
        full &&
        html`
          <h2 class="band">How much of it<span class="band__sub">any tier is a full day</span></h2>
          <div class="tierpad" role="group" aria-label="Session size">
            ${TIERS.map((t) => {
              const mins = tierMinutes(full, t.tier);
              const on = tier === t.tier;
              return html`
                <button
                  key=${t.tier}
                  class=${`tierbtn ${on ? "is-on" : ""}`}
                  aria-pressed=${on}
                  onClick=${() => setTier(t.tier)}
                >
                  <span class="tierbtn__dial">
                    <${Ring} frac=${fullMinutes > 0 ? mins / fullMinutes : 1} width=${8} />
                    <span>
                      <span class="tierbtn__min num">${mins}</span>
                      <span class="tierbtn__unit">MIN</span>
                    </span>
                  </span>
                  <span class="tierbtn__name">${t.name}</span>
                </button>
              `;
            })}
          </div>
          <p class="note">${TIERS.find((t) => t.tier === tier)?.blurb}</p>

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
          <p class="note">
            ${backdated ? `Filing for ${relativeDayLabel(logDate, today)}. It enters the record, the progression and the rotation exactly as a live one does.` : "Trained this on another day? Step the date back. A session you remember on Thursday is worth as much as one you logged on Tuesday."}
          </p>

          <div class="act">
            <button class="ghost" onClick=${() => startRest()}>${`REST ${REST_FALLBACK}s`}</button>
            <button
              class=${`ghost ${confirmFinish ? "is-armed" : ""}`}
              onClick=${finishSession}
              disabled=${!session || session.exercises.length === 0}
            >
              ${confirmFinish ? "TAP AGAIN TO FILE" : "FILE SESSION"}
            </button>
          </div>

          <${CoreWorkout}
            sessions=${[warmupFor(full.id)]}
            title="Warm up"
            subtitle=${`${Math.round(warmupFor(full.id).steps.reduce((n, x) => n + x.seconds + x.rest, 0) / 60)} min, dynamic, before you lift`}
            rotate=${false}
          />

          ${commute && html`<p class="note"><b>${"Getting there"}</b> ${commute}</p>`}
          ${
            // FRESH, and that word is the whole prescription: explosive
            // qualities are the first thing fatigue erases, so this sits
            // between the warm-up and the first working set and nowhere else.
            // It is not logged as sets and never enters the progression,
            // because rate of force development is not volume.
            qual &&
            html`
              <h2 class="band">
                Before you lift<span class="band__sub"
                  >${`${qual.name}, ${qual.minutes} min, fresh`}</span
                >
              </h2>
              <div class="rack">
                <div class="bar">
                  <span class="bar__name">${qual.work}</span>
                  <span class="bar__meta num">${`${qual.minutes} MIN`}</span>
                </div>
                <div class="bar">
                  <span class="bar__name">${qual.cue}</span>
                  <span class="bar__meta num">HOW</span>
                </div>
              </div>
              <p class="note">
                ${qual.reduced ? `Short version: ${qual.work}` : `Short on time: ${qual.fallback}`}
              </p>
              <p class="note">${qual.why}</p>
            `
          }

          <h2 class="band">On the bar</h2>
          <div class="lifts">
            ${(template?.exercises ?? []).map((/** @type {Record<string, any>} */ ex) => {
              const last = lastSetsFor(/** @type {any} */ (workouts.sessions), ex.name);
              const baseline = last ? null : baselines[ex.name];
              const logged = session?.exercises.find((/** @type {any} */ e) => e.name === ex.name);

              // PREFILL, and it prefills the NEXT set rather than the last one.
              //
              // The first version seeded last session's numbers and the button
              // read "SAME AS LAST", which is an anti-progression default with
              // a bright button on it: the corpus this programme came from says
              // a stimulus applied unchanged stops producing adaptation. The
              // seed is double progression now — add reps to the top of the
              // range, then add load and reset — and the pad says which move it
              // is making.
              //
              // progressionFor returns null when it has no history or cannot
              // read the prescription ("10 min", "max time"), and null means no
              // opinion, so the fallback is the honest plain repeat.
              const inc = Number(ex.increment) || 5;
              const prog = progressionFor(
                /** @type {any} */ (workouts.sessions),
                ex.name,
                ex.targetReps,
                inc,
              );
              const seed = prog ?? last?.[last.length - 1] ?? baseline ?? null;
              // Resolved by padValues, the SAME function the LOG press reads,
              // so what the pad shows is always what a press files. `inputs`
              // is scrubbed along with the session in lib/draft.js, so it can
              // no longer carry a filed session's numbers into the next one.
              const inp = padValues(inputs[ex.name], logged?.sets, prog, last, baselines[ex.name]);
              // Done is the PRESCRIPTION met, not the first press: one logged
              // set out of four used to strike the whole lift and lock its
              // pad, which read as the app refusing further sets.
              const target = Number(ex.targetSets) || 1;
              const done = Boolean(logged && logged.sets.length >= target);
              const onTarget = seed && inp.w === String(seed.weight) && inp.r === String(seed.reps);
              // no history and no baseline means the pad is empty, and the line
              // beside the strike button has to say so rather than promising to
              // file "?×?", which is what it used to read as on a first session
              const hasNumbers = inp.w.trim() !== "" && inp.r.trim() !== "";
              const restFor = Number(ex.rest) || REST_FALLBACK;
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

              return html`
                <div class=${`lift ${done ? "is-logged" : ""}`} key=${ex.name}>
                  <div class="lift__head">
                    <span class="lift__name">${ex.name}</span>
                    <span class="lift__pres num">${`${ex.targetSets}×${ex.targetReps}`}</span>
                  </div>
                  <div class="lift__last num">
                    ${
                      logged
                        ? `${logged.sets.length} of ${target} · ${formatSets(logged.sets)}`
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
                    html`<div class="lift__stall">
                      ${`Stuck at ${inp.w || "?"}×${last?.[last.length - 1]?.reps ?? "?"} for ${prog.stalled} sessions. Add a set, or swap the exercise.`}
                    </div>`
                  }
                  ${ex.note && !logged && html`<div class="lift__note">${ex.note}</div>`}
                  ${
                    logged &&
                    html`<div class="act">
                      <button class="ghost" onClick=${() => undoLast(ex.name)}>UNDO LAST</button>
                    </div>`
                  }
                  ${
                    // The pad NEVER locks. A lift past its prescription keeps
                    // accepting sets — an extra set is a record, not an error,
                    // and the sit-down between sets is the logging window.
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
                          aria-label=${`Log ${ex.name}`}
                          onClick=${() => logSet(ex.name)}
                        >
                          LOG
                        </button>
                        <span class="strike__why">
                          <b>
                            ${onTarget && prog ? prog.label : hasNumbers ? "your call" : "no history yet"}
                          </b>
                          ${
                            hasNumbers
                              ? `One press files ${inp.w}×${inp.r} and starts the ${restFor}s rest.`
                              : `Put in what you lifted. One press files it and starts the ${restFor}s rest.`
                          }
                        </span>
                      </div>
                    `
                  }
                </div>
              `;
            })}
          </div>
        `
      }
      ${
        // Conditioning, on the two upper-body mornings that carry it. Shown
        // beside the lifting rather than on a tab of its own, because P5 says
        // a screen you have to remember to visit is a screen that stays empty.
        cond &&
        html`
          <h2 class="band">
            Conditioning<span class="band__sub">${`${cond.minutes} min, after the lifting`}</span>
          </h2>
          <div class="rack">
            <div class="bar">
              <span class="bar__name">${cond.name}</span>
              <span class="bar__meta num">${`${cond.minutes} MIN`}</span>
            </div>
            <div class="bar">
              <span class="bar__name">${cond.work}</span>
              <span class="bar__meta num">WORK</span>
            </div>
            <div class="bar">
              <span class="bar__name">${cond.recovery}</span>
              <span class="bar__meta num">BETWEEN</span>
            </div>
          </div>
          <p class="note">
            ${cond.reduced ? `Short version: ${cond.work}. Same intensity, fewer reps, and it counts.` : `Short on time: ${cond.fallback}. Same intensity, and it counts.`}
          </p>
          ${cond.when && html`<p class="note"><b>${"When"}</b> ${cond.when}</p>`}
          <p class="note">
            ${"Apple Watch Cardio Fitness only moves from an Outdoor Run, Walk or Hike. A treadmill session never updates the number no matter how hard it was."}
          </p>
        `
      }

      <${CoreWorkout}
        sessions=${CORE_SESSIONS}
        title="Core"
        subtitle=${`today: ${sessionForDay(today, CORE_SESSIONS)?.name ?? "floor work"}, 4 to 6 min`}
        rotate=${true}
      />
      <p class="note">
        ${"Core is a daily rotation, not part of any lifting day, so a session with no core in it is not a session you got wrong. The only barbell-day core work in the whole programme is the side plank on Push B."}
      </p>

      ${
        // THE QUEUE. He asked to see what is coming: today, then Tuesday, then
        // Wednesday. The honest answer is a queue rather than a calendar,
        // because the rotation advances on completion, and the copy has to say
        // so or the dates read as a commitment the programme never made.
        queue.length > 0 &&
        html`
          <h2 class="band">What's coming<span class="band__sub">if you train every day</span></h2>
          <div class="rack">
            ${queue.map((q) => {
              const label =
                `${dayName(q.date)} ${relativeDayLabel(q.date, today) === "today" ? "· today" : ""}`.trim();
              if (q.rest) {
                return html`<div class="bar bar--rest" key=${q.date}>
                  <span class="bar__name">Rest</span>
                  <span class="bar__meta num">${label}</span>
                </div>`;
              }
              const mins = tierMinutes(q.template, 1);
              const c = conditioningForDate(/** @type {any} */ (workouts.conditioning), q.date);
              return html`<div class="bar" key=${q.date}>
                <span class="bar__name">
                  ${`${q.template?.name ?? "session"}${c ? ` + ${condTag(String(c.name))}` : ""}`}
                </span>
                <span class="bar__meta num">${`${label} · ${mins} MIN`}</span>
              </div>`;
            })}
          </div>
          <p class="note">
            ${"This is a queue, not a calendar. The rotation moves when you finish a session, never when the clock does, so a day you miss makes the next one later and never deletes it. The dates are only where the queue lands if you train on every training day."}
          </p>
        `
      }
      ${
        hasSchedule &&
        html`<div class="act">
          <button class="ghost" onClick=${() => setShowPicker((s) => !s)}>
            ${showPicker ? "HIDE THE LIST" : "LOG A DIFFERENT SESSION"}
          </button>
        </div>`
      }
      ${
        ((hasSchedule && showPicker) || (!hasSchedule && !template)) &&
        html`
          <h2 class="band">${hasSchedule ? "Pick a different session" : "Pick today's split"}</h2>
          <div class="rack">
            ${workouts.templates.map(
              (t) => html`
                <button
                  class="bar"
                  key=${t.id}
                  onClick=${() => {
                    onDraft({ ...draft, templateId: t.id });
                    setShowPicker(false);
                  }}
                >
                  <span class="bar__name">${t.name}</span>
                  <span class="bar__meta num">${`${t.exercises.length} lifts`}</span>
                </button>
              `,
            )}
            ${
              workouts.templates.length === 0 &&
              html`<div class="void">
                ${hasToken ? (loading ? "loading" : "no split templates yet") : "add a token in Rig to load your split"}
              </div>`
            }
          </div>
        `
      }

      <${ActivityLog} activities=${activities} today=${today} onLog=${onLogActivity} />

      <h2 class="band">Check-in</h2>
      ${
        // The dialog on first open of the day is where these get typed. This is
        // the read-back, plus a way in to correct a number later. The same three
        // fields inline as well would be a third copy of one surface.
        html`<div class="rack">
          <button class="bar" onClick=${onOpenCheckin}>
            <span class="bar__name">
              ${`${todayRow.weight != null ? `${todayRow.weight} lb` : "no weight"} · ${todayRow.sleepHours != null ? `${todayRow.sleepHours} h` : "no sleep"} · ${todayRow.pushups != null ? `${todayRow.pushups} pushups` : "no pushups"}`}
            </span>
            <span class="bar__meta num">EDIT</span>
          </button>
        </div>`
      }
      ${
        targets?.sleepHoursTarget &&
        html`<p class="note">
          ${`Sleep target ${targets.sleepHoursTarget}h${targets?.pushupTarget ? `, pushups ${targets.pushupTarget}` : ""}. Read from the food app, never written here.`}
        </p>`
      }
    </div>
  `;
}

import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { tokenBroken } from "../lib/github.js";
import {
  formatSets,
  lastSetsFor,
  setTopSet,
  templateForDate,
} from "../lib/workouts.js";

const REST_SECONDS = 90;

/** "lower-a" -> "Lower A" — short label for the rest-day "next up" line. */
const shortName = (/** @type {string} */ id) =>
  id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/**
 * Short label for the next scheduled session after today, e.g. "Pull A
 * tomorrow" — names what's coming instead of leaving the rest day blank.
 * @param {Record<string, string | null> | undefined} schedule
 * @param {Record<string, any>[]} templates
 * @param {string} todayIso
 * @returns {string | null}
 */
function nextSessionLabel(schedule, templates, todayIso) {
  if (!schedule) return null;
  for (let ahead = 1; ahead <= 7; ahead++) {
    const d = new Date(`${todayIso}T00:00:00`);
    d.setDate(d.getDate() + ahead);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const t = templateForDate(schedule, templates, iso);
    if (!t) continue;
    const when = ahead === 1 ? "tomorrow" : `in ${ahead} days`;
    return `${t.name ?? shortName(String(t.id))} ${when}`;
  }
  return null;
}

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
 *   onPatchDay: (patch: Record<string, any>) => void
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
  onPatchDay,
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
  const scheduled = templateForDate(
    workouts.schedule,
    /** @type {any} */ (workouts.templates),
    today,
  );
  const pickedTemplate = draft.templateId
    ? workouts.templates.find((t) => t.id === draft.templateId)
    : null;
  const template = hasSchedule ? (pickedTemplate ?? scheduled) : pickedTemplate;
  const nextLabel = hasSchedule
    ? nextSessionLabel(
        /** @type {any} */ (workouts.schedule),
        /** @type {any} */ (workouts.templates),
        today,
      )
    : null;
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

  /**
   * One numeric check-in field, committed on blur so a half-typed number is
   * never written.
   * @param {string} label
   * @param {string} field
   * @param {string} unit
   * @param {string} [step]
   */
  const checkin = (label, field, unit, step = "1") => html`
    <label class="lift" key=${field}>
      <div class="liftrow">
        <span class="food">${label}</span>
        <span class="q num">${todayRow[field] ?? "—"}${todayRow[field] != null ? unit : ""}</span>
      </div>
      <div class="setform">
        <input
          type="number"
          inputmode="decimal"
          step=${step}
          placeholder=${unit}
          aria-label=${`${label} today`}
          value=${todayRow[field] ?? ""}
          onBlur=${(/** @type {any} */ e) => {
            const raw = e.currentTarget.value.trim();
            if (raw === "") return;
            const n = Number(raw);
            if (!Number.isFinite(n) || n < 0) return;
            onPatchDay({ [field]: n });
          }}
        />
      </div>
    </label>
  `;

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
        !template &&
        hasSchedule &&
        html`
          <h2 class="block-title">Rest day</h2>
          <p class="hint">${nextLabel ? `next: ${nextLabel}.` : "nothing scheduled next."}</p>
        `
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
          <h2 class="block-title">${template.name}</h2>
          <div class="slots">
            ${template.exercises.map((/** @type {Record<string, any>} */ ex) => {
              const last = lastSetsFor(/** @type {any} */ (workouts.sessions), ex.name);
              const baseline = last ? null : baselines[ex.name];
              const logged = session?.exercises.find((/** @type {any} */ e) => e.name === ex.name);
              const inp = inputs[ex.name] ?? { w: "", r: "" };
              return html`
                <div class="lift" key=${ex.name}>
                  <div class="liftrow">
                    <span class="food">${ex.name}</span>
                    <span class="q num">${ex.targetSets}×${ex.targetReps}</span>
                  </div>
                  <div class="liftmeta num">
                    ${
                      // A real logged set always wins. Failing that, show the
                      // planned working weight rather than an em dash: "last: —"
                      // on every lift of a first session is the app telling him
                      // it knows nothing about a man whose numbers have been
                      // written down since July.
                      last
                        ? `last: ${formatSets(last)}`
                        : baseline
                          ? `plan: ${baseline.weight}×${baseline.reps}`
                          : "last: —"
                    }
                    ${logged && html` <b>· now: ${formatSets(logged.sets)}</b>`}
                  </div>
                  ${ex.note && html`<div class="hint">${ex.note}</div>`}
                  <div class="setform ${invalid === ex.name ? "inputerr" : ""}">
                    <input
                      type="number"
                      inputmode="decimal"
                      placeholder="lb"
                      aria-label=${`Weight for ${ex.name} (0 for bodyweight)`}
                      value=${inp.w}
                      onInput=${(/** @type {any} */ e) =>
                        onDraft({
                          ...draft,
                          inputs: { ...inputs, [ex.name]: { ...inp, w: e.currentTarget.value } },
                        })}
                    />
                    <input
                      type="number"
                      inputmode="numeric"
                      placeholder="reps"
                      aria-label=${`Reps for ${ex.name}`}
                      value=${inp.r}
                      onInput=${(/** @type {any} */ e) =>
                        onDraft({
                          ...draft,
                          inputs: { ...inputs, [ex.name]: { ...inp, r: e.currentTarget.value } },
                        })}
                    />
                    <button class="primary" onClick=${() => logSet(ex.name)}>LOG</button>
                  </div>
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
      <div class="slots">
        ${checkin("Sleep", "sleepHours", "h", "0.25")}
        ${checkin("Weight", "weight", "lb", "0.1")}
        ${checkin("Pushups", "pushups", "", "1")}
      </div>
      ${
        targets?.sleepHoursTarget &&
        html`<p class="hint">
          sleep target ${targets.sleepHoursTarget}h${targets?.pushupTarget
            ? `, pushups ${targets.pushupTarget}`
            : ""}
          — read from Mise, never written here
        </p>`
      }
    </div>
  `;
}

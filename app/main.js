// Anvil — the lifting half of Mise, on its own two feet.
//
// Split out of mise on 2026-08-18 (Crystal Lanes/Fitness-App-Build.md). The
// stack is deliberately identical to Mise's: zero build, preact + htm from an
// import map, an offline-first store over IndexedDB, one private data repo
// reached with a fine-grained PAT.
//
// Data lives in TWO repos, which is the one structural difference from Mise:
//   anvil-data   workouts.json, vitals.json, activities.json
//   mise-data    fitness/daily.json  (shared, both apps write it)
//                fitness/targets.json (Mise owns it, anvil only reads)
// See lib/github.js repoFor().

import { render } from "preact";
import { html } from "htm/preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { initRouter } from "./lib/router.js";
import { initStore, read, write, getSyncStatus, onSyncChange } from "./lib/store.js";
import { checkDataRepo, getToken, SHARED_DAILY, MISE_TARGETS, MISE_VITALS } from "./lib/github.js";
import { localIsoDate } from "./lib/dates.js";
import { upsertDay } from "./lib/daily.js";
import { addActivity } from "./lib/activities.js";
import { TodayView } from "./views/today.js";
import { CoreView } from "./views/core.js";
import { ProgressView } from "./views/progress.js";
import { VitalsView } from "./views/vitals.js";
import { SystemView } from "./views/system.js";
import { CheckinModal } from "./views/checkin-modal.js";
import { Glyph, Sigil } from "./views/glyphs.js";

// Five screens on a circular rail. The names are the app's own nouns: what is
// on the bar today, the floor work, the record, the watch, the machine.
const TABS = [
  { hash: "#/today", view: "today", glyph: "today", label: "Bar" },
  { hash: "#/core", view: "core", glyph: "floor", label: "Floor" },
  { hash: "#/progress", view: "progress", glyph: "progress", label: "Record" },
  { hash: "#/vitals", view: "vitals", glyph: "vitals", label: "Watch" },
  { hash: "#/system", view: "system", glyph: "system", label: "Rig" },
];

/** @param {string | null} at */
function formatSyncTime(at) {
  if (!at) return "";
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * The status lamp. Three states and no more: live, waiting, faulted. It never
 * goes green — this application has one accent colour and a lamp that changes
 * hue to say "fine" is a fourth thing to learn for no information.
 * @param {{ pending: number, flushing: boolean, lastError: string | null, lastSyncAt: string | null }} sync
 * @param {boolean} hasToken
 */
function lampFor(sync, hasToken) {
  if (!hasToken) return { cls: "is-off", text: "NO TOKEN" };
  if (sync.lastError) return { cls: "is-fault", text: String(sync.lastError) };
  if (sync.flushing && sync.pending > 0) return { cls: "is-off", text: `SAVING ${sync.pending}` };
  if (sync.pending > 0) return { cls: "is-off", text: `${sync.pending} QUEUED` };
  if (sync.lastSyncAt) return { cls: "is-live", text: `SYNCED ${formatSyncTime(sync.lastSyncAt)}` };
  return { cls: "is-live", text: "ONLINE" };
}

function App() {
  const [route, setRoute] = useState(/** @type {{ view: string }} */ ({ view: "today" }));
  useEffect(() => initRouter(setRoute), []);

  const [sync, setSync] = useState(getSyncStatus());
  useEffect(() => onSyncChange(() => setSync({ ...getSyncStatus() })), []);

  const [hasToken, setHasToken] = useState(Boolean(getToken()));
  const [repo, setRepo] = useState(/** @type {Record<string, any> | null} */ (null));
  useEffect(() => {
    if (!hasToken) return;
    void checkDataRepo().then(setRepo);
  }, [hasToken]);

  // ---- data ---------------------------------------------------------------

  const [workouts, setWorkouts] = useState(
    /** @type {{ templates: Record<string, any>[], sessions: Record<string, any>[], schedule?: Record<string, string | null>, bundled?: boolean, baselines?: Record<string, any> }} */ ({
      templates: [],
      sessions: [],
    }),
  );
  const [daily, setDaily] = useState(/** @type {{ days: Record<string, any>[] }} */ ({ days: [] }));
  // runs, tennis, bouldering, swims: everything that is training and is not a
  // barbell. Nothing measured any of this until his goals changed on 2026-08-19
  const [activities, setActivities] = useState(
    /** @type {{ activities: Record<string, any>[] }} */ ({ activities: [] }),
  );
  const [vitals, setVitals] = useState(/** @type {Record<string, any> | null} */ (null));
  const [targets, setTargets] = useState(/** @type {Record<string, any> | null} */ (null));
  const [loaded, setLoaded] = useState(false);
  const [vitalsLoaded, setVitalsLoaded] = useState(false);

  // The bundled programme. anvil is useless on first open without it: the
  // split lives in a PRIVATE data repo, so a fresh install with no token used
  // to render an empty screen that asked David to go and create a credential —
  // the fifth unfinished step in a chain where the observed completion rate of
  // such steps is zero. Structure ships in the app shell, is precached by the
  // service worker, and the repo copy overrides it the moment it loads.
  useEffect(() => {
    let alive = true;
    fetch(new URL("./data/program.json", import.meta.url))
      .then((r) => (r.ok ? r.json() : null))
      .then((prog) => {
        if (!alive || !prog) return;
        setWorkouts((cur) =>
          // never clobber the real thing, and never drop logged sessions
          cur.schedule === undefined && cur.templates.length === 0
            ? { ...cur, schedule: prog.schedule, templates: prog.templates, bundled: true }
            : cur,
        );
        setLoaded(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () => {
      read("workouts.json").then((w) => {
        if (!alive) return;
        if (w) setWorkouts(/** @type {any} */ (w));
        setLoaded(true);
      });
      read(SHARED_DAILY).then((d) => {
        if (alive && d) setDaily(/** @type {any} */ (d));
      });
      // anvil's own file first; fall back to the rows Mise's worker is still
      // writing until the phone is re-pointed (see MISE_VITALS)
      read("activities.json").then((a) => {
        if (alive && a) setActivities(/** @type {any} */ (a));
      });
      read("vitals.json").then((v) => {
        if (!alive) return;
        if (v && Array.isArray(/** @type {any} */ (v).days) && /** @type {any} */ (v).days.length) {
          setVitals(/** @type {any} */ (v));
          setVitalsLoaded(true);
          return;
        }
        read(MISE_VITALS).then((legacy) => {
          if (!alive) return;
          if (legacy) setVitals(/** @type {any} */ (legacy));
          setVitalsLoaded(true);
        });
      });
      // read-only: Mise owns this file, github.js refuses to write it
      read(MISE_TARGETS).then((t) => {
        if (alive && t) setTargets(/** @type {any} */ (t));
      });
    };
    load();
    const unsub = onSyncChange(load);
    return () => {
      alive = false;
      unsub();
    };
  }, [hasToken]);

  const workoutsRef = useRef(workouts);
  workoutsRef.current = workouts;
  const dailyRef = useRef(daily);
  dailyRef.current = daily;
  const activitiesRef = useRef(activities);
  activitiesRef.current = activities;

  const handleLogActivity = useCallback((/** @type {Record<string, any>} */ entry) => {
    const next = addActivity(
      /** @type {any} */ (activitiesRef.current),
      /** @type {any} */ (entry),
      crypto.randomUUID().slice(0, 8),
    );
    activitiesRef.current = next;
    setActivities(next);
    void write("activities.json", /** @type {any} */ (next));
  }, []);

  // The in-progress workout lives at App level, not inside the view:
  // navigating tabs mid-session must never discard logged sets. This was a
  // reviewer-flagged data-loss bug in Mise and the fix comes across with it.
  const [draft, setDraft] = useState(
    /** @type {{ templateId: string | null, session: Record<string, any> | null, inputs: Record<string, { w: string, r: string }> }} */ ({
      templateId: null,
      session: null,
      inputs: {},
    }),
  );

  const handleSaveSession = useCallback((/** @type {Record<string, any>} */ session) => {
    const w = workoutsRef.current;
    // sessions carry a unique id — the merge key — so two same-day sessions
    // (or two devices) can never collapse into each other on a 409 merge
    const withId = session.id ? session : { ...session, id: crypto.randomUUID().slice(0, 8) };
    const next = { ...w, sessions: [...w.sessions, withId] };
    workoutsRef.current = next;
    setWorkouts(next);
    void write("workouts.json", /** @type {any} */ (next));
  }, []);

  const handlePatchDay = useCallback((/** @type {Record<string, any>} */ patch) => {
    const next = upsertDay(/** @type {any} */ (dailyRef.current), localIsoDate(new Date()), patch);
    dailyRef.current = next;
    setDaily(next);
    // writes into MISE's repo: this row is shared and merge.js resolves it
    // field-wise, so anvil touching sleep/weight/pushups cannot clobber
    // Mise's water/supplements/dailyDozen on the same day
    void write(SHARED_DAILY, /** @type {any} */ (next));
  }, []);

  const today = localIsoDate(new Date());
  const todayRow = (daily.days ?? []).find((d) => d.date === today) ?? {};

  // The once-a-day check-in. Fires on the FIRST open of a local day and then
  // not again, whether he filled it in or saved nothing: a prompt that returns
  // on every navigation is a prompt that teaches him to dismiss it. The stamp
  // is local to the device on purpose, so a second device on the same day asks
  // again rather than silently assuming the first one caught it.
  const PROMPT_KEY = "anvil.checkinPromptedOn";
  const [checkinOpen, setCheckinOpen] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(PROMPT_KEY) === today) return;
    } catch {
      return; // storage disabled: never nag rather than nag on every open
    }
    setCheckinOpen(true);
  }, [today]);

  const closeCheckin = useCallback(() => {
    try {
      localStorage.setItem(PROMPT_KEY, today);
    } catch {
      // no storage, no stamp; the dialog simply reappears next open
    }
    setCheckinOpen(false);
  }, [today]);

  return html`
    ${
      checkinOpen &&
      html`<${CheckinModal}
        today=${today}
        row=${todayRow}
        onSave=${handlePatchDay}
        onClose=${closeCheckin}
      />`
    }
    <div class="hud">
      <span class="hud__mark"><${Sigil} />Anvil</span>
      ${(() => {
        const lamp = lampFor(/** @type {any} */ (sync), hasToken);
        return html`<span class=${`hud__state ${lamp.cls}`}>
          <span class="hud__lamp"></span>${lamp.text}
        </span>`;
      })()}
    </div>

    ${
      route.view === "today" &&
      html`<${TodayView}
        workouts=${workouts}
        daily=${daily}
        targets=${targets}
        today=${today}
        hasToken=${hasToken}
        repo=${repo}
        loading=${!loaded}
        draft=${draft}
        onDraft=${setDraft}
        onSaveSession=${handleSaveSession}
        onOpenCheckin=${() => setCheckinOpen(true)}
        activities=${activities.activities ?? []}
        onLogActivity=${handleLogActivity}
      />`
    }
    ${route.view === "core" && html`<${CoreView} />`}
    ${
      route.view === "progress" &&
      html`<${ProgressView}
        workouts=${workouts}
        daily=${daily}
        targets=${targets}
        today=${today}
        loading=${!loaded}
      />`
    }
    ${
      route.view === "vitals" &&
      html`<${VitalsView}
        vitals=${vitals}
        loading=${!vitalsLoaded}
        hasToken=${hasToken}
        today=${today}
      />`
    }
    ${
      route.view === "system" &&
      html`<${SystemView}
        sync=${sync}
        repo=${repo}
        hasToken=${hasToken}
        onToken=${() => setHasToken(Boolean(getToken()))}
      />`
    }

    <nav class="dock" aria-label="Sections">
      ${TABS.map(
        (t) => html`
          <a
            class=${`dock__tab ${route.view === t.view ? "is-active" : ""}`}
            aria-current=${route.view === t.view ? "page" : undefined}
            aria-label=${t.label}
            href=${t.hash}
          >
            <${Glyph} name=${t.glyph} />
            <span class="dock__name">${t.label}</span>
          </a>
        `,
      )}
    </nav>
  `;
}

initStore();

const root = document.getElementById("app");
if (root) render(html`<${App} />`, root);

if ("serviceWorker" in navigator) {
  // scope is ./ on purpose: anvil lives at janniksin.github.io/anvil/ and a
  // worker registered at the ORIGIN root would evict every sibling PWA
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("./sw.js", { scope: "./" });
  });
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

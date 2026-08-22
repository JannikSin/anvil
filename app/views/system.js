import { html } from "htm/preact";
import { useState } from "preact/hooks";
import {
  DATA_REPO,
  dataRepoOverridden,
  setDataRepo,
  setToken,
  tokenAgeDays,
  TOKEN_WARN_AGE_DAYS,
  tokenBroken,
  SHARED_DAILY,
  MISE_TARGETS,
} from "../lib/github.js";
import { Crest } from "./glyphs.js";

/**
 * The rig: the GitHub token, the data repo, sync state, and where vitals come
 * from. Deliberately small. There are no profiles here, no notification
 * pipeline and no tour, and none of those are coming.
 * @param {{
 *   sync: Record<string, any>,
 *   repo: Record<string, any> | null,
 *   hasToken: boolean,
 *   onToken: () => void
 * }} props
 * @returns {import("preact").VNode}
 */
export function SystemView({ sync, repo, hasToken, onToken }) {
  const [draft, setDraft] = useState("");
  const [repoDraft, setRepoDraft] = useState(
    dataRepoOverridden() ? `${DATA_REPO.owner}/${DATA_REPO.repo}` : "",
  );
  const [saved, setSaved] = useState(/** @type {string | null} */ (null));

  const ageDays = tokenAgeDays();
  const renewSoon = hasToken && ageDays != null && ageDays >= TOKEN_WARN_AGE_DAYS;
  const bad = tokenBroken(repo?.auth);

  const save = () => {
    const v = draft.trim();
    if (!v) return;
    setToken(v);
    setDraft("");
    setSaved("token saved — reload to sync");
    onToken();
  };

  return html`
    <div class="deck">
      <div class="crest">
        <${Crest} name="system" />
        <div class="crest__body">
          <h1 class="crest__title">Rig</h1>
          <p class="crest__sub">${`${DATA_REPO.owner}/${DATA_REPO.repo}`}</p>
        </div>
      </div>

      <h2 class="band">GitHub token</h2>
      ${
        // One interpolated sentence, no inline tags. htm drops any whitespace
        // run containing a newline where it touches a tag, so a wrapped
        // <b>repo</b> renders as "scoped toowner/repo" — and prettier rewraps
        // the line straight back into the bug. Verified in the browser, twice.
        html`<p class="note">
          ${`Fine-grained PAT, 1-year expiry. It must be scoped to ${DATA_REPO.owner}/${DATA_REPO.repo} (contents: read and write) AND ${DATA_REPO.owner}/mise-data, because the daily check-in row (${SHARED_DAILY}) is shared with the food app and the calorie targets (${MISE_TARGETS}) are read from there. A token scoped to only one of the two syncs half the app and reports no error.`}
        </p>`
      }
      <div class="field">
        <input
          class="input"
          type="password"
          autocomplete="off"
          placeholder=${hasToken ? "replace token" : "github_pat_…"}
          aria-label="GitHub personal access token"
          value=${draft}
          onInput=${(/** @type {any} */ e) => setDraft(e.currentTarget.value)}
        />
        <button class="cta" onClick=${save} disabled=${!draft.trim()}>SAVE</button>
      </div>
      ${saved && html`<p class="note">${saved}</p>`}
      ${
        hasToken &&
        html`<p class="note">
          ${`Saved ${ageDays != null ? `${ageDays} days ago` : "at an unknown date"}${renewSoon ? ". Renew it soon." : "."}`}
        </p>`
      }
      ${
        bad &&
        html`<p class="alarm">
          ${
            repo?.auth === "norepo"
              ? "The token authenticated but cannot see the repo. Check its selected repositories; do not mint a new one."
              : "GitHub rejected this token."
          }
        </p>`
      }
      ${
        repo?.privacy === "PUBLIC" &&
        html`<p class="alarm alarm--hot">
          ${"The data repo is PUBLIC. It holds body weight and sleep. Make it private."}
        </p>`
      }

      <h2 class="band">Data repo</h2>
      <div class="field">
        <input
          class="input"
          type="text"
          placeholder=${`${DATA_REPO.owner}/${DATA_REPO.repo}`}
          aria-label="Data repository, owner/repo"
          value=${repoDraft}
          onInput=${(/** @type {any} */ e) => setRepoDraft(e.currentTarget.value)}
        />
        <button
          class="ghost"
          onClick=${() => {
            if (!setDataRepo(repoDraft)) {
              setSaved("that is not an owner/repo");
              return;
            }
            setSaved("repo changed — reload the app");
          }}
        >
          SET
        </button>
      </div>

      <h2 class="band">Sync</h2>
      <div class="plates">
        <div class="plate">
          <div class="plate__k">Queued</div>
          <div class="plate__v">${sync.pending ?? 0}</div>
          <div class="plate__d">${sync.flushing ? "flushing" : "idle"}</div>
        </div>
        <div class=${`plate ${sync.conflicts > 0 ? "plate--warn" : ""}`}>
          <div class="plate__k">Conflicts</div>
          <div class="plate__v">${sync.conflicts ?? 0}</div>
          <div class="plate__d">${sync.lastError ?? "none"}</div>
        </div>
      </div>

      <h2 class="band">Apple Watch</h2>
      <p class="note">
        ${"Vitals arrive from the Health Auto Export app on the phone, posted to Anvil's Worker, which writes vitals.json. The app never reads HealthKit itself, so an empty Watch screen means the phone has not posted yet, not that anything is broken."}
      </p>
    </div>
  `;
}

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

/**
 * Settings: the GitHub token, the data repo, sync state, and the vitals
 * endpoint. Deliberately small — Mise's SYS tab is 20 KB because it carries
 * profiles, brigades, the notification pipeline and the tour. None of that
 * exists here.
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
    <div class="view">
      <div class="hero"><h1>Settings</h1></div>

      <h2 class="block-title">GitHub token</h2>
      ${
        // One interpolated sentence, no inline tags. htm drops any whitespace
        // run containing a newline where it touches a tag, so a wrapped
        // <b>repo</b> renders as "scoped toJannikSin/anvil-data" — and
        // prettier rewraps the line straight back into the bug. Verified in
        // the browser, twice.
        html`<p class="hint">
          ${`Fine-grained PAT, 1-year expiry. It must be scoped to ${DATA_REPO.owner}/${DATA_REPO.repo} (contents: read and write) AND ${DATA_REPO.owner}/mise-data, because the daily check-in row (${SHARED_DAILY}) is shared with Mise and the calorie targets (${MISE_TARGETS}) are read from there. A token scoped to only one of the two syncs half the app and reports no error.`}
        </p>`
      }
      <div class="setform">
        <input
          type="password"
          autocomplete="off"
          placeholder=${hasToken ? "replace token" : "github_pat_…"}
          aria-label="GitHub personal access token"
          value=${draft}
          onInput=${(/** @type {any} */ e) => setDraft(e.currentTarget.value)}
        />
        <button class="primary" onClick=${save} disabled=${!draft.trim()}>SAVE</button>
      </div>
      ${saved && html`<p class="hint">${saved}</p>`}
      ${
        hasToken &&
        html`<p class="hint">
          saved
          ${ageDays != null ? `${ageDays} days ago` : "at an unknown date"}${
            renewSoon ? " — renew it soon" : ""
          }
        </p>`
      }
      ${
        bad &&
        html`<p class="hint">
          ${
            repo?.auth === "norepo"
              ? "the token authenticated but cannot see the repo — check its selected repositories, do not mint a new one"
              : "GitHub rejected this token"
          }
        </p>`
      }
      ${
        repo?.privacy === "PUBLIC" &&
        html`<p class="hint">
          <b>the data repo is PUBLIC.</b> It holds body weight and sleep. Make it private.
        </p>`
      }

      <h2 class="block-title">Data repo</h2>
      <div class="setform">
        <input
          type="text"
          placeholder=${`${DATA_REPO.owner}/${DATA_REPO.repo}`}
          aria-label="Data repository, owner/repo"
          value=${repoDraft}
          onInput=${(/** @type {any} */ e) => setRepoDraft(e.currentTarget.value)}
        />
        <button
          class="secondary"
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

      <h2 class="block-title">Sync</h2>
      <div class="grid">
        <div class="tile">
          <div class="k">Queued</div>
          <div class="v num">${sync.pending ?? 0}</div>
          <div class="d">${sync.flushing ? "flushing" : "idle"}</div>
        </div>
        <div class="tile ${sync.conflicts > 0 ? "warn" : ""}">
          <div class="k">Conflicts</div>
          <div class="v num">${sync.conflicts ?? 0}</div>
          <div class="d">${sync.lastError ?? "none"}</div>
        </div>
      </div>

      <h2 class="block-title">Apple Watch</h2>
      <p class="hint">
        Vitals arrive from the Health Auto Export app on the phone, posted to anvil's Worker, which
        writes <span class="num">vitals.json</span>. The app never reads HealthKit itself, so an
        empty Vitals screen means the phone has not posted yet, not that anything is broken.
      </p>
    </div>
  `;
}

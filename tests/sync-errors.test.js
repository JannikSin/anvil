import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, describeSyncError } from "../app/lib/github.js";

/**
 * WHY THIS FILE EXISTS.
 *
 * David, 2026-08-24, having put a token in that morning: "genuinely, what is
 * the problem here? It says can't reach GitHub right now, auto retrying. Is
 * that a problem with GitHub itself, or is it our connection to it... It says
 * it's not syncing, the token needs fixing in Rig. The token was accepted, but
 * like, GitHub rejected it. I don't understand what this means."
 *
 * He was reading two messages that contradicted each other and neither was
 * true. The sync layer classified failures by running `/HTTP 40[13]/` over an
 * error MESSAGE STRING. A fine-grained PAT that is not scoped to the data repo
 * gets 404 on a write, because GitHub answers 404 rather than 403 so as not to
 * confirm that a private repo exists. 404 did not match that regex, so the
 * single most common real-world setup mistake was reported as a network
 * problem, with "auto-retrying" attached to a condition that no amount of
 * retrying can clear.
 *
 * The rule these tests enforce: EVERY failure names the thing to change, and
 * `needsYou` is true exactly when waiting will not help.
 */

const at = (status, rateLimited = false) =>
  describeSyncError(new ApiError("workouts.json", status, "write", rateLimited));

test("a 404 blames the repository scope, not the network", () => {
  // THE ONE THAT COST HIM A DAY.
  const d = at(404);
  assert.equal(d.fixable, true, "404 is not something waiting fixes");
  assert.match(d.text, /Only select repositories/i, "it must name the actual setting");
  assert.match(d.text, /anvil-data/, "and the repo the token cannot see");
  assert.doesNotMatch(
    d.text,
    /can't reach|auto.?retry|offline|connection/i,
    "a 404 is not a reachability problem and must never be described as one",
  );
  assert.match(d.text, /Do not mint a new token/i, "minting a new one repeats the same mistake");
});

test("a 401 blames the token itself, a 403 blames its permissions", () => {
  // These are different repairs and the old code gave them the same sentence.
  assert.match(at(401).text, /expired, revoked or mistyped/i);
  assert.match(at(403).text, /Contents must be Read and write/i);
  assert.notEqual(at(401).text, at(403).text, "two different faults, two different fixes");
});

test("a rate limit is the one 403 that is NOT the user's problem", () => {
  const d = at(403, true);
  assert.equal(d.fixable, false, "rate limiting clears on its own; telling him to act is wrong");
  assert.match(d.text, /rate.?limit/i);
  assert.doesNotMatch(d.text, /paste|renew|mint/i, "there is nothing for him to do");
});

test("only a genuine network failure is described as a network failure", () => {
  const offline = describeSyncError(new TypeError("Failed to fetch"));
  assert.equal(offline.fixable, false);
  assert.match(offline.text, /reach GitHub/i);

  // and a missing token says so plainly rather than blaming the network, which
  // is what it used to do: authedHeaders throws "no token set" and that fell
  // through to the same "can't reach GitHub" branch
  const none = describeSyncError(new Error("no token set"));
  assert.equal(none.fixable, true);
  assert.match(none.text, /No token saved/i);
});

test("every classified failure gives him something to do or tells him to wait", () => {
  for (const status of [401, 403, 404, 409, 422, 500, 503]) {
    const d = at(status);
    assert.ok(d.text.length > 20, `${status} produced no usable sentence`);
    assert.equal(typeof d.fixable, "boolean", `${status} does not say whether waiting helps`);
  }
});

// ---------------------------------------------------------------------------
// ONE UNREACHABLE REPO MUST NOT BLOCK THE OTHER.
//
// Added 2026-08-25. David minted a fine-grained token scoped to `anvil-data`,
// which is the repo his SESSIONS live in, and still nothing synced at all. His
// question was exactly the right one: "does the token need to be able to access
// mise-data? I assume the anvil app only needs to access the anvil repo."
//
// Anvil writes to two repositories: its own, and mise-data for the shared daily
// check-in row. The flush loop pushed oldest-first and `break`ed on any
// non-conflict error. So a check-in saved in the morning queued
// fitness/daily.json AHEAD of the day's session, 404'd against a repo the token
// could not see, broke the pass, and workouts.json was never even attempted
// despite anvil-data being perfectly reachable.
//
// Rig's own copy claimed a half-scoped token "syncs half the app". It synced
// none of it.
import { stopsTheWholePass } from "../app/lib/store.js";

test("a scope or permission failure is per-FILE and never stops the queue", () => {
  for (const status of [401, 403, 404, 422]) {
    assert.equal(
      stopsTheWholePass(at(status)),
      false,
      `HTTP ${status} stopped the whole pass. It is a property of one file, and the ` +
        "files behind it may be in a repo the token can reach perfectly well.",
    );
  }
});

test("a genuine reachability failure DOES stop the pass, because nothing else will push", () => {
  assert.equal(stopsTheWholePass(describeSyncError(new TypeError("Failed to fetch"))), true);
  assert.equal(stopsTheWholePass(at(403, true)), true, "a rate limit blocks every file equally");
});

test("the two repos are genuinely both needed, so the copy cannot go back to 'half'", async () => {
  // repoFor is the authority. If this ever routes everything to one repo the
  // scope advice changes, and this test should be the thing that notices.
  const { repoFor, SHARED_DAILY, MISE_TARGETS } = await import("../app/lib/github.js");
  assert.equal(repoFor("workouts.json").repo, "anvil-data", "sessions live in anvil's own repo");
  assert.equal(repoFor("activities.json").repo, "anvil-data");
  assert.equal(repoFor(SHARED_DAILY).repo, "mise-data", "the daily check-in row is SHARED");
  assert.equal(repoFor(MISE_TARGETS).repo, "mise-data", "and the targets are read from there");
});

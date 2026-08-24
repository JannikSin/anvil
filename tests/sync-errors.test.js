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

# Anvil

The lifting half of Mise, on its own two feet. Split out on 2026-08-18; the
plan of record is Crystal `Lanes/Fitness-App-Build.md`.

Live at `janniksin.github.io/anvil`. Data in the private `JannikSin/anvil-data`.
Zero build: static HTML, CSS and ES modules, `preact` + `htm` vendored, an
import map in `index.html`. There is nothing to compile and nothing to bundle.

## The rules that are not negotiable

**1. Anvil and Mise share an origin.** Every one of David's PWAs lives on
`janniksin.github.io`. localStorage, IndexedDB and Cache Storage are scoped per
ORIGIN, not per path. That means:

- localStorage keys are `anvil.*`. Never `mise.*`. A key named `mise.pat` here
  makes anvil read Mise's GitHub token and write to Mise's data repo.
- `DB_NAME` is `"anvil"`.
- The service worker cache is `anvil-shell-vN`, registered with scope `./`,
  never at the origin root.
- `activate` deletes only caches starting with `anvil-shell-`. Mise still ships
  `keys.filter((k) => k !== CACHE_VERSION)`, which deletes every cache on the
  origin; Tally, Finesse, Bonmot, Grandstand and AIMap were prefix-scoped on
  2026-07-27, so Mise is the one app still evicting its siblings on every
  deploy. `tests/origin.test.js` guards all of this.

**2. Two data repos.** `lib/github.js` `repoFor()` routes by path:

| Path | Repo | Access |
|---|---|---|
| `workouts.json`, `vitals.json`, `activities.json` | `anvil-data` | read + write |
| `fitness/daily.json` | `mise-data` | read + write, SHARED with Mise |
| `fitness/targets.json` | `mise-data` | read only, enforced in `writeFile` |

The PAT must be scoped to both repos or half the app silently does nothing.

**3. The shared daily row.** `fitness/daily.json` carries anvil's fields
(sleepHours, weight, pushups) beside Mise's (water, supplements, dailyDozen) on
the same day object. `lib/daily.js` `upsertDay` must stay a shallow field patch
in BOTH repos; anything that rewrites the whole row drops the other app's data
on every write. `tests/daily.test.js` pins this.

**4. Anvil never writes a calorie number.** Nutrition is Mise's job.

**5. Sessions carry an id.** It is the merge key. Two same-day sessions, or two
devices, collapse into one without it.

## Gates before any push

```
npx eslint .
npx tsc --noEmit -p jsconfig.json
node --test "tests/*.test.js"
```

All three green, then **open the app and press the thing**. A source-scan test
proves the file says the right words, not that the button responds.

Bump `CACHE_VERSION` in `sw.js` whenever app code changes, and add any new
module to the `SHELL` list — `tests/origin.test.js` walks the real import graph
and will fail if you forget.

## htm whitespace, learned the hard way

htm drops any whitespace run containing a newline where it touches a tag. So

```js
html`<p>scoped to
  <b>${repo}</b>, because…</p>`   // renders "scoped torepo, because…"
```

A word and its neighbouring inline tag must sit on the SAME line — and prettier
will rewrap a long line straight back into the bug. For sentences with values
in them, interpolate one whole string instead of using inline tags.

## The worker

`worker/` is a single-route Cloudflare Worker: `POST /vitals` accepts Health
Auto Export payloads and writes `vitals.json`. Secrets `VITALS_KEY` and
`ANVIL_DATA_WRITE_TOKEN`, set with `wrangler secret put`, never in a file. The
metric map in `worker/src/lib.js` was verified against a real export payload;
unrecognised metric names are echoed back in the response rather than dropped.

## What stayed in Mise

Calorie and protein targets, allergens, the food half of the daily check-in,
the streak, `music.js` (cook mode uses it) and `awake.js` (same). Anvil has its
own copies of the last two.

# Anvil

A lifting app that runs with no build step, no server, no framework and no npm dependency at runtime.

**Live: [janniksin.github.io/anvil](https://janniksin.github.io/anvil/)**

It tracks a six-day training rotation, times the floor work, and tells you what to put on the bar next. It was split out of a larger nutrition app in a single evening and rebuilt around one idea: **the app should make a decision so the person does not have to.**

---

## Why it is built this way

Every dependency in a personal app is a thing that breaks while you are standing in a gym with 90 seconds of rest left. So there is nothing to break:

- **No build step.** `index.html` declares an import map; the browser loads ES modules directly. There is no bundler, no transpiler and no `dist/`.
- **No runtime dependencies.** Preact and htm are vendored as `.module.js` files and checked in, pinned by file rather than by semver range.
- **No server.** State lives in IndexedDB and syncs to a private GitHub repo through the Contents API with a fine-grained token. The only backend is a single-route Cloudflare Worker that ingests Apple Health exports.
- **Offline first, and meant literally.** The service worker precaches the whole shell including the programme data, so the app opens and logs a full session in a gym basement with no signal.

Types come from JSDoc checked by `tsc --noEmit`, so the code that ships is the code that was written.

```
app/lib/      pure logic, unit tested, no DOM    (rotation, progression, merge, sync, store)
app/views/    preact components via htm tagged templates
app/data/     the programme, bundled so first run needs no account
worker/       one route: POST /vitals, Apple Health ingest
tests/        node --test, no framework
```

---

## The parts worth reading

**`app/lib/workouts.js` — progression as a pure function.** The app prefills the next set rather than the last one: add a rep toward the top of the range, and once the top is cleared, add load and reset to the bottom. It returns `null` rather than guessing when it cannot read a prescription (`"10 min"`, `"max time"`), and the caller falls back to a plain repeat. Three identical sessions raise a stall flag, because at that point more reps is not the answer.

**`app/lib/merge.js` and `sync.js` — offline writes that survive a conflict.** Writes land in IndexedDB immediately and queue. On flush, a stale SHA raises `ConflictError`, the file is re-read, merged field-wise against its base, and retried. Two devices editing the same day's row do not clobber each other, which matters because one data file is genuinely shared with a second application.

**`app/lib/github.js` — a two-repo router.** Most files belong to this app's private repo; two specific paths belong to a sibling app's. `repoFor(path)` routes by path, and `writeFile` physically refuses to write the file this app must never own. The refusal is code, not a comment, because the failure mode is silent corruption of another app's data.

**`app/styles.css` and `app/views/ring.js` — the interface, rebuilt from zero.** The app inherited its parent's stylesheet at the split, which meant a lifting app dressed as a kitchen: a green accent, a card feed, and about four hundred lines styling recipes, cook mode and food safety that nothing here has ever rendered. The rebuild has one accent, one surface shape (a rectangle with two chamfered corners) and one radial primitive: everything measured or timed is an arc eating a ring, and all of it comes through `ring.js` so the stroke weight, cap and start angle cannot drift apart between screens. `tests/design.test.js` holds the line.

**`sw.js` — cache isolation on a shared origin.** Six applications share `janniksin.github.io`. Cache Storage, localStorage and IndexedDB are scoped per **origin**, not per path, so a sibling's service worker running `keys.filter(k => k !== CACHE_VERSION)` deletes every other app's cache on every deploy. This one deletes only its own prefix, and `tests/origin.test.js` fails the build if that check is ever removed.

---

## Testing

```bash
node --test "tests/*.test.js"   # 192 tests
npx eslint .
npx tsc --noEmit -p jsconfig.json
```

The interesting tests are the ones that encode a lesson rather than a behaviour:

- **`origin.test.js`** walks the real import graph and fails if a module is missing from the service worker's precache list, and greps the source with comments stripped so a warning comment cannot be mistaken for the bug it warns about.
- **`design.test.js`** parses every colour in the stylesheet and fails if any of them is green, lists the parent app's dead selectors by name so re-adding one is a deliberate act, and asserts that every stick-figure keyframe is actually attached to a selector. That last one exists because for the life of the app the figures had eight animations declared and none of them referenced, so every figure stood still and nothing could tell.
- **`program-bundle.test.js`** asserts the public data file contains no loads, no body details and no second-person facts. The repo is public; the private repo holds anything measured about a person.
- **`progression.test.js`** asserts that every charted lift actually exists in the programme. That test exists because it did not: four chart names were carried over from the parent app and three referred to exercises that were not in the programme, so three charts could never have plotted a point, and a full green suite did not notice because every assertion was on source text rather than on data.

---

## What it deliberately does not do

No accounts, no analytics, no notifications, no social features, no streaks and no percentages. A missed day makes the next session later rather than deleting it: the rotation advances on completion, not on the calendar, so the app has no way to represent being behind.

---

MIT.

# Anvil: the doctrine

> [!warning] **This is a v1 doctrine, and the standard moved on 2026-08-29.**
> Everything below is true and came out of this app's own history, so none of it is wasted. But the
> six-article shape was invented rather than researched, and the research (Amazon tenets, Nygard's
> Architecture Decision Records, design-doc non-goals) says these are **three documents, not one**.
> **What changes:** the prohibitions become *invariants* with a test named against each, the
> "settled" list becomes numbered decision records that can be marked *superseded* instead of
> silently going stale, the failure table becomes an incidents file, and the doctrine itself is
> capped at one page. **Awaiting David's review and go.** Standard: Crystal `System/App-Doctrine.md`.

**What this file is.** The governing principles of this app: what it is for, what
it will never do, which decisions are already settled, and how to tell a good
change from a bad one. `CLAUDE.md` says how to work here. Crystal
`Lanes/Anvil-Core-Purpose.md` says what Anvil promises, in eleven numbered
promises the test suite enforces. **This says what is true regardless of the
code**, and it outranks `CLAUDE.md` where they disagree. It does not outrank the
Core Purpose.

Written 2026-08-28 (session **trinity**) under the standard David set that day.
Shape: Crystal `System/App-Doctrine.md`.

---

## Article 0. The job

**Anvil is the lifting half of Mise, on its own two feet: it makes logging a
session cost less than skipping it.**

Split out 2026-08-18. Eleven promises in four acts, each with a done test, and
**P4 is the keystone: logging costs less than skipping it.** P4 wins every tie.

**Therefore every change answers two questions, not one.** The first is which
promise number it serves. The second is specific to this app: **does it add an
action to logging?** If it does, it needs a promise number *and* an argument,
because the whole app is a bet that friction is the only thing standing between
him and a logged session.

---

## Article 1. The behaviour it is built around

**Zero sessions were ever logged in the first version, and the one workout he did
log was destroyed** by a `useState` that iOS discarded when the PWA backgrounded.
No error, no trace, a whole morning of lifting gone, and the warning that would
have said so was gated permanently off.

That single incident sets three of this app's hardest rules (Article 2.1, 2.2 and
Article 3's draft rule). **The user of this app is someone who will lose a
session to a backgrounded tab and never come back**, and every design decision
assumes it.

The second measured fact is the same one that governs Mise: **he logs
retroactively or not at all.** A late entry is a first-class entry, which is why
a session's date is data rather than the clock.

---

## Article 2. What Anvil will never do

1. **Nothing logged may live only in memory.** The in-progress session writes to
   `localStorage` through `lib/draft.js` on every change, keystrokes included.
   **localStorage rather than IndexedDB on purpose:** it is synchronous, so the
   write lands before the page can be killed, whereas an IDB transaction opened
   in a page's last moments is exactly the write that does not commit. Any new
   kind of in-progress state goes through the same door.
2. **Never stamp a write with `new Date()`.** The date lives in the draft and the
   session screen carries a control for it. P4 says a late entry is first class;
   a clock stamp silently makes it a lie.
3. **Never write a calorie number.** Nutrition is Mise's job. Two apps writing
   one number is how the 210-against-190 protein conflict happened.
4. **Never render a person as behind.** A lower tier, a skipped day and a short
   session all use the same blue as a full one. This is a colour rule as much as
   a copy rule, and `tests/design.test.js` enforces the colour half.
5. **Never let Anvil resemble Mise.** Rebuilt from zero 2026-08-22 on David's
   instruction: it must not be traceable to the app it came from. If you are
   typing `.food`, `.checkrow`, `.slots`, `.tile` or `.hint`, you are copying
   from the other app.
6. **Never use green.** One accent (`--arc` #2f6bff), cyan for live, amber for
   caution, red for a broken pipe. The test parses every colour in the sheet and
   rejects any whose green channel leads both others.
7. **Never rewrite the whole shared daily row.** `upsertDay` is a shallow field
   patch in both repos. Anything that rewrites the row drops the other app's data
   on every write.

---

## Article 3. Settled. Do not re-litigate

- **Two data repos, routed by path.** `workouts.json`, `vitals.json`,
  `activities.json` to `anvil-data` read and write; `fitness/daily.json` to
  `mise-data` read and write, shared with Mise; `fitness/targets.json` to
  `mise-data` **read only, enforced in `writeFile`**. The PAT must be scoped to
  both repos or half the app silently does nothing.
- **Origin hygiene.** localStorage keys are `anvil.*`, `DB_NAME` is `"anvil"`,
  the cache is `anvil-shell-vN` scoped `./`, and `activate` deletes only caches
  starting with `anvil-shell-`. `tests/origin.test.js` guards all of it. A key
  named `mise.pat` here makes Anvil read Mise's token and write to Mise's repo.
- **Sessions carry an id.** It is the merge key. Without it two same-day sessions
  or two devices collapse into one.
- **The plate, the ring, the vocabulary.** Every surface is a rectangle with
  top-left and bottom-right chamfered via `--plate-cut`, never a rounded card.
  Anything measured or timed is an arc eating a circle and goes through
  `views/ring.js`. The noun list is fixed: `deck, crest, band, plate, rack, bar,
  lift, setpad, knob, strike, tierpad, timer, gauge, dock, sheet, note, void,
  alarm`.
- **The clip-path layering order.** `clip-path` establishes a stacking context,
  so a `z-index: -1` pseudo inside a clipped element is clamped and paints above
  its own background. **The element carries the edge colour, the `::before`
  carries the fill at `inset: 1px`.** The intuitive way floods every surface with
  the edge colour, which is what the first cut of the rebuild did.
- **htm eats whitespace runs containing a newline where they touch a tag.** A
  word and its neighbouring inline tag sit on the same line, and prettier will
  rewrap a long line straight back into the bug. For sentences with values,
  interpolate one whole string.
- **Promise status lines change in the same commit as the code.** This test
  exists because Mise's equivalent document promised a protein ceiling that was
  never implemented and nobody noticed.

---

## Article 4. How to tell a good change from a bad one

1. **Which promise number, and does it add an action to logging?** If it adds an
   action, it needs an argument that beats P4. Most do not.
2. **Can the phone be killed mid-set without losing anything?** Article 2.1.
3. **Does it still work when he logs it two days late?** Article 2.2.
4. **Would a Mise session recognise the design?** If yes, it is off-doctrine.
5. **Three gates green, then press the thing.** `npx eslint .`,
   `npx tsc --noEmit -p jsconfig.json`, `node --test "tests/*.test.js"`, then open
   the app. A source-scan test proves the file says the right words, not that the
   button responds.
6. **Bump `CACHE_VERSION` and add new modules to `SHELL`.**
   `tests/origin.test.js` walks the real import graph and fails if you forget.

---

## Article 5. The failure modes this app is armed against

| Failure | What happened | The armour |
|---|---|---|
| In-memory state discarded by iOS | a whole morning of lifting, no error | `lib/draft.js`, synchronous localStorage |
| A clock stamp overwriting a late entry | every session dated at write time | date lives in the draft |
| Sibling data loss on a shared row | Mise's fields dropped by a full-row write | shallow patch, `tests/daily.test.js` |
| Cross-app storage collision | one origin, six PWAs | `anvil.*` keys, `tests/origin.test.js` |
| Design drift back to the parent app | ~400 lines of Mise's sheet at the split | `tests/design.test.js` |
| A number two apps both write | 210 g against 190 g protein | Anvil never writes a calorie number |

---

## Article 6. Kill conditions

**PROPOSED, not adopted. Needs David's named yes.**

Anvil exists because logging was too expensive. Review **2026-12-18**. It has
failed at Article 0 if by then:

- **fewer than 40 sessions were logged across the semester**, which is under two
  a week against a six-day plan, meaning the friction was never the binding
  constraint; or
- **more than a quarter of logged sessions were entered on the same day they
  happened but re-edited later**, meaning the capture path is still wrong; or
- **the split itself never paid**: no feature was built here that could not have
  lived in Mise, in which case the second icon is not earned.

---

## One correction this doctrine carries

`CLAUDE.md` states that **Mise is the one app still evicting its siblings' caches
on every deploy.** That was true when written and **is no longer true**: Mise's
`sw.js` was prefix-scoped on 2026-08-18 and now filters `caches.keys()` by
`mise-`, verified 2026-08-28. Every app on the origin is prefix-scoped. The rule
for Anvil is unchanged; only the claim about the sibling is stale.

---

*Companion documents: `CLAUDE.md` (how to work here), Crystal
`Lanes/Anvil-Core-Purpose.md` (the eleven promises), Crystal
`System/App-Doctrine.md` (this shape).*

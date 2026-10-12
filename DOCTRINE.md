# Anvil: the doctrine

One page, by amendment only. What Anvil is for, what it deliberately is not, how a tie is
broken, and what must never happen. The promises live in Crystal `Lanes/Anvil-Core-Purpose`
(the goals document, machine-checked by `tests/promises.test.js`). Settled choices live in
`docs/decisions/`, one file each with a status. What has gone wrong lives in
`docs/incidents.md`. How to work here is `CLAUDE.md`. Shape: Crystal `System/App-Doctrine`
(v2). Rewritten from the v1 six-article form on 2026-10-12; v1 is in git history (05c697b).

## The job

**Anvil is your trainer and your daily routine on one page: it issues a complete,
evidence-backed plan for your goal, reminds you until each item is done and recorded, and
makes recording cost less than skipping.** A feature must be able to lose to this sentence.

## Non-goals

- **Nutrition.** No calories, macros, recipes or meals; Mise owns what is eaten.
- **A medical record.** Heart rate and sleep are training inputs. A symptom goes to a
  clinician, and the app is never what decides it does not need to.
- **A programme library.** It runs one evidence-backed programme per person, not a catalogue
  to browse.
- **A social app.** No feeds, sharing, friend graph or leaderboards.
- **Scorekeeping.** No streaks, percentages, completion rates or red days (Core Purpose P9).

~~**No notifications.**~~ Struck 2026-10-12 on David's yes (decision 0004); its reason
survives as the reminder invariants below.

## Tenets, in order, unless you know better ones

Adopted 2026-10-12 on David's approval (decision 0005). The order breaks ties.

1. **The plan covers the goal and the whole body.** Every week trains every major muscle
   group at a productive volume, plus one conditioning session and mobility; a plan with a
   gap is not issued. This costs skipping the work you enjoy less.
2. **Evidence before novelty.** Every exercise, cue and number traces to published research
   through a short list of vetted sources, and a study outranks a personality. This costs
   speed of change and popular trends.
3. **Technique before time.** Sessions are compressed with supersets and compound lifts,
   never at the cost of form. This costs the shortest possible session and heavier loads.
4. **Attendance before perfection.** A short session counts, a missed day is never shown as
   failure, and the next session is always achievable. This costs the ambitious plan on
   screen.
5. **Recording costs less than skipping, and the app persists until it is done.** Reminders
   repeat until the item is recorded. This costs quiet.
6. **One page per day.** Weight, sleep, the routine, supplements and the day's session live
   on one screen. This costs every other screen.
7. **Coach, not counter.** Each step states what to do, the load, why, and the one cue that
   matters. This costs the simplicity of a bare log.

## Invariants

Absolute, testable, each with its cause and the thing that enforces it.

| Invariant | Cause | Enforced by |
|---|---|---|
| Nothing logged lives only in memory | a morning of lifting lost to a backgrounded tab (incidents) | `lib/draft.js`, synchronous localStorage; `tests/draft.test.js` |
| A write is never stamped with the clock; the date is data | late entries filed as today (incidents) | the date in the draft; `tests/promises.test.js` P4 |
| Anvil never writes a calorie number | 210 g against 190 g, two writers (incidents) | `writeFile` refuses `fitness/targets.json`; `tests/promises.test.js` |
| A person is never rendered as behind | Core Purpose P9 | `tests/design.test.js`, `tests/promises.test.js` P9 |
| Anvil never resembles Mise, and uses no green | the split carried Mise's sheet (decision 0008) | `tests/design.test.js` |
| The shared daily row is patched field by field, never rewritten | Mise's fields dropped by a full-row write (incidents) | `upsertDay`; `tests/daily.test.js` |
| Every storage key, cache and database is `anvil`-prefixed, and cleanup deletes only its own | one origin, six PWAs (decision 0006) | `tests/origin.test.js` |
| One profile per person; Anvil writes only the training section | two apps writing one number (decision 0002) | not yet; owed by the redo |
| A reminder never fires for an item already recorded | the reason "No notifications" existed (decision 0004) | not yet; gate register P15 |
| A reminder never breaks through Do Not Disturb | David's ruling, 2026-10-12 (decision 0004) | not yet; gate register P15 |

## Amending this doctrine

**The job, the non-goals and the invariants change only by amendment.** An amendment names
the clause, states the reason the clause exists, states why that reason no longer holds, and
carries **David's named yes**. A superseded clause is **struck through and kept**, with the
date and what replaced it. It is never deleted, because the next person to propose the same
change needs to find the argument that was already had.

**Tenets are open season, by design.** They end with *unless you know better ones*.
Proposing a better tenet is not a challenge to the doctrine, it is the doctrine working. A
tenet still needs David's yes to change, but it does not need an incident.

**Invariants retire only when their cause is gone**, never because they are inconvenient. If
the incident that created an invariant can no longer occur, say why, and strike it.

**A session may not work around a clause silently.** Doing so once means either the clause
was wrong or the work was wrong, and either way it gets said out loud.

**The kill conditions are not amendable by a session at all.** Only David changes those.

## Kill conditions (PROPOSED 2026-08-28, not adopted; David's named yes required)

Review **2026-12-18**. Anvil has failed at the job if by then:

- **fewer than 40 sessions were logged across the semester**, under two a week against a
  six-day plan, meaning friction was never the binding constraint; or
- **more than a quarter of logged sessions were entered on the day but re-edited later**,
  meaning the capture path is still wrong; or
- **the split never paid**: nothing was built here that could not have lived in Mise.

Proposed addition, 2026-10-12 (tweener), for David to accept or strike: **the routine card
is ticked on fewer than half of days in its first month**, meaning one page and reminders did
not make recording cheaper than skipping.

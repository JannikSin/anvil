# 0012. Today only, and one fixed routine

- **Status:** accepted; amends Core Purpose P4 (the back-dating clause) and P14
- **Date:** 2026-10-13
- **Deciders:** David
- **Tenet invoked:** 4 (attendance before perfection) and 6 (one page per day)

## Context

P4 promised that a late entry is first class: the session screen, the check-in and the routine
card all stepped back to earlier days. In use, a draft started on 10/11 was still on screen on
10/13, and the routine shipped as a builder (wake, breakfast and lights-out times typed into
Settings). David, 2026-10-13: "I don't really want to be able to backtrack through days and
record things. If I miss recording a set, I missed recording the set ... If I missed a day, I
missed a day, it's gone." And on the routine: "Just tell me the routine. Don't make me create it
on the spot there. There is one set routine that I do, and that's it."

## Options considered

- **Keep back-dating.** Complete records; a screen that can sit on the wrong day, and a choice
  on every open.
- **Today only, and a draft left from an earlier day is dropped.** Simplest; throws away sets
  that were really lifted and recorded but not filed.
- **Today only, and a draft left from an earlier day is filed under its own date, once.** The
  screen is always today; nothing that was recorded is lost (the invariant that came from the
  morning of lifting lost on 2026-08-24).
- **A routine builder versus one fixed routine.** The builder fits any person from Settings; the
  fixed routine fits the person using it, with nothing to set up.

## Decision

Today only. No date control on the session, the check-in or the routine card. A draft from an
earlier day that holds sets is filed under its own date when the app opens, and an empty one is
dropped. The routine is one fixed list that ships with the programme (`program.json` `routine`,
Crystal `Life/Daily-Routine`), read first and ticked second; the builder and the Settings editor
are removed. Supplements still come from the profile.

## Consequences

The app always opens on today and asks nothing before the routine shows. What gets worse: a
weigh-in or a tick missed yesterday cannot be added, so the 7-day weight average has gaps; and a
second person would need their routine written into the programme rather than set from the
screen, which the Core Purpose's "a second profile gets a different app" clause now has to
answer for at the next review.

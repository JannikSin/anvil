# 0016. The Gym tab is folded, numbers are typed, the rest timer waits for a tap

- **Status:** accepted
- **Date:** 2026-10-18
- **Deciders:** David
- **Tenet invoked:** 5 (recording costs less than skipping), 6 (one page per day)

## Context

The Gym tab ran about six phone screens: every lift open with its steppers, cue, why, source and
note box. David, 10/18: "just looking at it, it should basically just show all the exercises."
He also said typing a number is "slightly preferable" to plus and minus buttons, that he does not
use the rest timer and may log three lifts at once after the fact, and that when a machine is taken
he does the lifts out of order rather than swapping.

## Decision

- Each lift is one line (name, sets x reps, the weight to use, a tick once logged). Tap it: the
  log row (typed weight, typed reps, Log). Tap Notes inside it: the coaching (effort, rest, cue,
  why, the block's superset rule, source, the note box). Tap the lift again to fold it. A logged
  lift folds itself.
- No plus or minus buttons. The P4 "no keyboard" clause gives way to his word.
- The listed order is the plan and stays the default. Any lift still logs at any time, in any
  order, for when a machine is taken (David, 10/18). No swap button.
- The rest timer is a Rest button beside Notes on the open lift; it starts only on that tap and
  LOG never starts it ("if I want to start the timer it should still be a button there", 10/18;
  a first cut put it behind Settings, reversed the same day).
- History: the open lift's Notes show its dated top sets, and once the record spans 28 days and
  holds 3 sessions, a chart of the top set by date with the y-axis from zero (his plot rule).
  The four sessions of 8/25 to 8/31, dropped from workouts.json by a 10/14 write from an older
  build, are restored; they are filed as earlier than the block, so they feed history, not the queue.
- A top set under the bottom of its range steps the next prefill down one increment, back to the
  bottom of the range (75 x 3 used to prefill 75 x 4).

## Consequences

The session is one screen to scan. The coaching is one extra tap away, so it is read when wanted
rather than scrolled past. Starting loads for lifts with no record live in the private profile
(anvil-data profile.json); a lift with none asks for its weight once.

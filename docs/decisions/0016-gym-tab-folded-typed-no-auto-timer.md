# 0016. The Gym tab is folded, numbers are typed, the rest timer is off

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
- Any lift logs at any time, in any order. No swap button.
- The rest timer is off by default (Settings > Rest timer). When on, it is a Rest button beside
  Notes; LOG never starts it. The timer code stays.
- A top set under the bottom of its range steps the next prefill down one increment, back to the
  bottom of the range (75 x 3 used to prefill 75 x 4).

## Consequences

The session is one screen to scan. The coaching is one extra tap away, so it is read when wanted
rather than scrolled past. Starting loads for lifts with no record live in the private profile
(anvil-data profile.json); a lift with none asks for its weight once.

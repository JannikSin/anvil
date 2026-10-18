# 0017: the workout clock, and why a set fell short

Status: built 2026-10-18 (polaris), ships on David's yes.

## The workout clock
David, 10/18: "an overall stopwatch for the workout to track how long I spend in the gym and so that can tell me I am behind in workout or ahead to rest more or less." On 10/18 he skipped a lift because he ran out of time without knowing it was coming.

- One tap, "Start the workout clock", at the top of the session. Nothing starts on its own (the 10/18 rest timer rule).
- It shows the minutes and one line that says what to do: take full rests, start each set when the rest floor is up, or which lift to drop to finish inside the hour (the lift tagged first cut). It never says behind (P9, invariant: a person is never rendered as behind).
- The pace comes from the same estimate as the "about N min" line: the time the remaining lifts take, added to the clock.
- Filing saves the minutes with the session (`minutes` in workouts.json). Over 4 hours is a clock left running and is not saved.

## Why a set fell short
David, 10/18, on 2 hanging leg raises: "The reason there's only two reps is not because my abs or core were fatigued. The issue was grip strength." A top set under the range steps the weight down (decision 0016), which is wrong when the weight was not the problem.

- A logged lift under its range stays open and asks why: Grip, Machine or setup, Out of time. Blank means the weight was too heavy.
- With a reason, the next prescription keeps the weight and goes back to the bottom of the range, and says so. The reason is saved with the lift (`why` in workouts.json).
- The free-text note stays a note. The app does not guess a reason from words, because "grip felt fine, just heavy" would read as grip.

## Also
- Hanging leg raise: hang from the angled grips; straps or chalk when the hands slip (Escamilla 2006 measured it with straps).
- Pull A's pulldown is the cable stack (David's pick, 10/18). It gets a new progress key, because the Hammer Strength plate-loaded 180 is not a cable-stack number. The first cable session asks for the weight once.

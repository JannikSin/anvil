# 0003. The daily routine and the supplements live in Anvil, on one routine card

- **Status:** accepted
- **Date:** 2026-10-12
- **Deciders:** David; requirements by session shrike
- **Tenet invoked:** 6 (one page per day)

## Context

Routine ticks were offered in three places: Mise's daily check-in, the Crystal brief's `supp-*`, `body-*` and water boxes, and Anvil's check-in. Two places to tick one thing is how neither gets ticked; the brief's reward tick appeared in 61 briefs and was never ticked. David ruled that Anvil holds all of the daily routine and owns the supplements.

## Options considered

- **Leave the ticks where they are.** No work; three surfaces keep competing.
- **Stack the routine onto the morning check-in.** One modal; breaks the standing rule that nothing is added to the weigh-in.
- **A routine card on the Today screen, the check-in kept at three fields.** One surface, the weigh-in rule kept.

## Decision

A routine card on Today, per shrike's twelve requirements (Crystal fleet file `shrike-anvil-routine-requirements.md`, 2026-10-12):
1. Every daily routine tick lives in Anvil; the brief reads Anvil's row or drops the box.
2. The morning check-in stays at weight, sleep hours and push-ups.
3. Five supplement rows with stable ids `supp-creatine`, `supp-d3`, `supp-fishoil`, `supp-theanine` (morning) and `supp-magnesium` (evening). Ashwagandha stays cut; whey, zinc and glucosamine are not rows. The stack gets smaller, never bigger.
4. Water is one tick, 3 to 4 L, front-loaded before 8:00 pm.
5. Ticks write the shared `fitness/daily.json` `supplements` field by shallow patch, and back-date like the check-in.
6. Morning order: wake, weigh, 25 push-ups, check-in, gym (the next day in the queue), morning supplements, out the door.
7. Evening order, Sunday to Thursday: last plate and kitchen closed by 10:00 pm; 10:45 pm magnesium and tomorrow's first line in a text field (writing it is the tick); 11:05 pm read 20 minutes; 11:30 pm lights out, ticked the next morning as a clock fact. Friday and Saturday have no clock rule.
8. Nightly add-ons attach to the push-ups: mobility Monday, Wednesday and Friday; isometric wall squats three times a week after a push or pull session.
9. One reward tick with a pre-named reward.
10. The alarm Shortcut opens the app, and the check-in still fires on the first open of the day in every copy.
11. Every tick goes through the draft door; nothing lives only in memory.
12. Out of scope here: tier tags, the old conditioning blocks, the rest-day alarm.
The clock times are the profile's, not the code's: they are the first profile's values, and a second profile sets its own.

## Consequences

One tick surface and one owner per habit. Mise stops writing its routine fields (Mise decision 0012). What gets worse: Anvil's Today screen gets longer, and the Crystal brief loses boxes David is used to seeing.

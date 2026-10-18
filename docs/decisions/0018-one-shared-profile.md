# 0018: one profile, Mise's, read by Anvil

Status: built 2026-10-18 (polaris, with monolith), ships on David's yes.

David, 10/18: "I really want to sync one profile and each then pulls from that, because I think food and working out are very intertwined and both could learn and benefit from each other."

- Mise owns the profile: `profile/targets.json` in mise-data for David, `profiles/<id>/profile/targets.json` for anyone else, with `fitness/targets.json` as the legacy mirror. Anvil reads it after every pull, on its own, so a failure there never fails the record's sync, and a 404, a bad file or an error keeps the last copy read.
- Anvil takes, field by field (`sharedToAnvil`): body, phase, the goal, the milestone, and the supplement names and doses. Never macros or calories (non-goal: nutrition). Anvil keeps only its training section, including WHEN each supplement is taken. Its own rows that Mise doesn't list yet (caffeine) stay.
- Anvil cannot write any of it: `putFile` refuses those paths, so no future caller can.
- The goal card shows the next milestone (200 lb lean by 12/30, the date can move) and the goal it leads to (215 lean, eventual), counted in sessions between now and then, never as distance still to cover (P9). It says where it came from.
- The anvil-data `base` block stays until v51 has run on David's phone (plan review: an older Anvil reads it), then retires in a separate data commit.
- Next (v52, plan file in the fleet folder): `trained` on the daily row keyed by kind; the stall check that reads sleep and the HR/HRV trend (and Mise's ateToPlan once it ships). Then the Worker keeps watch workouts and sleep stages. Blood oxygen is not kept (non-goal: medical record).

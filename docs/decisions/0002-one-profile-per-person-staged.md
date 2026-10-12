# 0002. One profile per person, in three stages; Anvil writes only the training section

- **Status:** accepted
- **Date:** 2026-10-12
- **Deciders:** David (chose option A); session tweener
- **Tenet invoked:** 7 (coach, not counter) and Mise tenet 7

## Context

The goal is one thing: a bulk needs both the food and the training. Mise and Anvil each held part of it, body weight was already shared, and the targets were a hand-edited mirrored pair. A Mise user who never trains must not be asked about training. Mise decision 0013 is the same decision from the other side.

## Options considered

- **A. One profile, staged: base, food, training.** One source of truth; each app edits its own section.
- **B. A profile per app, kept in sync.** Independent apps; every shared field is a sync bug.
- **C. Mise owns the whole profile.** Simple; training settings edited in the food app.

## Decision

Option A. **Base** (name, body numbers, the goal and its date, the weekly schedule) is filled in by everyone. **Food** is Mise's. **Training** (strength goals, gym days, session length, the routine, supplements, reminders) is Anvil's and is never required of a Mise user. Anvil writes only the training section, from its own Settings.

## Consequences

Anvil needs a Settings screen for its section, which is redo work. What gets worse: a schema change to the profile is a change to two apps at once.

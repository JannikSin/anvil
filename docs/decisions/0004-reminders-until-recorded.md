# 0004. Reminders repeat until recorded and never break Do Not Disturb; the no-notifications non-goal is struck

- **Status:** accepted
- **Date:** 2026-10-12
- **Deciders:** David
- **Tenet invoked:** 5 (recording costs less than skipping)

## Context

The v1 Core Purpose listed "No notifications" as a non-goal: an app that interrupts gets deleted, and nothing in Anvil is late. David's ruling on 2026-10-12 is the opposite for recording: reminders should be persistent, because recording is the habit that slips most. He also keeps a Do Not Disturb from about 10:30 pm.

## Options considered

- **Keep no notifications.** Quiet; the record stays empty, which is the failure the keystone promise exists to prevent.
- **One gentle daily nudge.** Polite; easy to ignore, the same as none.
- **Repeat until recorded, at a priority Do Not Disturb holds.** Persistent; respects sleep.

## Decision

Reminders through ntfy for the morning check-in, the supplements, the session and the evening routine. Each repeats until its item is recorded, is cancelled by the record, never fires for a recorded item, and is sent at normal priority so Do Not Disturb holds. No reminder says the person is behind (Core Purpose P9).

## Consequences

The non-goal is struck through and kept in the Core Purpose. What gets worse: the app now interrupts, on purpose, and a reminder schedule is one more thing the profile has to hold.

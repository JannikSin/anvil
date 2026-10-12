# 0007. Sessions carry an id, and it is the merge key

- **Status:** accepted (in force by 2026-08-28)
- **Date:** 2026-08-28
- **Deciders:** recorded in the v1 doctrine by session trinity
- **Tenet invoked:** none

## Context

Two sessions on one day, or one session from two devices, merged by date collapse into one.

## Options considered

- **Merge by date.** Simple; loses the second session.
- **Merge by a session id.** One more field; nothing collapses.

## Decision

Every session carries an id, and merges key on it.

## Consequences

Same-day doubles and second devices are safe. What gets worse: an old record with no id needs a read-time heal.

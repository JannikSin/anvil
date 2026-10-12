# 0001. Two data repos, routed by path, and Mise's files are read-only here

- **Status:** accepted (2026-08-18, the split)
- **Date:** 2026-08-18
- **Deciders:** the split session; David
- **Tenet invoked:** none

## Context

Anvil split out of Mise on 2026-08-18. Its own records (sessions, vitals, activities) needed a home, and the shared daily row and the food targets already lived in `mise-data`.

## Options considered

- **Everything in `mise-data`.** One token, one repo; Anvil writes beside Mise's files and can corrupt them.
- **Everything in a new `anvil-data`.** Clean ownership; the shared daily row and body weight split in two.
- **Route by path.** Anvil's own files in `anvil-data`, the shared row in `mise-data`, Mise's files read-only.

## Decision

`app/lib/github.js` `repoFor()` routes by path: `workouts.json`, `vitals.json`, `activities.json` to `anvil-data` (read and write); `fitness/daily.json` to `mise-data` (read and write, shared); `fitness/targets.json` and `health/vitals.json` to `mise-data`, read only, refused in `writeFile`.

## Consequences

Each file has one owning app, enforced in code. What gets worse: the token must be scoped to both repos, or half the app silently does nothing.

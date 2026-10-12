# 0006. Every storage key, cache and database is anvil-prefixed

- **Status:** accepted (2026-08-18)
- **Date:** 2026-08-18
- **Deciders:** the split session
- **Tenet invoked:** none

## Context

Every one of David's PWAs is served from `janniksin.github.io`. localStorage, IndexedDB and Cache Storage are scoped per origin, not per path. A key named `mise.pat` here makes Anvil read Mise's token and write to Mise's repo; a service worker that deletes every cache but its own wipes the siblings.

## Options considered

- **Unprefixed names.** Shorter; collides with every sibling.
- **Prefix everything and delete only your own.** Slightly longer names; no collision.

## Decision

localStorage keys are `anvil.*`, `DB_NAME` is `"anvil"`, the cache is `anvil-shell-vN` registered with scope `./`, and `activate` deletes only caches starting with `anvil-shell-`.

## Consequences

`tests/origin.test.js` guards it. What gets worse: nothing, beyond the discipline of the prefix.

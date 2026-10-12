# 0008. Anvil never resembles Mise: blue and black, the plate, the ring, a fixed vocabulary

- **Status:** accepted
- **Date:** 2026-08-22
- **Deciders:** David; session stanton
- **Tenet invoked:** none

## Context

At the split, Anvil carried Mise's stylesheet wholesale, about 400 lines of it styling recipes and cook mode. David's instruction on 2026-08-22: Anvil must not resemble Mise or be traceable to it.

## Options considered

- **Keep the shared look.** No work; two apps that read as one.
- **Rebuild from zero with its own language.** A day of work; a distinct app.

## Decision

Blue and black, no green (one accent `--arc` #2f6bff, cyan for live, amber for caution, red for a broken pipe). Every surface is a chamfered plate via `--plate-cut`, never a rounded card. Anything measured or timed is a ring through `views/ring.js`. The nouns are fixed: deck, crest, band, plate, rack, bar, lift, setpad, knob, strike, tierpad, timer, gauge, dock, sheet, note, void, alarm.

## Consequences

`tests/design.test.js` fails the build on drift back. What gets worse: a pattern that works in Mise cannot be borrowed as-is.

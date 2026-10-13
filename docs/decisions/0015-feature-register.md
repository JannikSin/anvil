# 0015. Every feature traces to a document: the feature register

- **Status:** accepted
- **Date:** 2026-10-13
- **Deciders:** David ("make the fix")
- **Tenet invoked:** none (an invariant)

## Context

David asked several times that the app match its documents, and on 10/13 found features with no
document behind them and documents with no feature. The promise test checked one direction only:
every promise has a test. Nothing checked that every feature traces to a promise, a decision, a
tenet or an invariant, so features built on a request or an experiment passed every check.

## Options considered

- **A rule in CLAUDE.md.** It already existed ("every change names its promise") and was not
  enforced.
- **A periodic manual audit.** Catches drift late and depends on someone running it.
- **A register plus a test that fails on any unregistered entry point.** Drift cannot ship.

## Decision

`docs/features.json` lists every view, library module, route and worker route with its status:
forced (with its traces), support (plumbing a forced feature runs on), or unforced (no document;
printed on every test run for David to trace, park or cut). `tests/features.test.js` fails the
build on an unregistered entry, a stale entry, a trace that does not exist, or a forced entry with
no trace. The first run (10/13) found 9 unforced entries, among them three screens no tab or button opens.

## Consequences

A new feature now has to name what requires it before it can ship. What gets worse: every new file
needs a register line, and a register line can still be wrong about what a file does; the
blind rebuilds (iliad, lola) are the outside check on that.

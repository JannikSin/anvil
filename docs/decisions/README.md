# Decision records

One file per settled decision. **Numbered, never renumbered, never deleted.**

This folder is what the v1 `DOCTRINE.md` Article 3 ("settled, do not re-litigate") held as
a flat list. That list was a snapshot with no history: Anvil's `CLAUDE.md` asserted a Mise
fact for eleven days after it stopped being true, and nothing could mark it superseded.
Split out on 2026-10-12 to the shape in Crystal `System/App-Doctrine` (v2); Mise's
`docs/decisions/` is the sibling.

## The format

Michael Nygard's, 2011. Five fields: **Title** (short, in the file name) · **Status** ·
**Context** · **Decision** · **Consequences**. Plus **Options considered**, because a record
with one option was not a decision, and **Tenet invoked**, which is what makes the doctrine's
tenets falsifiable.

## Status values

- `proposed`: written, not yet agreed
- `accepted`: in force
- `rejected`: considered and not taken; kept, so the argument is findable
- `deprecated`: no longer relevant, nothing replaced it
- `superseded by NNNN`: replaced; the old record is never edited or deleted

## The rules

1. A reversed decision is superseded, never rewritten: new record, old status set, links both ways.
2. Context is written in the present tense of its day and never updated.
3. Consequences names at least one thing that gets worse.
4. Cite the tenet that broke the tie, or `none`.
5. Numbers are permanent; gaps are fine.

## Adding one

Copy `0000-template.md`, take the next number, write it, link it from the doctrine clause
or the code comment it governs.

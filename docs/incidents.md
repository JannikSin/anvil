# Incidents

What has actually gone wrong in Anvil, and what now prevents it. Local by default; an
incident is promoted to Crystal `System/Lessons-Learned` only once it has happened in a
second app or is about how a session works rather than about this code. Newest first.
Split out of the v1 `DOCTRINE.md` Article 5 on 2026-10-12 (Crystal `System/App-Doctrine`, v2).

| Date | Failure | What happened | The armour |
|---|---|---|---|
| 2026-08-29 | A sibling fact stayed wrong | `CLAUDE.md` said Mise still evicted its siblings' caches for eleven days after Mise was fixed, because nothing could mark a claim superseded | `docs/decisions/` with superseded status; the as-of line in `CLAUDE.md` |
| 2026-08-24 | A whole session lost to iOS | The in-progress session lived in a `useState`; iOS discarded the backgrounded page and a morning of lifting vanished with no error | `lib/draft.js` writes synchronous localStorage on every change; `tests/draft.test.js` |
| 2026-08-24 | Late entries filed as today | Every session was stamped with the clock at write time, so a session logged two days late carried the wrong date | The date lives in the draft and the session screen has a control for it |
| 2026-08-22 | Design drift back to the parent app | About 400 lines of Mise's stylesheet came across at the split | Rebuilt from zero (decision 0008); `tests/design.test.js` |
| 2026-08 | Sibling data loss on a shared row | A full-row write of `fitness/daily.json` dropped Mise's fields | `upsertDay` is a shallow field patch in both repos; `tests/daily.test.js` |
| 2026-08 | Two apps writing one number | Protein sat at 210 g in one place and 190 g in another | Anvil never writes a calorie number; `writeFile` refuses Mise's targets |
| 2026-08-18 | Cross-app storage collision risk | Six PWAs share one origin, so an unprefixed key or cache sweep touches the siblings | `anvil.*` keys and `anvil-shell-` caches (decision 0006); `tests/origin.test.js` |

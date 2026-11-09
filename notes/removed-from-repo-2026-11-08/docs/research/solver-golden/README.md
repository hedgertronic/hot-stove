# The solver equivalence gate

`bestroster.ts` is the finale's scoring yardstick. Every number the finale
prints against the dream club — the ceiling, the scouting hits, the badges that
read them — comes out of it. So a change there is only acceptable when the club
it returns is the SAME club, down to pick order and the last decimal of `total`.

These two files are how that was proven when the solver moved into workers and
its inner loop was rewritten onto typed arrays (August 2026). They are kept here
rather than in the suite because the corpus they need is 2.8MB of recorded game
inputs, and a test that reads a file this size from a path outside the repo
passes on one machine and fails everywhere else. Nothing here runs on its own.

## Using it

Both files expect to sit in `app/tests/`, so copy them in, run them, and take
them back out when the change lands.

1. **Record the baseline, from a commit whose solver output is known good.**

   ```
   cp docs/research/solver-golden/golden-gen.test.ts app/tests/
   cd app && npx vitest run tests/golden-gen.test.ts
   ```

   It plays real bot games across all three banks — Open Market, Moneyball,
   Blank Check — plus an overspending bot and three deliberately thin pools,
   and writes each `(cards, opts)` pair with the club today's solver returns
   for it. Set `DIR` in the file to wherever the corpus should live.

2. **Make the change.**

3. **Check it.**

   ```
   cp docs/research/solver-golden/golden-check.test.ts app/tests/
   cd app && npx vitest run tests/golden-check.test.ts
   ```

   It replays every recorded input through the working tree and demands
   byte-identical JSON. Point `GOLDEN` at the file step 1 wrote.

## Why the inputs are intercepted, not built

`golden-gen` mocks `solveBestRoster` and records what the engine actually hands
it, then calls through. A hand-built options object would drift from
`engine.svelte.ts` the moment either side changed, and a gate that tests a shape
the engine no longer sends is worse than no gate: it stays green while the thing
it was watching moves.

## What it caught, and what it cannot

Flipping the option collapse's tie-break from `>` to `>=` — one character, the
kind of change that looks like a cleanup — moved 3 of 43 cases. That is the
class of defect this exists for.

It is a REGRESSION gate, not a correctness proof. It says the solver still
returns what it returned before, which is the whole question when refactoring
and no help at all when the old answer was wrong. The rules themselves are
pinned in `app/tests/bestroster.test.ts` and the bot studies.

Two gaps worth closing if the corpus is ever rebuilt: no game in it triggered
the landing-pool cap warning (`MAX_LANDING_POOLS`, a long reroll chain), and
`completeClub`'s upfront rejection path is only reached by the thin-pool cases,
which are cut from one real game rather than played into that state.

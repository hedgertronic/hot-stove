# Powerup value — measured

What each powerup is worth, and how big a gain a single use must clear to be
worth burning it. Numbers from the bot harness (`app/tests/bots/harness.ts`,
budget-aware greedy core) playing the real engine on paired seeds — same card
sequence with and without the powerup, so every delta is causal, not luck.
Latest run: 600 games/bot, classic bank, 2026-08-08 (`app/tests/bots/last-run.txt`);
a 400-game run reproduces every number below within ±0.6.

Rerun anytime:

    cd app && BOT_GAMES=600 npx vitest run tests/bots/powerup-bots.test.ts

## Marginal value per powerup

All-powerups bot vs. all-minus-one, paired seeds. "Worth" is mean finale
points the fleet loses when the powerup is taken away.

| Powerup        | Worth (pts) | Bot usage | Notes |
|----------------|------------:|----------:|-------|
| Season Ticket  |        +7.9 |       98% | The two rerolls are the whole engine: |
| Relocate       |        +7.3 |       99% | each converts a dead card into a shopped one. |
| Prime Time     |        +5.8 |      100% | Always used, always worth it. |
| Trade Deadline |        +2.7 |       70% | The only powerup the bots sometimes shelve. |
| Double Play    |        +0.2 |       95% | A double commit sees one fewer card all game — |
| Homegrown      |        −0.2 |       89% | near-zero on MEAN score (see caveats). |

All six together: **+24.3 points** over the no-powerup baseline (135.6 vs
111.3 mean), improving 98% of paired seeds and hurting 2%.

## Break-even per use

The threshold a single use must beat the best alternative by, in finale
points. These are the harness policy constants — tuned, then confirmed as the
local optimum by Study 8's solo-feature sweep (every proposed refinement
measured ≤ 0 over 1,500 paired seeds).

| Powerup                   | Bar | Constant |
|---------------------------|----:|----------|
| Season Ticket / Relocate  | +2.5 over the landed card | `REROLL_MIN_GAIN` (never reroll a card offering ≥ 1.5 net: `REROLL_KEEP`) |
| Prime Time                | +2.0 over best alternative | `OPT_PRIME` |
| Trade Deadline            | +2.0 | `OPT_TD` |
| Homegrown                 | +3.0 AND ≥ $8M saved | `OPT_HG`, `HG_MIN_SAVE` |
| Double Play               | both picks +3.0 net | `DP_MIN` |

Rule of thumb: **don't burn a one-shot for less than ~2–3 points of clear
gain.** The premium is option value — an unused powerup can still convert a
future disaster card, and a use spends that insurance.

## Does the bar change over the game?

In theory yes, in measurement barely. The argument: a powerup unused at the
finale is worth exactly nothing, so its option cost should shrink as seats
fill. Study 8 tested precisely this ("decay": bar × max(0.3, seatsRemaining/11),
so the 2.5 reroll bar falls to ~0.75 by the last seat) and it measured
**−0.06 points — neutral, dropped**. Why it doesn't show: the bots already
use powerups in 70–100% of games, so a lower late-game bar rarely changes a
decision that the flat bar hadn't already allowed.

The human takeaway keeps the direction but not a big coefficient: early, hold
the 2–3 point bar strictly; late (last seat or two), take any clearly positive
gain rather than stranding the powerup. Just don't expect the relaxation to
be worth much — the games where it matters are the ones where nothing worth
2+ points ever showed up.

## Caveats

- The bots optimize MEAN finale total. Value that lives elsewhere is not in
  these numbers: Homegrown's discount is one of the few ways to out-build the
  dream-team solver (the solver shops at sticker price), so its −0.2 here
  says "doesn't raise average score," not "useless" — its payoff is 🏆/💰
  territory and badge hunting.
- Double Play similarly reads near-zero on the mean but trades card exposure
  for commitment; its value concentrates in boards where two elite picks
  co-occur on one card.
- Variance play was measured separately (Study 8[B] "chaser": award/ring
  points overweighted when pacing elite): −2.4 mean, judged instead on the
  ≥162 tail — the same lens Homegrown and Double Play deserve.
- Bot thresholds are a policy for a greedy bot with public information; a
  player counting cards (knowing which team-seasons remain) can justify
  sharper deviations.

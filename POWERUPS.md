# Powerup value — measured

What each powerup is worth, and how big a gain a single use must clear to be
worth burning it. Numbers from the bot harness (`app/tests/bots/harness.ts`,
budget-aware greedy core) playing the real engine on paired seeds — same card
sequence with and without the powerup, so every delta is causal, not luck.
Headline numbers: 600 games/bot, classic bank, 2026-08-08. A 400-game run
reproduces every number within ±0.6 — and `app/tests/bots/last-run.txt`
holds whichever run happened most recently, since every `npm test` rewrites
it at the 400-game default.

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

## The 162–0 lens (Study 22)

Same paired-seed ablations, judged on the perfect-season rate (total ≥ 161.5,
the stamp's 162–0 line) instead of the mean. 5,000 games/bot
(`app/tests/bots/last-run-study22.txt`); perfects are ~0.5% events, so treat
single digits as directional.

| Kit                | Perfects (of 5,000) | Paired flips vs full kit (lost/found) |
|--------------------|--------------------:|---------------------------------------|
| baseline           |                   0 | — |
| all six            |                  26 | — |
| without Relocate   |                   5 | 23 lost / 2 found |
| without Prime Time |                   6 | 24 lost / 4 found |
| without Season Tkt |                   9 | 21 lost / 4 found |
| without Trade Dl   |                  17 | 13 lost / 4 found |
| without Hometown   |                  22 | 18 lost / 14 found |
| without Double Play|              **36** | 23 lost / **33 found** |

Three reads:

- **No powerups, no perfection.** The baseline never stamps 162–0 in 5,000
  games. The rerolls and Prime Time are not just the mean's engine, they are
  the whole tail: losing any one of the three cuts perfect seasons by
  two-thirds or more.
- **Double Play is tail-NEGATIVE at the shipped bar.** The kit without it
  perfects more seeds than the full kit (36 vs 26, net −10 paired flips). A
  double commit sees one fewer card over the game, and on a perfect path
  every card view is a lottery ticket. Study 23 below asks whether a
  stricter bar fixes it.
- **Hometown stays neutral in the tail too** (net +4 flips, inside noise),
  so its case really does rest on the dream-team/badge angles the caveats
  name, not on score in either lens.

### Does a stricter Double Play bar fix the tail? (Study 23)

The +3.0 bar was tuned for MEAN score, and the natural objection is that a
player who only doubles up on genuine twin jackpots — a manager AND a player
both well over par — should beat the ablation. Study 23 sweeps the bar with
the full kit on the same 5,000 paired seeds
(`app/tests/bots/last-run-study23.txt`); the bot's candidate values are
already par-adjusted (each pick's net is measured over its seat's par, the
manager's over manager EV), so "both above par by X" is exactly what the bar
means.

| DP bar        | Perfects | Mean  | Net paired flips vs no-DP |
|---------------|---------:|------:|--------------------------:|
| +3.0 (shipped)|       26 | 134.9 |                       −10 |
| +4.5          |       36 | 135.5 |                         0 |
| +6.0          |       38 | 135.4 |                        +2 |
| +8.0          |       38 | 134.9 |                        +2 |
| no Double Play|       36 | 134.1 |                         — |

The tail damage is entirely the loose bar's: at +3.0 the bot doubles up on
merely-good pairs and pays a card view for them; from +4.5 up Double Play
stops hurting, and by +6.0 it is a statistical wash (+2 flips is noise on
~35 events). No bar makes it a tail ENGINE — the best case is "doesn't
hurt." The mean barely moves across the whole sweep, so strictness costs
nothing there either. Player rule: chasing 162–0, double up only when both
picks are huge — roughly +6 over par each, a true twin-jackpot card — or
leave the powerup in the drawer; and note the shipped +2–3 rule of thumb
remains right for mean-score play.

## Where a powerup lands matters: per-seat par values

The same WAR is not worth the same everywhere, because seats differ in what
an average card would have given you anyway. "Par" is the mean best eligible
WAR a random card offers each seat (all 1,188 cards; the game's own
eligibility rules); a candidate's real value over waiting is roughly
**his WAR minus his seat's par**.

| Seat | Par (best/card) | p10–p90 | Usable depth/card | 2nd-best | Extra-card gain |
|------|----------------:|--------:|------------------:|---------:|----------------:|
| C    |             2.0 | 0.4–4.0 |               2.0 |      0.4 |           +0.80 |
| RP   |             2.2 | 1.2–3.3 |               6.4 |      1.5 |           +0.47 |
| OF   |             4.4 | 2.2–6.9 |               4.8 |      2.6 |           +1.05 |
| SP   |             4.6 | 2.4–7.1 |               5.1 |      3.0 |           +1.05 |
| IF   |             4.7 | 2.5–7.2 |               5.8 |      3.1 |           +1.01 |
| FLEX |             5.6 | 3.4–7.8 |              11.7 |      4.1 |           +0.98 |

(IF and SP each seat two: the second seat's par is the 2nd-best column.
"Extra-card gain" is E[best of two cards] − E[best of one] — the raw WAR one
more look at the market buys for that seat.)

Two readings, and they point opposite directions:

- **Scarcity says spend premium picks on C.** A 5-WAR catcher is +3.0 over
  par; the same 5 WAR at FLEX is −0.6 *under* par — FLEX fills itself. When a
  rare elite C or RP season lands, take it: the option to fix that seat later
  is the weakest in the game (a 4+ WAR catcher appears on ~10% of cards).
- **Shopping says don't aim rerolls at C/RP.** Their distributions are
  compressed, so one more card gains only +0.5–0.8 WAR there vs ~+1.0 at
  SP/IF/OF. Rerolls hunt the fat-tailed seats; the thin seats are about
  recognizing the outlier when the reel hands it to you.

Prime Time inverts par again: it pays most where the *career* ceiling beats
the seat's par hardest, which favors SP (the dataset's top starter seasons
run 11–13 WAR against a 4.6 par) over RP (top reliever seasons 5–7 against a
2.2 par).

### Targeted rerolls: knowledge changes the math

The rerolls are not random draws. Season Ticket reaches every year of the
landed franchise; Relocate reaches every team of the landed year. A player
who knows where the outlier lives can hunt it, and the ceiling of that hunt
is a different number from the random-shopping gain above:

| Seat | Par | Hunt ceiling (either reroll) | Over par | Random extra card |
|------|----:|-----------------------------:|---------:|------------------:|
| C    | 2.0 |                          5.7 |     +3.7 |             +0.80 |
| RP   | 2.2 |                          4.1 |     +1.9 |             +0.47 |
| IF   | 4.7 |                          8.7 |     +4.0 |             +1.01 |
| OF   | 4.4 |                          9.0 |     +4.6 |             +1.05 |
| SP   | 4.6 |                          9.2 |     +4.6 |             +1.05 |
| FLEX | 5.6 |                          9.5 |     +3.9 |             +0.98 |

(Hunt ceiling = mean over franchises/years of the best WAR the reroll's full
reach offers that seat; the two reroll types measure within 0.2 of each other
everywhere. It is an upper bound: it assumes you know the destination card.)

The catcher's seat is where knowledge pays the biggest multiple: a blind
extra card buys +0.8 WAR at C, but knowing which season holds the franchise's
outlier catcher buys up to +3.7, a nearly 5x knowledge premium (SP's is ~4x
on a bigger base, RP's is the smallest at ~4x on the smallest base). So the
refined reroll rule: shop SP/IF/OF blind, but spend a reroll on C or RP only
as a targeted strike, when you can name the season you are hunting.

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

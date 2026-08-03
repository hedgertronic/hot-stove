# Hot Stove — Game Spec (v1)

A daily-style baseball drafting game. Spin for random team-seasons, sign players at
their real salaries, and manage a bankroll you set by hiring an owner — then watch
your team's season play out. Score as many points as possible. Bargain hunting is
the core skill: the game rewards knowing which cheap seasons were secretly great.

## The Loop

Spins continue **until all 8 roster slots are filled** (no fixed count). Each spin lands
on a random **team + season** (1985–2025) and shows one screen, everything immediately
signable — no mode-select click:

1. **Owner row** — the actual owner by name (`owners.json`). Hiring locks your bankroll
   to that team-season's **top-4 contracts** through the bankroll curve (widen
   ×1.25 around the league median, scale ×⅔, floor $15M; avg $76M — fire-sale
   teardowns at $15M up to $203M 2005 Yankees). One per game; hard-grayed on
   later spins once hired.
   Taking it consumes the spin.
2. **Stadium row** — the park by name. Buying applies attendance as a bankroll
   multiplier (0.85×–1.15× by percentile). One per game; consumes the spin.
3. **Skipper row** — the actual manager by name (Lahman Managers). Hiring scores
   **(team W − team L) × 0.2** at the finale — Maddon's 103–58 Cubs = +9.0, a
   fire-sale manager is negative — plus **+2 trophy-case points** if he won the
   BBWAA **Manager of the Year** that season. One per game; consumes the spin.
4. **Player list** — sorted by **salary, high → low** (scrolling down = bargain
   territory), WAR shown left / salary right. Signing fills a matching open slot.

The banner shows year + team + record only (park lives on the stadium row). The
screen is sectioned by two matching dashed separators: **FRONT OFFICE** (owner /
stadium / skipper rows) and **PLAYERS** (the list). Taken rows simply gray out — no
explanatory copy. Roster cells carry their season year (Posada ’03).

Spin economy (emergent, never spelled out in-game): owner/stadium/skipper each add a
spin to your game; **Double Play** removes one (two choices, one spin); **Trade
Deadline** adds one (a swap doesn't fill a new slot). Skip the specials entirely and
you finish in 8 spins — with the punitive league-minimum bankroll.

Availability is binary: **active** or **gray** (position full / special already
taken). Arming 🔁 Trade Deadline flips every gray row — players *and* specials — into
trade-amber for one replacement, then it's spent. When the incoming player could
replace several roster players (either IF cell, or the FLEX occupant — any hitter
fits FLEX), the roster rail becomes the release picker (the UI's copy says "trade
away" — "release" would mean cutting a player for nothing): eligible cells light up,
tap one to trade away. One eligible cell → no picker, the trade just completes.

**8 roster slots:** C · IF · IF · OF · FLEX (any hitter/DH) · SP · SP · RP.
Traded players carry their **full-season** WAR and are rollable from any team they played for.
Two-way players (Ohtani) count total WAR (bat + pitch) in any slot they qualify for.

**No owner by game's end** → bankroll defaults to the league-minimum top-4 payroll (punitive).
All dollars are normalized: share of that year's league-average price level × $160M
(so player prices read like modern salaries in every era).

Balance note (playtested, `pipeline/playtest.py`): with the bankroll curve, cost-blind
best-WAR drafting busts the budget ~79% of the time, while nearly every game can
still field 8 players under budget; informed drafting gives up ~6 WAR vs greedy.
Beating the payroll takes powerups plus a little luck — by design.

## Powerups (one free use each)

Six named pills in two rows (3+3) under the team banner, graying when spent. Double
Play, Trade Deadline, Primetime, and Homegrown are **arming toggles**; Trade
Deadline applies to specials as well as players, and Primetime to the manager:

| Powerup | Effect |
|---|---|
| 🎟️ **Season Ticket** | Re-pick **any season** (1985–2025) of the rolled franchise — forward or backward. |
| 🚚 **Relocate** | Reroll to a different random team, same year. |
| ⭐ **Primetime** | Arm it, tap an unsigned listed player (or the open manager tile), browse the whole career, and take any other season at its real price. Owner and stadium tiles are never Prime targets. |
| ✌️ **Double Play** | Take **two choices** from a single spin — any mix of players and specials (owner + Bryant off one Cubs roll). |
| 🔁 **Trade Deadline** | Arm it, then replace anything already taken — a signed player, or your owner/stadium/skipper — with this spin's equivalent. |
| 🏠 **Homegrown** | The hometown discount. Arm it — the market filters to players who *debuted* with this spin's franchise, repriced to a flat **$1M** (never more than the listed price); every other row grays out. Signing one spends it; disarming restores the list. Rerolls disarm it, never spend it. Works in every difficulty and bank mode. |

Hired skipper displays as a chip under the roster rail — name and year only
(🧢 Maddon ’16).

## Scoring

```
score = expected wins + bonuses − penalties
expected wins = 47.7 + Σ WAR          (replacement-level baseline, capped at 162)
```

- **Luxury tax:** −1 pt per $1M (normalized) over bankroll.
- **Front-office bonus (Price-is-Right, with teeth):** linear from **−10** (empty
  payroll) through 0 (half the cap) to **+10** (right at the cap); 0 if over — the
  luxury tax takes it from there. Drastically underusing the bankroll costs points.
- **Awards** (that exact season): MVP +3 · Cy Young +3 · ROY +2 · Gold Glove +1 · Silver Slugger +1.
- **Championship pedigree:** +3 💍 per player whose team won the World Series that
  season; +1 🚩 per player whose team won the pennant but lost the Series.
- **Skipper:** if hired, (team W − team L) × 0.2 — negative allowed. If he won the
  BBWAA **Manager of the Year** that season, +2 more — hardware, so it lands in the
  awards (trophy case) total, not the win column.
- Displayed record comes from a seeded game-by-game Monte Carlo sim of expected wins
  (the *drama*); the score uses expected wins (the *math*).
- **Finale reveal** (smush-style): the record counts up, then the score itemizes row by
  row — expected wins first, each bonus/penalty popping in with its one-line "why",
  total stamps last. Scrolling past the share buttons reveals the **squad review**:
  every player with season, WAR, and hardware (award pills, 💍/🚩) — where badges
  hidden during a Standard-mode draft finally show themselves.
- The bankroll HUD always shows its math: owner base × stadium multiplier = effective
  cap, with the payroll meter running against the effective number. Before an owner is
  hired, ghost chips + the league-minimum floor with an over-floor warning — the
  luxury-tax risk made visible. Ledger labels are deterministic and count-based
  ("3 rings 💍 · 1 pennant 🚩").

## Difficulty ladder

Two rungs, labeled **BALL KNOWLEDGE** on the home screen. Internal keys are
`standard` / `scout` and are frozen — saves and the record book index on them.

1. 📊 **Box Score** (`standard`, default): WAR, salary, and award badges all visible.
2. 🔭 **Eye Test** (`scout`): traditional stat lines only (AVG/HR/SB · W–L/ERA/SV).
   WAR and award badges hidden — knowing Bryant's 2016 was the MVP year is the hidden
   edge, revealed at the finale. **Salary stays visible**: Eye Test hides talent
   signals, not the price tag, so the cap game is identical in both rungs. Salary sort
   keeps the list order from leaking WAR.

## Modes

- **Moneyball:** bankroll fixed to the 2002 A's top-4 contracts (**$51.5M** through the curve
  — Dye/Justice/Durham/Tejada). No owner spins; separate leaderboard, no multiplier.
- **Daily** (deferred): date-seeded spins shared by all players + emoji share string
  (one row per spin: 👤/💰/🏟️/⚡ + outcome tier, then `97-65 · 118 pts`). RNG already
  sits behind a single seeded interface.

### GM Challenges (daily mode — designed, not yet built)

Rotating flat-bonus objectives announced at game start, 2–3 per day. Archetype flavor
lives here — NOT in permanent per-stat scoring, which would double-count WAR components:

- **Speed Demon** — 100+ combined SB (+8)
- **Launch Party** — 250+ combined HR (+8)
- **Leather** — three Gold Glove winners (+6)
- **Contact Club** — team AVG ≥ .300 among hitters (+8)
- **Kids These Days** — four players age ≤ 25 (+6)
- **Graybeards** — four players age ≥ 33 (+6)
- **Homegrown** — five players signed from teams that drafted/debuted them (+8)
- **Globetrotter** — no two players from the same franchise (+6)
- **One-Man Band** — any single player ≥ 9 WAR (+5)
- **Penny Pincher** — winning record (≥ 82 expected wins) under 50% of bankroll (+10)

Requires stat lines + age in cards (same pipeline TODO as Scout mode).

## Assets & Legal

No MLB logos, wordmarks, or player photos. Team names/cities/years/stats are facts
(CBC v. MLBAM protects name+stat use); logos are trademarks and photos carry both
copyright and publicity rights. Identity comes from team color palettes (not
protectable), city/year text, and original cartoon iconography. Owner names in
`data/owners.json` are historical facts, used as flavor.

## Data & Edge Rules

- Sources: B-R WAR daily files (WAR + salary; **2 requests ever**, snapshotted),
  Lahman (salaries 1985–2016, positions, attendance, parks, awards, IDs).
  Salary precedence: Lahman → B-R → estimated league floor (flagged in UI).
- Short seasons (1994, 1995, 2020): WAR and eligibility floors pro-rated to 162
  team games, shown with ✱.
- Card eligibility: hitters ≥ 150 PA, SP ≥ 10 GS, RP ≥ 20 relief IP (scaled in
  short seasons). UI shows top ~12 hitters + 8 pitchers by WAR, expander for the rest.
- Owner names: curated `data/owners.json` (SABR ownership histories + Wikipedia,
  all 30 franchises, 1985–present, verified chains).

## Platform

Static site (GitHub Pages, linked from hedgertronic.github.io). Python pipeline bakes
~1,200 team-season JSON cards + index; the client fetches cards on demand (8KB each).
No backend — daily seeds are date-derived client-side; share strings are self-reported
(the Wordle model). If global leaderboards ever matter, add a tiny serverless endpoint
then; nothing about gameplay needs a server.

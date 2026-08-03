# Hot Stove — Frontend Build Plan

Implementation handoff. SPEC.md says *what the game is*; this says *how to build it*.
Visual reference: `design/cardstock-v2.html` (authoritative for look, motion, and states).

## Stack

- **Svelte 5 + Vite + TypeScript**, plain CSS with custom properties (no Tailwind).
- `canvas-confetti` for the finale; everything else is CSS/Svelte springs.
- Seeded RNG: mulberry32 (~10 lines, no dep). ALL randomness flows through one
  `rng(seed)` instance so daily mode is a config change.
- App lives in `app/`; `data/` is copied into the static build (cards fetched by
  relative path, on demand, one per spin).
- Deploy: GitHub Actions → GitHub Pages; linked from hedgertronic.github.io.

## Design tokens (extract from cardstock-v2.html)

- Ground `#f6f1e3` ivory · card `#fffdf6` · ink `#24221c` · muted `#6b6759`
- Green `#2f9e44` (bargains, fills) · blue `#3b5bdb` (year pill) · yellow `#ffd43b`
  (owner, totals) · sky `#a5d8ff` (stadium) · pink `#ffc9c9` (skipper) · orange
  `#e8590c` (warnings, tax, share) · gray state `#e8e2d2`/`#a09a88`
- **Flat cardstock: NO drop shadows anywhere.** Borders 2–3px solid ink, radius
  9–16px; ink borders + color washes do all the structure. Hover = 1px nudge,
  press = 2px dip (transform only).
- **Tiered value colors** (draft rows AND squad review): WAR chip gray `#b5afa0`
  <2 · blue `#3b7dd1` 2–4 · green `#2f9e44` 4–6 · gold `#e0a010` (ink text) 6+.
  Salary text: green <$8M · ink mid · orange `#e8590c` >$25M.
- Award pills colored by type: MVP `#ffd43b` · CY `#a5d8ff` · GG `#d3f0d8` ·
  SS `#e6e0f5`; 💍/🚩 emoji at fixed 12px/lh 1 so they never stretch rows.
- Team identity: franchise accent color per card (year pill bg + team-name text,
  in the reel and the banner) — needs a small hand-curated `colors.json`
  (franchise → hex), ~30 entries.
- Display face: `ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS"`; body: system.
- `prefers-reduced-motion`: skip reel/reveal animations, jump to end states.

## Data contract (already built, in `data/`)

- `index.json` — `{yearMin, yearMax, cards: [{team, year, franchise, name, lg, div}]}`
  (~1,188) — `lg`/`div` are that season's actual league + division from Lahman
  Teams (era-correct: pre-1994 has no `C`), consumed by the Relocate picker.
- `cards/{BR}_{year}.json` — per team-season:
  - card: `year team franchise name park wins losses attendance attendancePct
    stadiumMult budget budgetRaw contracts[{name salary est}] prorated manager players[]`
  - player: `id name pos war warRaw cost contract salary est awards[] ws pen pa gs
    relIP posG{c if of dh} debut teams[]`
  - player, sparse (written only when they carry a value, to keep cards small):
    `age bc hof wbc` — `wbc` is the player's World Baseball Classic medal for
    that season in Ring-chasing points, `2` for the champion and `1` for the
    losing finalist. The Classic is played in March, so the tournament year is
    the card year and one season can hold both a medal and a World Series ring;
    the scorer adds both.
- `meta.json` — `displayAvgM replacementWins slots avgSlot8 salaryFloor proration`
- `owners.json` — `franchises{franchID: {name, owners[{name from to}]}}` — resolve the
  rolled year against `[from, to)` for the owner row's display name.
- `wbc.json` — hand-curated INPUT, not output: `tournaments{year: {champion,
  runnerUp: {country, players[{name brId note?}]}}}`, one entry per Classic
  finalist roster, plus leading `_`-prefixed notes explaining the sourcing and
  the null `brId` rows. The build joins it onto cards by `(brId, year)`; the
  point values live in `pipeline/scoring.py`, so the file stores the placing
  only. Editing `WBC_CHAMPION_POINTS` / `WBC_RUNNERUP_POINTS` requires a data
  regen — the cards carry the number.

## Game state machine

`spinning → landed (sign screen) → choice → spinning … → finale`

Per spin, exactly one choice: sign player / hire owner / buy stadium / hire skipper
(each of the latter three: once per game, consumes the spin, grays afterward).
Game ends when all 8 slots are filled. Powerups don't consume spins.

Slot eligibility (from `posG`, thresholds ≥10 G): C→c, IF→if, OF→of, FLEX→any
non-pitcher (or two-way, `pos` contains "/"), SP→`pos` startsWith "SP", RP→`pos`=="RP".
Signing fills the first open matching slot (FLEX last, so specialists don't waste it —
prompt only when ambiguous and both a specialist slot and FLEX are open).

Row states are binary: **active** · **gray** (position full, or special taken).
Arming 🔁 Trade Deadline adds an `armed` state to the screen: every gray row (players
AND specials) restyles to swap-amber (dashed, full color) and becomes clickable.
**Release picker:** after tapping the swap-in player, every roster cell they could
replace (both IF cells, plus FLEX for any hitter) turns pickable-amber in the rail
with a hint line ("🔁 TAP A PLAYER TO RELEASE…"); tapping one completes the swap and
spends TD. Exactly one eligible cell → skip the picker, complete immediately.
Specials swap 1-for-1 with their own kind, no picker. Disarm by tapping the pill
again before completing.

Powerups (one each, four named pills in a row under the banner, gray when spent;
✌️ and 🔁 are arming toggles):
- 🎟️ **Season Ticket**: re-pick any year 1985–2025 of this franchise (either
  direction) → reload that card, same spin.
- 🚚 **Relocate**: reroll to a random different team, same year.
- ✌️ **Double Play**: arm it, then take two choices this spin — any mix of players
  and specials.
- 🔁 **Trade Deadline**: arming toggle described above; applies to players, owner,
  stadium, and skipper alike.
- **Hometown Hero** (hidden combo): owner + stadium same `franchise` → one player whose
  `debut` matches that franchise signs for that year's `salaryFloor` (normalized).
  Trigger check after both are owned; if roster full and TD unspent, offer the swap.

Bankroll: `effective = ownerBudget × (stadiumMult if stadium else 1)`. Before an owner
exists, show ghost chips and run the meter against the **league-minimum bankroll**
(min `budget` across all cards — hardcode from data, or add to meta.json in the next
pipeline pass), in warning orange when spent exceeds it. That floor is also the final
bankroll if no owner is ever hired.

## Scoring (port `pipeline/scoring.py` 1:1 — it is the source of truth)

expectedWins = min(47.7 + ΣWAR, 162) · budgetBonus = 10 × (2 × spend/budget − 1) if
≤ budget else 0 (ranges −10 empty → +10 at the cap; underuse costs points) · awards
MVP/CY 3, ROY 2, GG/SS 1 · rings 💍 2 (`ws`), pennants 🚩 1 (`pen`) · skipper
(W−L)×0.1 if hired · luxuryTax = max(0, spend−budget) × 1.
Displayed record: seeded per-game binomial sim of expectedWins/162 (drama only).
**Ledger labels must be deterministic/count-based** ("3 rings 💍 · 1 pennant 🚩",
never "three 2016 rings").

## Screens & components

1. **SpinBanner** — year pill + team name double as the reel: content swaps on a
   decelerating schedule (70ms × 1.14 until ~480ms), one Y-pulse per tick synced to
   tick length (Web Animations API in the mock; Svelte springs in the app), overshoot
   thunk on landing IN the franchise color. Beneath the banner: one row of four
   named powerup pills (🎟️ SEASON TICKET · 🚚 RELOCATE · ✌️ DOUBLE PLAY · 🔁 TRADE
   DEADLINE), graying when spent; armed toggles go orange ("🔁 PICK A SWAP…").
   Header is the wordmark only — no spin counter.
2. **RosterRail** — 2×4 cells, name with ’yy on a second line, green when filled.
   Hired skipper displays as a pink chip directly beneath (`🧢 Maddon ’16` — name
   and year only, no point value).
3. **BankBox** — chip math (`💰 $136.3M × 🏟️ 1.11 = $151.3M`) + meter. Pre-owner:
   bare-emoji ghost chips (`💰 × 🏟️ = $45.1M floor`, dashed) and the meter runs
   against the league-minimum floor in warning stripes when exceeded.
4. **SpecialRows** — headed by a "FRONT OFFICE" dashed separator (mirrors PLAYERS);
   owner (yellow) / stadium (sky) / skipper (pink); name + value only; taken rows
   gray with no explanatory copy.
5. **PlayerList** — headed by a plain "PLAYERS" dashed separator (no column labels);
   tiered WAR circle left, name/pos·age middle, tiered salary right; sorted salary
   desc; "show N more" collapses below ~9 rows.
6. **FinaleLedger** — record counts up (~900ms), rows reveal at ~500ms intervals with
   one-line whys, total counts up last, confetti. Replay button.
7. **SquadReview** — below share actions: 8 players + MGR row with season, WAR,
   award pills, 💍/🚩. This is where Standard-mode hidden badges reveal.
8. **ShareCard** — emoji grid + `97-65 · 120.1 pts` string via navigator.share/clipboard.

## Modes

| | WAR | salary | awards | record/stats |
|---|---|---|---|---|
| Rookie | ✓ | ✓ | ✓ | ✓ |
| Standard (default) | ✓ | ✓ | hidden (still score) | ✓ |
| Scout | hidden | hidden | hidden | stat lines only (needs pipeline: stat lines + age) |
| Eye Test | hidden | hidden | hidden | names/pos only, alphabetical |

Moneyball: bankroll locked $51.5M, owner rows never appear. Daily: deferred — date
seed + same-spins-for-everyone + share grid; keep `rng(seed)` as the only entropy.

## Storage (localStorage)

`hotstove.settings` (mode), `hotstove.history` (per-game results), `hotstove.streak`
(daily, later). No cookies, no backend.

## Milestones

1. **Playable loop** — spin → sign → repeat → console score, real cards, no polish.
2. **Full rules** — specials, powerups, swap flow, hometown hero, bankroll states.
3. **Finale** — sim, ledger reveal, squad review, share string.
4. **Modes + polish** — Rookie/Scout/Eye Test, Moneyball, reduced-motion, deploy.

Pipeline TODOs feeding this: stat lines + age on players (Scout mode, GM challenges);
league-minimum bankroll in meta.json; franchise accent `colors.json` (~30 hand-picked
hexes); owners.json hand-verify pass for the 15 `wikipediaOnly` franchises.

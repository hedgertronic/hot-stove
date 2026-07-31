# Hot Stove 🔥

A daily-style baseball drafting game: spin for random team-seasons (1985–2024), sign
players at their real salaries, set your bankroll by hiring an owner, and score points.
Static site, destined for GitHub Pages, linked from hedgertronic.github.io.

## Read in this order

1. **SPEC.md** — the game: loop, spin economy, powerups, scoring, modes. The *what*.
2. **BUILD.md** — the implementation plan: stack, design tokens, data contract, state
   machine, components, milestones. The *how*. Start at Milestone 1.
3. **design/cardstock-v2.html** — the authoritative visual/interaction reference.
   Open it in a browser: the spin reel, the Trade Deadline arm → swap-in → release
   flow, and the finale reveal are all live demos. (design/design-lab.html is the
   earlier 3-direction exploration — historical context only; Cardstock won.)

When SPEC, BUILD, and the mock ever disagree: SPEC wins on rules, the mock wins on
look and feel, BUILD wins on architecture.

## What's already done

- **Data** (`data/`): 1,158 team-season cards (~8KB each, fetch-on-demand), index,
  meta (normalization tables), owners.json (30 franchises, curated + verified).
  Everything the game reads at runtime. Regenerate: `uv run python -m pipeline.build`.
- **Pipeline** (`pipeline/`): fetch → transform → build. B-R is touched for exactly
  two files ever, double-cached (fungo response cache + `build/raw/` snapshots) —
  never loosen this. `scoring.py` is the scoring source of truth (port it 1:1 to the
  frontend). `playtest.py` is the balance harness; rerun it after any economy change.
- **Design**: fully converged over many feedback rounds — see memory/git history.
  Flat cardstock, tiered WAR/salary colors, named powerup pills, FRONT OFFICE /
  PLAYERS sections, rail-as-release-picker.

## Status

**Milestones 1–4 built and playtested, through the round-14 pass** (2026-07-31):
`app/` holds the Svelte 5 + Vite + TS app — full auto-spinning loop (no SPIN
button; each pick rolls the next card), five powerups (🎟️ Season Ticket, 🚚
Relocate code-grid picker, ✌️ Double Play with refund-until-second-pick, 🔁 Trade
Deadline, ⭐ Prime Time career browser), Hometown Hero,
cold-stove handling, persistence, quit button, finale with ledger / squad /
dream-team (manager included, "found N of 9") / 162-goal bar / share string.
Two difficulties (📊 Box Score / 🔭 Eye Test name-recognition mode) × three banks
(💼 Owner's Box / Moneyball $82.9M / Blank Check $248.6M — both caps are
top-4-contract figures). The club must be complete to finish: 8 players + manager
(+ owner and stadium in Owner's Box); the manager's net wins count inside
expected wins (base 50). Round 7 added the ? help sheet, negative-WAR filtering
with per-position rescue, the single rowPlayable gate (TRADE FOR confirms, Prime
obeys TD reach), division-grouped Relocate, record-on-manager /
attendance-on-stadium tiles, and the two-column per-combo personal best.
Round 8 removed the TD completion bonus spin (complete club = game over) and
the STILL HIRING nag, hid the pre-owner cap floor behind `capKnown`, made Eye
Test a salary-sorted list with the Box Score row anatomy (WAR/awards stay
hidden), labeled WAR values, enforced one canonical award order, moved the
manager to a vertical seat left of the roster grid, and renamed the FLEX slot's
display to UTIL. Round 9 added shareable seeds (finale shows `GAME #XXXX`,
share string ends with it, home has PLAY A SEED — the RNG is per-spin only, so
a seed reproduces the exact card sequence), swept "cap" out of gameplay copy
in favor of bankroll language (pre-owner cap is `$???` + a ?-hatch meter),
put 💍/🚩 pedigree in the Box Score Season Ticket grid via new index ws/pen
flags, hid manager W–L in Eye Test, and flipped the manager seat to
sideways-lr. The pipeline now regenerates byte-stable (salary ties break on
player id). Round 10 moved pedigree emoji inline after the year/team code in
the Season Ticket and Relocate sheets (Box Score only), made the finale seed
chip tap-to-copy, kept the ✕ on the finale (straight home, no confirm),
fixed the manager seat's width so hiring doesn't reflow the grid, and made
the roster rail sticky only while a slot/release pick is pending. Round 11
split the WAR ladder six ways (violet "star" 6–8 before gold 8+, white text
on both), made position chips honest ("2B/OF", Ohtani's "SP/DH" shown whole),
turned the finale ledger visual (award pills ×N, 💍/🚩 chips, a mini salary
meter on the front-office row), made seed-copy feedback in-place, and applied
optical corrections (11px picker pedigree). The wide layout (≥760px, additive
media queries only — phone untouched by construction) gives the game a
two-column board capped at 1020px: sticky club column left, spin banner atop
the scrolling market right; the finale goes two-column and sheets become
centered modals. Round 12 reflowed that board (spinner over the market,
club column expanded), merged luxury tax + front-office bonus into one
two-faced ledger row with an inline mini meter, flattened the finale ledger
to uniform single-line rows, gave both finale rosters psep headers, made
share feedback in-place, swapped the WAR ladder's middle rungs to the
rarity ramp (green 2–4, blue 4–6), added the fixed-cap banks' identity
line, and equalized the ?/✕ pills. Round 13 turned the wide rail into
finale-style rows (same pick buttons, manager de-rotated and last), locked
powerups into a 3+2 lattice, hired the real fixed-cap owners (Schott &
Hofmann / Steinbrenner) into the bank line, renamed the home box TRACK
RECORD with games inline, stripped redundant uncertainty marks (?-glyph
meter fill, ⚠ over icon, Eye Test "? W"), centered the rail seat type,
reduced the ledger's scouting/pedigree rows to bare emoji counts, and left
each finale roster one dream-team cue (⭐ in the squad, green in the dream
team). Round 14 renamed the money word to payroll everywhere, freed green
for dream-team hits (rail seats are white/pink like the finale squad),
added a wide YOUR SQUAD rail header, reverted powerups to content-width
pills in a fixed 3+2 (ST/RELO/PT over DP/TD), made player rows one line
(age gone, awards inline, 🏠 hero marker), turned the home leaderboard
into a "RECORD BOOK · N GAMES" psep, rewrote the subtitle ("Chase 116
wins"), renamed Hardware to Trophy case, made scouting stars repeat like
pedigree, and let Prime Time's current season gray out wordlessly.
Cards carry age, stat lines, medaled award ballots (MVP2/3, CY2/3), All-Star
selections, and team-level 💍/🚩 pedigree; `data/players.json` indexes every
player's seasons for Prime Time. Bundled Nunito keeps the look cross-browser.
`DECISIONS.md` records the rules SPEC left undefined — read it alongside SPEC.
Tests: `cd app && npm test` (scoring parity fixtures generated from
`pipeline/scoring.py` + engine, mode, and best-roster suites). Dev: `npm run dev`.

Remaining: Daily mode (date seed + shared spins + streak — consider seeding from
the previous day's real MLB results), GitHub Pages deploy workflow. Pipeline
TODO: hand-verify the 15 `wikipediaOnly` owner entries.

## Constraints that are decisions, not accidents

- No MLB logos, no player photos (trademark/publicity rights — names + stats are
  protected use per CBC v. MLBAM). Identity = franchise colors + typography.
- Static only; no backend. Daily mode = date seed; share = self-reported string.
- All randomness through one seeded RNG (mulberry32).
- All dollars normalized to share of league-avg slot-8 payroll × $160M.

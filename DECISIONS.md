# Hot Stove — Gap Decisions (build addendum)

Rules and platform behaviors SPEC/BUILD left undefined, resolved before Milestone 1.
Precedence: SPEC still wins on rules it covers; this file covers what it doesn't.
The mock (`design/cardstock-v2.html`) still wins on look/feel.

## Rules gaps

1. **Confirm-to-sign (two-tap).** A single tap never consumes the spin. Tapping any
   active row (player or special) puts it in a *confirm* state — the row highlights and
   its value becomes a `SIGN $1.2M` / `HIRE` / `BUY` button. Tapping the button commits;
   tapping anywhere else cancels. No undo after commit. Rationale: on a phone, one
   mis-tap must never eat an irreversible choice.
2. **No passing.** Every spin ends in exactly one committed choice (two with Double
   Play armed). The forced choice *is* the game's tension; a free pass would collapse
   the spin economy.
3. **Dead spin.** If a landed card has zero actionable rows (all specials taken, no
   player eligible for an open slot, no legal TD swap available), show a `COLD STOVE —
   SPIN AGAIN` state: free respin, nothing consumed. Rare by construction (every card
   has SPs and RPs), but must not soft-lock.
4. **Slot assignment.** Signing auto-fills the first open slot of the matching
   specialist type; FLEX is used only when no specialist slot fits (FLEX-last is
   strictly optimal, so no prompt for it). When a player qualifies for **more than one
   open specialist type** (Bryant: IF *and* OF open), the roster rail becomes a slot
   picker — same amber-pickable pattern as the TD release picker.
5. **Double Play resolution.** Both picks resolve within the spin. If pick 1 fills the
   8th slot, pick 2 remains available for specials or a TD swap (per SPEC's
   "owner + Bryant" example, the reverse must also work); the finale fires after the
   spin fully resolves. An unused second pick is forfeited at spin end — DP stays spent.
6. **DP + TD in one spin.** Legal. A completed TD swap counts as one of DP's two picks.
7. **Reroll powerups are pre-choice only.** 🎟️ Season Ticket and 🚚 Relocate can only
   fire before any choice is committed this spin. Rerolling disarms (does **not**
   spend) an armed ✌️/🔁. Season Ticket excludes the current year; Relocate excludes
   the current team.
8. **🏠 Homegrown surfacing (the hometown discount).** The sixth powerup is an arming
   toggle (TD/Prime pattern) that FILTERS the market: while armed, unsigned rows whose
   player *debuted*
   with the current spin's franchise keep normal active styling with the price
   rewritten to a flat $1.0M (HOMEGROWN_PRICE_M, clamped to the listed price —
   floor-priced players in cheap-floor years list below $1M, and the discount must
   never cost more than a plain sign); every other unsigned row is
   hard-gray and untappable (no per-row marker — the repriced value plus the gray
   contrast is the signal; signed rows keep their 🏠). Front-office rows are untouched
   — the filter is market-only, and committing a special while armed disarms the
   discount at spin end without spending it. Signing a discounted row spends the
   powerup (plus the spin's choice, as any sign does). Disarming restores the list
   without spending; rerolls (🎟️/🚚) disarm it, never spend it — same rule as ✌️/🔁.
   TD + 🏠 both armed: only debut-eligible rows are swap targets, and a swap-in
   commits at the discounted price and spends both. A card with no debut-eligible
   players still arms — the whole list grays, which is its own feedback; disarm
   restores it. Discount pricing applies at commit time only — no retroactive
   repricing. Works in every difficulty and bank (it never depended on owner/stadium
   spins).
9. **Effective bankroll** = `(owner ? owner.budget : minBudget) × (stadium ? mult : 1)`.
   The stadium multiplier applies to the league-minimum floor too — you bought the
   park. Real floor from data: **$15.0M** (the BANKROLL_MIN_M clamp; 2021 Orioles
   and five other teardowns rest on it), not the mock's illustrative $45.1M.
   Punitive as intended.
10. **Overspend is always allowed** — the luxury tax is the brake, never a hard block.
    Meter switches to the striped warning fill past the cap.
11. **Sim seed = game seed.** One mulberry32 stream per game drives spins *and* the
    finale record sim, so a game is fully reproducible from its seed (daily mode is
    then just a date-derived seed).
12. **Prorated seasons** (1994/95/2020) show ✱ after the year in the banner and squad
    review.
13. **One human per roster** (found in playtesting: Double Play + two open IF slots
    let you sign the same player twice). A rostered player's row is dead on every
    later card — same season or any other season of the same player — and is never
    TD-swappable. B-R ids are stable across years, so the check is by id.

## iPhone-first platform decisions

- **Layout:** the app *is* the phone frame — full-viewport ivory, single column,
  `max-width: 480px` centered (desktop just gets margins for now; iPad/desktop layouts
  come later). `viewport-fit=cover` + `env(safe-area-inset-*)` padding; heights in
  `dvh` (`svh` fallback), never `vh`.
- **Touch:** `touch-action: manipulation`, transparent tap highlight. Hover nudges from
  the mock become `:active` press dips (transform only). Minimum 44px hit areas —
  powerup pills keep their small visual size but get padded tap targets.
- **Sticky rail:** the roster rail (plus picker hint line) is sticky at the top with a
  paper background, so slot/release pickers and roster state stay visible while the
  player list scrolls.
- **Persistence:** full game state (including seed + RNG draw count) serialized to
  `localStorage["hotstove.current"]` after every mutation; restored on load. iOS Safari
  evicts background tabs aggressively — a mid-draft refresh must resume exactly.
  Finished games move to `hotstove.history`.
- **Share:** `navigator.share` when available, clipboard fallback with a "Copied 🔥"
  toast.
- **Motion:** `prefers-reduced-motion` skips the reel and reveal animations (jump to
  end states), per BUILD.

## Modes UI decisions (M4)

- **Home screen fronts the game** (`Home.svelte`): difficulty rows + Moneyball toggle,
  selection persisted to `localStorage["hotstove.settings"]`. A mid-game save skips
  home and resumes straight into the game; the finale's quiet "⚙ CHANGE MODE" is the
  only path back (Replay keeps the current mode).
- **Header mode chip:** non-default modes show a small amber chip next to the wordmark
  (⚾ MONEYBALL · 🔭 SCOUT · 🕶️ EYE TEST · 🐣 ROOKIE). Standard shows nothing — the
  default look stays exactly the mock.
- **Scout/Eye Test row anatomy:** the WAR circle becomes a neutral position badge
  (same geometry, card background, no tier color). Scout's second line is the trad
  stat line ("19–5 · 2.44 ERA" / ".292 · 39 HR · 8 SB", two-way seasons show the
  pitching line); Eye Test has no second line at all — the circle already carries the
  position. Confirm buttons hide prices ("SIGN ✍️") until the meter reveals the spend.
- **Scout keeps the salary-desc sort** (SPEC: the order must not leak WAR); Eye Test
  sorts alphabetically by surname.
- **Standard/Rookie second line is `pos · age`** per the mock ("SP · 32") — ages now
  ship on every card player.
- **Rookie badges:** award pills (MVP/CY/ROY/GG/SS in trophy colors) plus 💍/🚩 inline
  after the name, sized down so rows don't stretch.
- **Moneyball bank:** single "⚾ $82.9M HARD CAP" chip replaces the owner × stadium
  math; owner/stadium rows never render; skipper still hires. The 🏠 Homegrown
  discount works here too — it keys off the spin's franchise, not the owner/stadium.
  Share strings and history entries are tagged with the mode.

## Round 5 — mode consolidation, scouting yardstick, Prime (2026-07-30, session 3)

- **Three-rung ladder.** Rookie folded into Standard: the easiest mode shows WAR,
  salary, AND award badges, and sorts by WAR desc (talent-first reading). Scout keeps
  salary + salary-desc sort but upgrades its stat lines to the full triple slash
  (".292/.385/.544 · 39 HR · 102 RBI · 8 SB") and W–L · ERA · K for pitchers; its
  confirm buttons show real prices now. Eye Test is unchanged (names + position
  circle only, alphabetical). Old `rookie` settings migrate to `standard`.
- **Bank modes are a single-select row**: Classic (owner × stadium math) · Moneyball
  (2002 A's $82.9M) · **Blank Check** (2005 Yankees $248.6M — the league-max
  bankroll; the front-office bonus still demands you actually spend it). Config is
  `{difficulty, bank}`; the old `moneyball` boolean migrates. Fixed-cap modes share
  the no-owners/no-stadiums rule.
- **Pedigree everywhere it's earned.** Cards carry team-level `ws`/`pen`; Standard
  shows 💍/🚩 next to the banner record (hidden knowledge in Scout/Eye Test). The
  hired skipper's ring/pennant counts in the Championship pedigree line too.
- **The record IS the math.** Finale W–L = round(expected wins), replacing the
  coin-flip sim — a simulated record read as a bug because it never reconciled with
  the ledger. `display_record` in scoring.py is the source of truth.
- **Dream team + Scouting report.** Every landed card is tracked (`seen`); the finale
  solves the WAR-max roster over all of them (exact DP over slot-type capacities,
  one-human rule enforced, money ignored on purpose) and shows it under the squad
  with ⭐ on the picks you actually made. +1/hit "Scouting report" ledger row
  (SCOUT_HIT_POINTS in scoring.py; parity fixtures regenerated).
- **Awards rebalanced + down-ballot.** MVP 5 / CY 4 / ROY 2 / GG 1 / SS 1, plus
  MVP2/CY2 (+2) for award-vote runners-up from Lahman AwardsSharePlayers (🥈 pills).
- **⭐ Prime, the fifth powerup.** Arm it → tap a rostered player → browse every other
  season of their career (from `data/players.json`, lazy ~0.5MB) → re-sign that year:
  new WAR/cost/awards/pedigree, real contract price (discount pricing doesn't travel),
  and the new season must still fit the slot. Free action (doesn't consume the
  spin's choice), one per game.
- **Relocate is a picker now**, symmetric with Season Ticket: any club from the same
  season (colored team buttons, current club disabled) instead of a random reroll.
- **Partial reels.** Season Ticket only animates the year (team half stays put);
  Relocate only animates the team name. Reroll spins read as "same wheel, one dial".
- **Spin timing is throttle-proof.** One authoritative timer lands the card
  (~2.2s); the decelerating flicker chain is cosmetic and stops early if the browser
  throttles timers (a throttled chain once stretched a 2s spin to 14s).
- **Quit affordance:** ✕ in the header, two-tap confirm (2.5s window), clears the
  save and returns to mode select — refreshing no longer being the only "way out"
  that wasn't one.
- **Deterministic typeface.** Nunito (variable, latin subset) is bundled and leads
  `--disp`: `ui-rounded` is Safari-only and Chrome fell back to Hiragino Maru
  Gothic, which is why the app didn't match the mocks outside Safari.
- **Short-stint stars are in.** Eligibility floors now admit any season with
  prorated WAR ≥ 2.0 (8 player-seasons league-wide, headlined by 2005 Aaron Small's
  10–0 and 2020 Tanner Houck); sub-floor pitchers label SP/RP by whichever innings
  split dominates so slot eligibility never breaks.
- **Share string v2:** mode tag line, spin grid, `W–L · 💰 spend/cap`, then
  `💍…🚩… ⭐hits/8 · 🏆 points`.

## Round 6 — two-rung ladder, the complete club, Prime Time (2026-07-30, session 4)

- **Difficulty collapsed to two rungs.** Standard (WAR + salary + award pills) and
  Scout (the old Eye Test renamed: names and positions only — pure name
  recognition). The stats-line middle mode is gone; `statLine` survives in the
  Prime Time career sheet. Settings migration maps old eyetest→scout and old
  scout/rookie→standard, disambiguated by a settings version stamp (the name
  "scout" collides across versions).
- **The club must be complete.** The game no longer ends at eight players: you
  keep spinning until the roster AND the manager (plus owner + stadium in
  Classic) are filled. Post-roster spins get a "STILL HIRING: …" line and a PASS
  button (pre-roster spins remain must-act). If Trade Deadline is still unspent
  when the club completes, you get one labeled bonus spin to use it or FINISH.
- **Manager, not skipper — and he counts in the wins.** Full rename through
  engine/UI/save (SAVE_VERSION 4). The hired manager's (W−L)×0.1 now folds into
  expected wins (`50 base + WAR + manager`), not a separate points row; the
  ledger why-line itemizes it. The rail gains a full-width MGR "dugout" bar under
  the eight seats (display only — hiring/TD-swapping stays in the FRONT OFFICE
  rows, "rail displays, card acts").
- **Base 50, goal 162, beat the Mariners.** REPLACEMENT_WINS 47.7 → 50.0 (rounder
  mental math). The finale shows total/162 on a goal bar — playtest says bots
  max out ~120, so 162 is a true perfect-season stretch — plus 🔱 for >116 wins
  (2001 Mariners) and a PERFECT SEASON badge at ≥162.
- **Manager joins the dream team.** Best manager = max (W−L) among spun cards;
  shown in the dream-team list, star + 1 scout point if you hired him; "found N
  of 9" when a manager exists (8 otherwise).
- **Down-ballot awards + All-Stars.** MVP3/CY3 (+1) from AwardsSharePlayers third
  place (all point-ties, same convention as 2nd), AS (+1) from Lahman AllstarFull
  (2,648 player-seasons; only injury-shortened 2014 Wieters and 2021 Trout fall
  below card floors). Pills are medaled: 🥇/🥈/🥉 MVP and CY; AS is a plain amber
  pill (a star glyph would collide with dream-team ⭐).
- **Prime ⭐ is now Prime Time, and it scouts the card, not the rail.** Arm → tap
  any unsigned listed player → browse their whole career → sign a different year
  at that year's real price. It consumes the spin's choice like any signing
  (strictly stronger than a plain sign, so no longer a free action) plus the
  powerup. Slot ambiguity auto-resolves specialist-first; the browsed card does
  not count as scouted for the dream team.
- **Double Play refunds.** Only consumed when the second pick actually commits;
  disarming after pick one (the armed pill itself is the exit) or moving on
  refunds it.
- **Season Ticket / Relocate land instantly** — no reel at all, one pulse on the
  half that changed (this also removed the code path behind the same-team year
  glitch). Relocate's picker is a 5-column grid of 3-letter codes in team colors.
- **Auto-spin.** The SPIN button is gone: a fresh game rolls immediately and each
  completed pick rolls the next card after a 500ms beat. Cold Stove keeps its
  explanatory free-respin button.
- **Home = self-explaining cards.** Two difficulty cards with the description
  inside; three bankroll cards whose two mini-pills visually explain the mode
  (Classic: dashed OWNER/STADIUM you spin for; Moneyball: two '02 A'S pills at
  $82.9M; Blank Check: two '05 YANKS pills at $248.6M — both caps were already
  top-4-contract numbers, only the copy ever implied true payroll). PERSONAL BEST
  panel is prominent and per-combo via history (legacy entries normalized).
- **Cosmetics with reasons:** owner parentheticals stripped at display
  (`ownerFor`), "floor" wording dropped from the bank box, the $0 meter renders
  truly empty (the fill's border painted a 2px sliver), prorated ✱ removed
  everywhere, WAR heat ramp kept (it already ran gray→blue→green→gold) with a new
  muted-brick negative tier, and the spinner got vertical air.
- **Share v3:** `HOT STOVE 🔥 STANDARD · ⚾ MONEYBALL` tag line; spin grid gains
  🧢 (manager) alongside 💰/🏟️/🔁; record line appends 🔱 when the Mariners fall;
  last line `💍… 🚩… ⭐hits/9 · 🏆 total/162` (+ PERFECT SEASON at goal).

## Round 7 — Box Score vs Eye Test, the honest list, info-rich tiles (2026-07-31, session 5)

- **Mode names are the analytics debate.** "Box Score" (📊, "Stats, salaries, and
  awards") vs "Eye Test" (🔭, "No stats, no salaries") — internal keys stay
  `standard`/`scout`, only display strings changed. The Classic bank is now
  "Owner's Box" (💼, "Hire an owner to set your budget"); its card shows dashed
  bankroll/team placeholder pills that mirror the in-game unhired aesthetic, and
  the fixed banks show a bankroll pill plus a club-colored OAK 2002 / NYY 2005
  pill. Full four-digit years everywhere, home and game.
- **Both fixed caps ARE top-4 numbers** (verified again in data): 2002 A's raw
  top-4 = Dye 7.17 + Justice 7.0 + Durham 6.3 + Tejada 3.6 = $24.1M raw; 2005
  Yankees = ARod 26 + Jeter 19.6 + Mussina 19 + RJ 16 = $80.6M raw. All game
  dollars are normalized so the league-average top-4 = $160M, which maps those
  to $82.9M and $248.6M. Oakland "looks high" only because normalization scales
  everything to a modern-cap frame.
- **No bankroll-size bonus.** Considered and rejected: personal bests are per
  mode-combo, so cross-bank fairness never bites; the budget bonus already pays
  for frugality within a run; a low-cap bonus would turn the bank picker into a
  scoring exploit instead of a flavor choice.
- **Negative-WAR players are hidden from the signing list** (`visiblePlayers`),
  with a per-position rescue: if a position's players are all negative, the
  least-bad one stays so a C- or RP-starved roster is never stranded. Cold Stove
  judges by the visible list. Prime Time career sheets still show negative
  seasons — the arc is the point there.
- **One tappability gate.** `rowPlayable()` is the single source of truth for
  row liveness (open fitting seat, or armed TD + occupied fitting seat) and now
  gates normal signing, Trade Deadline, AND Prime Time — an armed Prime no
  longer lights up rows TD couldn't reach. TD confirms read "TRADE FOR $X"
  parallel to "SIGN $X" when a row is playable only via the swap.
- **Info-rich tiles.** W–L moved from the spin banner to the manager hire row
  (the 💍/🚩 pedigree stays beside the club name); the stadium row shows
  attendance ("2.17M fans"); BankBox keeps a persistent "💰 owner · 🏟️ stadium"
  identity line in Owner's Box games (dashed placeholders before hiring).
- **Relocate groups by the six current divisions** — deliberately ahistoric
  (1988 Houston files under AL WEST) because the grouping is a navigational
  mental map, not an era claim; codes stay era-correct (CAL, MON). A test pins
  the division map to the exact franchise set in data/index.json.
- **Season Ticket bounds were already right** — the year grid comes from
  yearsForFranchise (D-backs offer exactly 1998–2024), and the Expos/Nationals
  share franchise WSN so a 2010 Nationals card can roll to 1994 and land
  MON_1994 with the era-correct code (now pinned by tests).
- **Player rows, redesigned** (dedicated design pass): compact fixed-width
  position tag (filled ink = pitchers, outline = position players — the only
  color split; no rainbow), name ≥ WAR > salary > position > age hierarchy,
  medals/age on a second meta line so long names never collide with the WAR
  chip. WAR ramp evaluated against a Savant-style blue→red and kept
  (gray→blue→green→gold): gold=elite is the universal sports color and red
  would collide with the brick negative tier. Roster rail is nine matching
  chairs — manager bar shares the seats' green-wash/dashed language.
- **Finale/home cleanup:** squad header and 162-goal presentation deleted (the
  🔱 Mariners badge and PERFECT SEASON still fire; share ends "🏆 106.1" bare);
  Modes/Replay/Share are one row with bigger icons; PERSONAL BEST shows
  BEST RECORD | BEST SCORE columns keyed by combo emojis, no em dash.
- **Help sheet** (? pill, upper-left): loop, payroll (incl. sign-past-the-cap),
  scoring with medal values, one line per powerup — and it
  documents that TD can also swap in the card's owner/stadium.

## Round 8 — quieter loop, honest cap, labeled numbers (2026-07-31, session 6)

- **The TD completion bonus spin is gone.** Completing the club now ends the
  game even with Trade Deadline unspent — the bonus spin rewarded *not* using
  a powerup, and the extra beat diluted the finale. Old saves carrying
  `tdBonus` still load (field ignored on restore).
- **No nag lines while hunting front office.** "STILL HIRING: …" and the bonus
  banner are deleted; when only manager/owner/stadium remain the stove just
  keeps spinning. The rail's dashed empty seats already say what's missing.
- **The pre-owner cap is no longer displayed.** `meta.minBudget` ($18.2M, the
  dataset's cheapest top-4 bankroll) stays as the engine's internal floor, but
  showing it as "your cap" before an owner was hired read as a bug ("that's
  gotta be way too low"). Pre-owner BankBox now shows a dashed "$ · · ·",
  an empty meter, and "CAP — HIRE AN OWNER"; `capKnown` gates it.
- **Eye Test is the salary list.** Same row anatomy as Box Score (rect tag,
  age, salary, SIGN $X), sorted by salary desc — price is the mode's one
  deliberate signal; only WAR and award pills stay hidden. Team-level 💍/🚩
  now shows beside the club name in every mode (franchise history isn't a
  stat leak, and pedigree scores in Eye Test too) — and it lives *only* there,
  not on every player row.
- **Numbers got units and order.** WAR chips carry a tiny "WAR" unit (rail
  meta too: "2013 OAK · 4.2 WAR"); award pills and the finale hardware line
  share one canonical order (MVP → CY → ROY → GG → SS → AS — an All-Star
  never outranks a Cy Young ballot); luxury tax always shows one decimal
  ("0.0" unsigned when under). Elite gold chips keep ink text: white on
  #e0a010 is ~2.3:1 contrast (fails), ink is ~7.2:1.
- **Vertical manager seat.** The dugout bar became a thin vertical MGR cell
  left of the 4×2 grid spanning both rows (writing-mode: vertical-lr), no
  emoji, same type scale as the seats.
- **FLEX displays as UTIL** everywhere (rail, help, finale); the internal slot
  key stays FLEX so saves and data files are untouched.
- **Home:** bank cards show team pill above money pill, Owner's Box gets a
  single dashed money pill and no team pill, subtext lines dropped; empty
  leaderboard combos read "0 games played". Finale ballot labels shortened
  ("MVP 3rd", no "in voting"); dream team uses short codes ("2005 NYY");
  Modes/Replay/Share are equal thirds, emoji-before-text (⚙️ 🔄 📤 — the 🔥
  share icon was off-topic).

## Round 9 — seeds, bankroll everywhere, the y-axis manager (2026-07-31, session 7)

- **Games are shareable via seed.** The RNG was already consumed only per-spin
  (verified and now test-pinned: no player action draws from the stream), so a
  seed reproduces the exact card sequence regardless of choices. The finale
  shows `GAME #XXXX` (uppercase base36) and the share string ends with it;
  home has a muted "PLAY A SEED #" input (case-insensitive, `#` optional).
- **Tabs keep sharing one save.** Considered per-tab instances and said no:
  the game is resume-your-run by design, and the seed feature now covers
  "retry this exact setup" without forking the save model.
- **"Cap" is banned from gameplay copy.** It's a bankroll — you can spend past
  it and the luxury tax is the price. "HARD CAP" chip → "$82.9M BANKROLL",
  help/ledger/tagline reworded ("Stretch the bankroll."). Pre-owner Owner's
  Box shows spend-so-far always, with uncertainty as question marks: `$???`
  chips and a softly drifting ?-hatch meter (reduced-motion safe) — unknown,
  not empty.
- **Luxury tax always reads "−0.0"** when inactive — the row exists to remind
  you it can only hurt. It stays a separate ledger row from the front-office
  bonus: bounded reward-shaping and unbounded punishment are different
  mechanics; merging them would hide the threat.
- **Eye Test hides manager numbers too** — W–L and the ±W value are exactly
  the quantified signals the mode withholds ("Manager" + "? W"). The stadium
  ×mult stays (mechanical: it sets your bankroll), and so does team pedigree.
- **Championship pedigree stays 💍 +2 / 🚩 +1.** Every season has exactly one
  champ and one pennant loser among ~26–30 clubs, so ring players are common;
  buffing them would make "sign anyone from the champ" beat WAR judgment.
  If Octoberness should matter more later, the lever is a set-collection
  bonus, not a bigger per-player constant.
- **Season Ticket grid shows franchise pedigree** (💍 title years, 🚩 pennant
  years) in Box Score only — the index now carries ws/pen flags (78 entries;
  one champ per year except strike-1994). Honest data note: SEA has zero 🚩 —
  a pennant means winning the LCS, and 1995 Seattle didn't.
- **The manager reads like a chart axis.** Round 8's vertical-lr (clockwise)
  is what the user disliked; the cell is now `sideways-lr` — bottom-to-top,
  the y-axis-label convention — three parallel lines (MGR / name / year TEAM),
  wider cell, no emoji. WAR is gone from every rail seat: the rail is
  identity, the list rows are the numbers.
- **Smaller ink:** WAR unit label bumped to 9px; in-game mode chip is
  emoji-only ("⚾ 🔭", names in the tooltip); finale buttons are text-first
  with the emoji after — 🕹️/🔄/📣 replaced ⚙️/📤, which render as gray
  text-presentation glyphs; squad rows carry "year TEAM" like the dream team.
- **Pipeline is byte-stable now:** slot8/top-contracts sort ties on player id
  (the pool iterates a set, so equal salaries churned per run). One-time
  settling: 89 cards reordered their contracts display, WSN 2023 swapped
  which tied $2.325M contract shows fourth (sum unchanged, no slot-8 or
  budget changes anywhere). Verified byte-identical across consecutive
  regens.

## Round 10 — pedigree in the pickers, tap-to-copy, the part-time pin (2026-07-31, session 7)

- **Pedigree emoji sit inline after the year/code, not in a corner.** The
  Season Ticket grid's corner flags were easy to miss at 8px; they now read
  as part of the label ("1998 💍"). Relocate gets the same treatment — the
  season's champ and pennant winner are marked right on the team grid, so
  🚚 becomes a "chase October" tool too. Both stay Box Score-only, matching
  the round-9 gate (Eye Test withholds exactly this kind of signal); no new
  plumbing — teamsForYear already returns index rows carrying ws/pen.
- **The finale seed chip is a button.** "GAME #XXXX" copies "#CODE" to the
  clipboard on tap (toast confirms); the leading # round-trips because
  parseSeedCode strips it. Same quiet mono look — affordance lives in the
  cursor and title, not extra chrome.
- **The ✕ survives into the finale** and returns straight home with no
  "QUIT?" arm — the engine cleared the save at finale entry, so there is
  nothing to abandon and a confirm would be pure friction. Mid-game keeps
  the two-tap arm.
- **The manager seat reserves its three-line width when empty** (fixed 52px,
  derived from the filled type stack) so hiring a manager no longer reflows
  the roster grid.
- **The rail pins only while a pick is in flight.** Sticky existed for one
  reason — the rail doubles as the slot/release picker, and a deep-list tap
  must end on a visible rail cell. That state is exactly `pickPlayer != null`,
  so the rail now scrolls away during normal browsing (reclaiming ~60px of
  list viewport) and snaps to the top the moment a slot-pick or TD release
  starts. User-approved mid-round from a "does it need to be sticky?" question.
- **Pre-owner meter labels match:** "$??? LEFT" now shares the SPENT label's
  size/weight/color; italic alone marks the unknown.

## Round 11 — six-rung WAR ladder, honest position chips, the visual ledger (2026-07-31, session 7)

- **WAR tiers get a sixth rung:** gray 0–2, blue 2–4, green 4–6, **violet 6–8
  (star, MVP candidate)**, gold now 8+ (generational). Share grid adds 🟣.
  Gold chips flip to white text at the user's explicit call (reversing the
  round-8 ink-text contrast decision); the gold deepened #e0a010 → #c98a08 so
  white carries (~3:1), and the Finale's gold-on-cream text benefits too.
- **Position chips tell the whole truth.** New `posLabel`: raw position plus
  any EXTRA specialist slot groups the season's games earn (10+ G), C→IF→OF
  order — "2B/OF", "C/IF/OF" (26 exist). Two-way seasons pass through whole:
  Ohtani's cards were already `pos: "SP/DH"` with combined B-R WAR and
  SP-or-UTIL eligibility — only the chip's `split("/")[0]` hid it. Long
  labels (>5 chars) shrink to 7.5px inside the fixed 38px column. UTIL is
  never listed (every hitter has it). Same fix in the Prime Time browser.
- **The ledger shows, not tells.** Hardware row renders the player-row award
  pills (canonical order) with an ×N when an award repeats; Championship
  pedigree renders 💍/🚩 the same way (borderless — the emoji carries the
  color); Front-office bonus carries a miniature of the BankBox meter (green
  fill, orange hatch when over) under a compact text line. LedgerRow grew
  optional `chips`/`meter` fields — one branch per flavor, no HTML in
  strings.
- **Seed copy feedback is in-place:** the chip's own text swaps to
  "COPIED ✓" (green, 1.2s) — no toast line, zero layout shift (15ch
  min-width). The share button keeps its toast.
- **Optical corrections:** picker pedigree emoji 9px → 11px (emoji render
  below nominal size; 11px balances the 13px labels). Manager seat width
  52px → 56px — measured geometry was already equal (52 = 52) but the
  rotated seat still read slimmer (vertical–horizontal illusion), so it gets
  ~8% optical compensation, A/B'd live.

## The wide layout — one DOM, two boards (2026-07-31, session 7)

- **Width is additive.** Every wide rule lives inside `@media (min-width: 760px)`
  (plus a 1100px refinement tier); the phone layout has zero new rules, so it
  is identical by construction, not by testing. The board caps at 1020px —
  player rows wider than ~650px open a name→chips gulf.
- **The club owns a column.** At width the roster + bank stick on the left
  (350→380px) while the market scrolls on the right, so your club never
  leaves the screen. The rail's pick-time pin is a deliberate no-op here.
- **Sheets become modals at width; Home stays a 540px menu** — it's a mode
  picker, not a workspace.

## Round 12 — the reflowed board, the two-faced budget row (2026-07-31, session 7)

- **The spinner introduces the market.** Wide board is now three areas from
  one phone-ordered DOM (`gleft` club / `gmid` spinner+powerups / `gright`
  market) via grid-template-areas: the reel sits atop the column that sells
  the card it just landed. The club column spends its freed space — 62px
  rail cells, 22px bank meter, bumped type — instead of hoarding it.
- **One budget row, two faces.** Luxury tax and front-office bonus are
  mutually exclusive by construction (`scoring.py`: bonus is 0 whenever
  spend exceeds budget), so the ledger shows a single row that IS whichever
  applies: over → "Luxury tax −X" with the orange over-hatch meter, at/under
  → "Front-office bonus ±X" with the green meter. Display-only; scoring
  parity untouched. The name stays "front-office bonus" — it echoes the
  FRONT OFFICE section on the draft screen.
- **The ledger is single-line and uniform.** Every row is
  label · inline visual (pills ×N / 💍🚩 / ⭐×N / mini meter) · small text ·
  amount at one 44px height; the scouting row joined the show-don't-tell
  pattern (⭐×N "of 9 found"). Final score keeps its deliberate emphasis.
- **Both finale rosters carry psep headers** ("YOUR SQUAD", "⭐ THE DREAM
  TEAM") — the draft screen's label-in-dashed-rule pattern, ending the
  finale's one-off header style.
- **Share feedback matches the seed chip:** the button's own label swaps to
  "Copied 🔥" for 1.2s; the toast is gone. Native share sheets remain their
  own feedback.
- **WAR ladder now follows the rarity ramp:** gray → **green 2–4** →
  **blue 4–6** → violet → gold (mid/high hexes swapped, share grid 🟢/🔵
  swapped). Players read tier ladders as gray<green<blue<purple<gold; ours
  ran backwards at the middle rungs. Manager "+W" values were pinned to
  plain green — they're wins added, not a WAR tier.
- **Fixed-cap banks state their identity:** Moneyball/Blank Check show
  "💰 OAK 2002"/"💰 NYY 2005" in the slot where Owner's Box shows its hires,
  keeping one BankBox height across modes.
- **The manager seat returned to the 52px geometric match** — the user
  preferred the honest measurement over round 11's optical compensation.
- **The ?/✕ pills share a fixed 28px width** (min-width let the wider ✕
  glyph outgrow its twin); the armed QUIT? state may still stretch.

## Round 13 — the wide rail grows up, one cue per list (2026-07-31, session 7)

- **The wide rail is the finale card, live.** At ≥760px the roster grid
  becomes stacked full-width rows (pos · name · season · tier-colored WAR,
  manager de-rotated and last, matching the finale's order); empty seats are
  dashed rows. Same buttons, zero logic changes — the slot-pick/TD-release
  behavior is untouched, and the phone grid is byte-identical. WAR ems hide
  in Eye Test.
- **Powerups sit in a fixed 3+2 lattice** (six grid tracks: top pills span 2,
  bottom span 3) — free-wrapping flex could strand one pill alone under four,
  and armed pills change label width. Labels ellipsize inside the pill; the
  44px tap extension stays unclipped. Double Play's armed label tightened
  to fit a balanced 390px pill.
- **Fixed-cap banks hire their real owners:** Moneyball shows 💰 Stephen
  Schott & Ken Hofmann, Blank Check 💰 George Steinbrenner — the owners.json
  entries whose clubs set those caps, rendered exactly as classic renders a
  hire (runtime `ownerFor` lookup, no hardcoding).
- **Uncertainty needs one voice, not three:** the pre-owner meter dropped its
  "? ? ? ?" glyphs (the drifting hatch already says unknown), the over state
  dropped its ⚠ (red text already says over), and the Eye Test manager tile
  renders nothing instead of "? W" (absence reads cleaner than a placeholder).
- **"PERSONAL BEST" is now "TRACK RECORD"** — owner-flavored — with the games
  count folded into the header line ("TRACK RECORD 📊 💼 · 12 GAMES"); the
  separate sub-line is gone.
- **Rail seat text is optically centered:** the cell's block layout top-set
  the type stack (≈7.7px above / 8.7px below); flex centering with symmetric
  padding measures exactly 8.2/8.2.
- **The finale ledger says it once.** Scouting is a bare ⭐×N (zero state:
  "none found"); pedigree is a literal trophy case — one emoji per season,
  💍💍🚩 — falling back to ×N only past 8 emojis; the final-score row lost
  its spins/payroll subtext.
- **One cue per roster list:** YOUR SQUAD keeps the ⭐ prefix (= made the
  dream team, now with a real 4px gap — CSS margin, since Svelte collapsed
  the markup space); THE DREAM TEAM drops the star and keeps only the green
  tint (= you found this one). Star-in-both-lists was the repetition.

## Round 14 — payroll vocabulary, the quiet leaderboard, green means found (2026-07-31, session 7)

- **Green is reserved for "found on the dream team."** Filled rail seats went
  card-white (players) and pink (manager), mirroring the finale's squad rows —
  the drafting screen no longer wears the finale's hit color. The wide rail
  gained a YOUR SQUAD psep header, so both screens name the same list the
  same way.
- **"Bankroll" is gone; the word is payroll.** Home section, bank chip, over
  state, help sheet, and every comment — completing the round-9 cap sweep.
  Bankroll is casino vocabulary; baseball says payroll.
- **The leaderboard is a section, not a card title:** "RECORD BOOK · N GAMES"
  sits in a psep dashed rule like DIFFICULTY/PAYROLL, no emojis; the card
  below is just the two record/score columns. ("Track record" lasted one
  round.)
- **The subtitle earns its third clause:** "Spin for seasons. Sign their
  stars. Chase 116 wins." — 116 is the Mariners bar the finale already
  measures you against.
- **Powerups: content-width pills, always 3+2** (Season Ticket · Relocate ·
  Prime Time / Double Play · Trade Deadline — a forced break after the third
  pill; round 13's stretched lattice lasted one round). Armed labels can't
  unbalance the rows.
- **Player rows are one line:** age deleted, award pills inline after the
  name (name ellipsizes first — the pills are the scannable signal), rows
  54→46px. (Market rows carry no 🏠 marker; the emoji lives on signed
  squad/finale rows only.)
- **"Hardware" is now "Trophy case"**, and scouting stars repeat like
  pedigree emoji (⭐⭐⭐⭐, no ×N — 9 stars, the max, still fits the 44px row,
  so no fallback guard needed).
- **Prime Time's current season just grays out** — the "that's this card"
  note was explaining what disabled styling already says.

## Round 15 — beta chrome and the pre-release quality pass (2026-07-31, session 8)

- **The subtitle is gone entirely** (round 14's rewrite lasted one round);
  the masthead is the wordmark plus a small yellow **BETA** pill, rendered by
  a shared `Logo.svelte` on both the home screen and the in-game HUD so the
  tag can't drift. Favicon is a 🔥 via inline SVG — no icon asset.
- **Powerup rows sit ~8px apart, not 14** — flex `row-gap` was landing twice
  across the zero-height 3+2 break element, so the visual gap was double the
  declared one. The invisible tap extensions shrank to half the new gap so
  the two rows' targets meet without overlapping.
- **Badges wrap, names don't shrink.** Market rows and finale squad rows use
  the same idiom: the name refuses to shrink (so flex-wrap actually triggers)
  and the award pills drop to a second line only when they don't fit; a name
  longer than the whole row still ellipsizes via max-width. Desktop never
  wraps — by space, not by media query.
- **The SIGN/TRADE confirm no longer grows its row:** the pill's line box was
  unconstrained (~28px, taller than the wide row's 25px content box);
  it's pinned to 24px (12 text + 8 pad + 4 border).
- **"Championship pedigree" → "Ring chasing"** (ledger + help sheet); the
  zero state reads "no rings, no pennants."
- **WAR left, salary right — kept.** Eye Test has no WAR chip, so salary at
  the far edge is the only layout both difficulties share, and the far-right
  slot is where SIGN/TRADE confirms (which show a price) appear.
- **Quality pass, consolidation half:** `AwardPill.svelte` (the award →
  color/medal-text maps lived identically in PlayerList and Finale),
  `Sheet.svelte` (backdrop/bottom-sheet/escape/wide-centering chrome was
  byte-identical across all four modals; headers and cancels stay local
  because they genuinely vary), `lib/modes.ts` (the difficulty/bank
  emoji+name tables existed independently in App, Finale, and Home — the HUD
  chip, share tag, and home pickers now read one table). `isPitcher` and
  `MANAGER_PER_NET_WIN` are imported where they were inlined; the
  rings/pennants tally is one engine getter (`game.pedigree`) feeding
  scoring, the finale chips, and the share string.
- **Quality pass, deletion half:** dead `.pups`/`.word` classes, a redundant
  reduced-motion block (app.css already blankets it), the duplicated
  `.swap`/`.prime` rule bodies, Home's near-identical best-cols branches,
  and two never-imported exports in settings.ts. The Trade Deadline pill
  now grays (`off`) exactly like Prime when a card's choice is spent — it
  was the only powerup missing the class.
- **Deliberately not consolidated** (checked, left alone): PlayerList ↔
  PrimePicker row CSS (same look, different anatomies — a shared component
  would need a prop per difference), the `.qwar`/`.rwar` tier text colors,
  the hatch gradient, and the pipeline data fields the app never reads
  (trimming those is a data-regen job, noted for post-beta).
- **The UI lab (`/?lab`, dev only):** forged `Game` states rendered through
  the real components — every WAR tier, stacked awards on a long name,
  all payroll faces, armed/spent powerups, both finale faces (bonus and
  luxury-tax, stacked-pedigree ×N fallback, 9-star sweep). DEV-guarded
  dynamic import; the production bundle provably excludes it. Fixture games
  stub `save()` so the lab can never write the real save slot.

## Round 16 — the front office joins the game (2026-07-31, session 8)

- **Prime Time works on front-office tiles.** Tapping an open manager /
  stadium / owner tile with Prime armed opens a career sheet: the manager's
  whole cross-franchise career (that's the analog of a player's career — the
  person, not the seat), the park's attendance timeline, the owner's tenure
  years. Hiring takes that season's record / multiplier / payroll. Backed by
  `data/specials.json` — a new pipeline emit aggregated from already-built
  cards (nothing in it required new fetching; regen is byte-stable), fetched
  lazily like players.json.
- **No more passing.** The post-roster PASS button is gone: with the roster
  full, every spin must take one of the card's front-office offerings. Every
  card in the dataset has a manager, so a pick always exists. The hunt is
  now a real decision under pressure instead of a free reroll.
- **The dream team counts awards.** The solver's objective is WAR + award
  points (score()'s own weighting), so an MVP season can out-rank slightly
  higher plain WAR; dream rows now wear their award pills to show why a
  pick won. Rings/pennants deliberately stay out — pedigree is franchise
  luck, not talent-spotting. `totalWar` still reports pure WAR.
- **"Front-office bonus" → "Payroll bonus"** (the help sheet's scoring
  bullet says Payroll too) — the money word is payroll everywhere.
- **Front-office rows match player rows:** one line, type labels deleted
  (💰/🏟️/🧢 already say the type), icon column width-locked to the pos
  tags so the name columns align, meta inline ("1.50M fans", "84–78" —
  hidden in Eye Test), 46px rows. Prime-armed rows drop the per-row ⭐;
  amber-dashed is the one "tappable for a powerup" cue.
- **Columns are structural now.** Prices right-align via flex (not
  text-align — the user's Safari screenshot showed ragged prices we could
  not reproduce; flex alignment is engine-proof), the price box is wide
  enough that WAR chips never shift, and the `.right` column reserves the
  WAR chip's exact height (26.3px) so SIGN/HIRE confirms can't move a row
  by a pixel in either direction.
- **Border weights are a system:** 3px sheets, 2.5px card-level boxes,
  2px pills/chips, 1.5px tiny inline pills. Finale squad rows and rail
  seats were the two stragglers at 2px; both promoted.
- **Favicons are real PNGs** (32/16 + apple-touch-icon on the cream
  ground) because Safari ignores SVG data-URI icons — same pattern as
  hedgertronic.com; the tab title drops its 🔥 since the icon carries it.

## Round 17 — the hidden combo becomes the sixth powerup (2026-08-01)

- **🏠 Homegrown replaces Hometown Hero.** The owner+stadium franchise
  match no longer means anything; the debut-franchise discount is a visible
  sixth powerup, one free use per game like the rest. It's an arming toggle
  (TD/Prime pattern) that filters the market: arm → debut-matching unsigned
  rows stay live at a flat $1.0M sticker price (clamped to the listed price;
  the hero's per-season league-minimum math is gone) while every other row
  hard-grays; sign one to spend it;
  disarm to restore the list unspent. No per-row 🏠 in the armed list — the
  repriced value plus the gray contrast is the signal; signed rows keep their
  🏠. Full rule in gap rule 8 above.
- **Named "Homegrown"** — the baseball term for a player developed by his
  debut club, which is exactly who lights up; "hometown discount" survives as
  the description copy (help sheet, SPEC), since that's the real-world phrase
  for signing cheap to stay. The engine's internal powerup key stays
  `hometown`.
- **Pill row is 3+3:** 🎟️ ST · 🚚 RELO · ⭐ PT / ✌️ DP · 🔁 TD · 🏠 HG. The
  pill reads "🏠 HOMEGROWN"; armed it reads "🏠 SIGN FOR $1M…", matching
  TD/Prime's instruct-the-next-tap voice. The rows are two explicit flex
  containers sharing one 8px gap, so vertical spacing is uniform at every
  wrap count (the old zero-height flex-break element doubled the row-gap and
  needed magic-number halving).
- **Gray rows whisper their tier.** Dead market rows (position full, or
  filtered out by an armed 🏠) no longer flatten to full monochrome: the
  identity bits (position tag, name, award pills) stay grayscale, but the WAR
  chip and salary keep their hue — faded by the row's opacity plus a mild
  desaturation — so a gold you can't reach still reads gold ("need Trade
  Deadline for him"). Prime Time career sheets use the same idiom for
  unsignable seasons. Modes that hide a chip render nothing, so Eye Test
  leaks nothing new; the TD trade-amber state is untouched.
- **One voice for powerup click states.** Armed pill labels all instruct the
  next tap with a trailing "…" (⭐ TAP A PLAYER… · ✌️ PICK TWO… → PICK
  ONE MORE… · 🔁 PICK A TRADE… · 🏠 SIGN FOR $1M…); no meta-UI words
  (UNDO/DONE) — tapping an armed pill again disarms it, unlabeled, the same
  gesture that armed it. The mid-Double-Play "DONE — KEEP ✌️" banner button
  is deleted: disarming the ✌️ pill is the one exit (the engine keeps
  `finishSpin()` for bots/tests). Trade Deadline speaks trade language
  everywhere users read it — "🔁 WHO GOES?", "↑ TAP WHO TO TRADE AWAY",
  "🔁 TRADE IN", "TRADE FOR $X" — never "swap", and never "release" (that
  means cutting a player for nothing); internal identifiers (releasePick,
  completeSwap) keep their names.
- **The rail hint line is gone.** During slot-pick and trade-away picks the
  rail no longer prints "TAP A SLOT FOR X" / "TAP A PLAYER TO RELEASE FOR X"
  under the seats — the row's orange pending pill and the lit nudging cells
  are the cues (one cue per state; the pin/scrollIntoView behavior keeps
  both on screen, so no state is uncued).
- **Dead spins arm anyway.** No debut-eligible player on the card → the pill
  still arms and the whole list grays, which is its own feedback; disarming
  restores it. Graying the pill per-spin instead would make it the only
  powerup whose readiness depends on card contents.
- **SAVE_VERSION 4 → 5** with a restore migration: a v4 save's `heroUsed`
  maps to the hometown powerup (`true` → spent, `false` → ready). The
  `Signed.hero` field keeps its name — saves and the finale's 🏠 marker
  read it unchanged; it now means "signed at the discount price."
- **Manager of the Year is trophy-case hardware (+2).** A hired skipper who
  won the BBWAA Manager of the Year that season adds a flat +2 to the
  awards (trophy case) total — never to the win column, whose (W−L) × 0.2
  stays untouched. BBWAA only (it starts 1983, covering the whole 1985–2025
  era); the TSN parallel ballot is ignored so the same season can't
  double-award. The flag rides the card as `managerMoty` and the specials
  timeline as `moty` (present only when true, like the index's ws/pen), so
  Prime Time's manager career sheet marks MotY seasons. The MOY pill wears
  the skipper's pink and follows award visibility (Box Score only; the
  finale reveals it to everyone). The dream team's manager pick now
  maximizes netWins × 0.2 + (MotY ? 2 : 0) — a 2025 Pat Murphy (97–65,
  MotY) outranks a plain 99–63.
- **⭐ Prime Time is players + managers only.** Owner and stadium tiles no
  longer light up or open a timeline while ⭐ is armed — the manager tile
  (when open) and unsigned players are the only Prime targets. Bot study:
  44% of bot Primes went to owners as pure bank-shopping (~+$70M of payroll
  per hire), stadium draw was 0%, yet banning both is score-neutral — the
  surviving player/manager targets absorb the value. So the restriction
  cuts a degenerate line without costing anyone points. Engine-gated
  (`primeTapSpecial` and `applyPrimeSpecial` are manager-only for specials)
  and UI-gated (SpecialRows only ambers the manager row; ⭐-armed taps on
  owner/stadium fall through to the plain hire confirm). The
  SpecialPrimePicker's owner/stadium rendering paths are deleted, and the
  sheet's manager rows now match the player career sheet's anatomy: 🧢 tag
  · year + team code · MOY pill · muted W–L · "+N.N W" win value.

## Round 18 — the club you could have drafted, and a five-line share (2026-08-01)

- **One pick per card, manager included.** The dream team spent years handing
  back rosters with four bats off a single 1998 Yankees card — a club nobody
  could ever have drafted, because a spin yields one choice. `bestRoster` now
  solves roster and skipper jointly under a one-pick-per-card rule: the dugout
  competes for the same scarce cards the bats do, so manager-first greedy is
  provably suboptimal. A DP over cards gives an upper bound (it relaxes the
  one-season-per-human rule); conflict-driven branch and bound closes the gap,
  bounded at 2000 nodes, deterministic throughout. Reports `dreamSeats` — the
  seats the club can actually fill — because a game that spun eight cards can
  never reach nine and advertising the ceiling would read a perfect scouting
  game as a miss. Bot study 10: ⭐≥7 fires 1.50% baseline / 3.20% powerups, so
  the tighter rule made 🔮 *more* reachable, not less — one pick per card
  forces the dream club to spread exactly the way the player was forced to,
  and overlap rises.
- **The share grid is the roster, not the spin log.** Five lines, always:
  title plus mode emoji, a 3×3 grid, then the record with any badges. The old
  string was four dense lines carrying payroll, rings, pennants, a scout
  tally, the exact total and the seed — every one of which is already inside
  the total, so it printed the score three times. The grid switched subject
  from "what I spun" (variable length, never a shape) to "what I ended up
  with" (8 slots + 1 manager = 9 cells, a rectangle every game). Two results
  now stack and compare, which is the whole point of a Wordle-style share.
  Manager takes cell 1 as a *square* on the same six-rung ladder the player
  circles use — same hue, different shape; `⬛` for an empty chair, which is
  on neither ladder so an absence can't read as a tier. Record derives from
  the total, so a shared record can never disagree with the stamp above it —
  the old string printed baseline wins under a total-derived stamp and the two
  disagreed by ≥20 wins in 96.8% of games. Lives in `lib/share` as a pure
  function, which is why it now has 50 tests and the old one had none.
- **The seed leaves the share string, not the game.** Dropping it makes the
  string a scorecard rather than a challenge — `parseSeedCode` and PLAY A SEED
  were the only route to replaying someone's exact cards. Mitigated by the
  finale's own `GAME #XXXX` chip, which still copies on tap: the string is a
  result, the chip is a deliberate act. `seed?:` is retained in `ShareInput`
  and tested, so restoring it is one property.
- **The record ladder re-rungs onto landmarks the whole way down.** 155 gold /
  135 violet / 116 Mariners blue / 100 century green / 81 .500 gray, and a
  losing season goes brick. Calibrated over 20,000 paired bot seeds per
  population against the frequency of each WAR tier on *visible* card seasons
  (the population whose chips a player actually sees — `visiblePlayers` hides
  negative WAR except one rescue per empty position, so brick is 2.7% on
  screen versus 24.6% in the raw pool). Gold fell from 22.3% of strong play to
  4.2%. A *full* rarity match was computed and rejected: it lands at
  {162,157,150,142,115}, which prints a 138–24 season in blue as
  below-average. Ladder B's color sits next to a literal win-loss record that
  carries its own cultural meaning; Ladder A's sits next to a WAR number whose
  meaning *is* the tier. Landmarks win below gold; the math only sets the top.
  Exact matching is unreachable at the top regardless — wins clamp at 162 and
  strong play already crosses it in ~1% of games, above the 0.67% that earns a
  gold chip.
- **The rail carries no hardware, and the finale carries all of it.** The
  skipper's MOY pill left the roster rail: on a phone a trailing pill is the
  first thing clipped, and no *player* hardware shows there either, so the
  manager showing a pill was the inconsistency. The rail is a compact who/when
  card. Every hidden award now waits for the finale, which is the game's one
  reveal surface — MOY joins the squad review and the dream team there.
- **WAR tier rides the rail as an inset band.** The wide layout shows each
  seat's WAR number; the phone has no room, so the tier arrives as a 4px inset
  bottom band on the same `--war-*` ladder `PlayerList` chips use. A band, not
  a wash: `.cell.pickable` already owns the background, and the release picker
  is exactly the state where a seat must say "tappable" and "5.2-WAR guy" at
  once. Gated on `showWar`, so Eye Test leaks nothing — the numeral moved to
  the same flag so band and number are provably one gate.
- **The pick-time pin is fixed, not sticky.** A sticky box can only travel
  inside its parent, and the rail's parent column is ~150px tall on a phone —
  so it stuck for ~60px of scroll and then detached, which is exactly what
  "sticks for a second then stops working" describes. `position: fixed` with a
  measured spacer answers to the viewport instead. The `scrollIntoView` that
  used to paper over it is gone. Known cost: at scroll 0, arming a pick lifts
  the rail to viewport top and covers the ?/✕ pills for the duration.
- **Copy.** BALL KNOWLEDGE over DIFFICULTY — the ladder measures what you can
  read off a card, not how hard the game is. Clean House over Owner's Box — it
  names the empty-front-office start it actually is (no owner, no park, no
  skipper) and it's the only bank where those rows exist at all, since
  `fixedCap` gates them off for Moneyball and Blank Check; it also matches its
  siblings' register, three baseball-business idioms rather than one label and
  two nicknames. TAP WHO TO TRADE.
- **Docs caught up.** SPEC described a four-rung difficulty ladder; the code
  has had two since round 6. DECISIONS carried the manager multiplier at ×0.1
  after round 17 had already moved it to ×0.2.

## Finding — the short seasons are exploitable, and that stays (2026-08-01)

Proration (`transform.py`, `162 / avg_games` for any year averaging under 155)
scales 1994 ×1.417, 1995 ×1.124 and 2020 ×2.706. It gets the *mean* right —
mean WAR is 1.31 / 1.23 / 1.17 against 1.21 for full seasons — but it cannot
recover evidence a short season never contained, so it inflates the *tail*:

| season | WAR ≥8 rate | vs full | median WAR per $M | vs full |
|---|---|---|---|---|
| 1994 | 1.35% | **2.73×** | 0.264 | 0.88× |
| 1995 | 0.48% | 0.97× | 0.340 | 1.14× |
| 2020 | 0.63% | 1.27× | **0.481** | **1.61×** |
| full | 0.49% | 1.00× | 0.299 | 1.00× |

The mechanism is visible in 2020's top seasons: Betts 9.9 prorated from 3.7
raw, Freeman 8.9 from 3.3, Bieber 8.7 from 3.2. A hot 60 games multiplied by
2.706 looks generational.

The two years are exploitable in opposite directions. 1994 over-produces gold
chips at 2.73× but is poor value per dollar. 2020 is a straight 1.61× bargain,
because its median normalized cost is $1.60M against $2.80M while its WAR is
multiplied by 2.706 — cheap *and* inflated, compounding. The edge lives in the
mid and low market; short-season gold chips actually cost more ($35–36M vs
$25M), so it isn't a shortcut to stars.

**Kept as-is, deliberately.** SPEC's stated core skill is "knowing which cheap
seasons were secretly great," and a 1.61× edge available to anyone who reads
the year off a card is the purest possible expression of that. It rewards
knowledge, not exploitation of a bug, and it is discoverable by playing. The
alternatives were recorded and declined: prorating cost alongside WAR removes
the edge but needs a data regen and a full rebalance; damping the multiplier's
tail fixes 1994's gold rate and leaves 2020's value edge untouched. Re-measure
this table after any proration change.

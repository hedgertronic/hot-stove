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
  recognition). The stats-line middle mode is gone, and `statLine` went with it
  (see round 25 — it never did reach the Prime Time career sheet, and the trad
  line has no renderer left). Settings migration maps old eyetest→scout and old
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

---

## Round 19 — the badge set, the trophy case, and two things deliberately left

The badge set grew from 5 hardcoded pills to a 33-entry table in `lib/badges.ts`,
and the trophy case that displays it moved from the home screen into a sheet
reachable both from home and mid-game. What follows is the reasoning that is
not obvious from the code.

### Named on-field rungs are World Series winners, matched exactly

Earlier rounds used "beat the X" thresholds. Exact matching is what makes a
dense ladder possible: with thresholds, a 108-win season triggers every rung
below it and needs mutual-exclusion rules; with exact matching, 98 / 103 / 106
/ 108 / 114 / 116 coexist and resolution is one dictionary lookup.

Every named rung is a champion, verified against `data/cards/`. Three rungs
from the first draft were cut for losing: the 2004 Cardinals (105), the 2021
Giants (107), and the 2022 Dodgers (111).

Two consequences are accepted rather than fixed:

- **109–113 is empty.** The only club in that band is the 2022 Dodgers, and
  they lost the NLDS. Those five totals carry 12.6% of reference games — more
  than any single named rung — but they all earn 💯, so the band is unnamed
  rather than unrewarded.
- **95–99 earns nothing at all**, 16.4% of reference games, 5.3% of them on 99
  alone. No club won a title with 95–97 or 99 wins in the dataset era, and
  inventing a rung there would break the rule the ladder is built on. The 2002
  Angels, 2005 White Sox and 1989 A's all won 99 and were all considered; the
  gap was chosen over an arbitrary tiebreak between them.

🔱 at 116 is the one non-champion. No club has ever won the Series with 116
wins, so it is the record rung. It keeps "MATCHED" wording anyway: the ladder
reads as one list, and a lone verb change costs more in consistency than it
buys in precision. It also has to stay because `format.ts` uses 116 as the blue
rung on the record ladder — the two screens agree or neither is trustworthy.

### Records are the window's, not all time

Only three all-time single-season records fall inside 1985–2025 with fields the
data carries: Bonds' 73 homers and 1.421 OPS, and Rodríguez's 62 saves. Two of
the three are the same man. 📖 REWROTE THE RECORD BOOK therefore holds the best
mark *in the window* — a ten-season board is a record book; a three-season one
is a Barry Bonds exhibit.

Gwynn's .394 in 1994 misses a 502-PA cutoff on 475 and is included anyway. It is
the batting mark of the era by any honest reading, and the season being short is
why it is remembered, not a reason to discount it.

### Badges that name real people get sourced or they do not ship

🚧 CROSSED THE LINE names 22 men as 1995 replacement players. Every name is
carried by two published transcriptions of the MLBPA's own classification list.
Two false positives were caught that a name-only match would have shipped:
`borbope02` is Pedro Borbón **Jr.**, not the Sr. who crossed, and `smithgr02` is
the 2008 A's Greg Smith, not the 1980s infielder. Damian Miller is excluded as
the one genuinely disputed case — the union classifies him, he denies it on the
record — at the cost of the pool's only catcher.

A replacement player cannot earn ✊ PICKET LINE for himself, but any other 1994
season on the roster still does. One club can carry both: one man walked out,
another walked in.

### The anti-trophies are the load-bearing constraint

Ironic badges get **no locked trophy-case slot**. A visible empty slot is an
invitation, and inviting the player to lose 100 games inverts the incentive the
whole game runs on. They appear only once earned, which is the joke. This
survived four separate redesigns of the case and must survive the next one.

Everything else names itself when locked. A name is direction — "MATCHED THE
2016 CUBS" sends you to look up what they did — while the `how` string behind
it stays the reward for earning the badge.

### A silent failure mode worth remembering

Four badges shipped briefly with triggers that emitted a key no `BadgeDef`
defined. They fired, wrote to history, and were dropped by every surface on the
`BADGE_BY_KEY` lookup: no pill, no share emoji, no trophy slot, no error. The
cause was string-replacement edits that silently no-opped after a formatter
reflowed the table. `tests/badges.test.ts` now reads the trigger source directly
and asserts every pushed key resolves.

### Deferred, with the reasoning intact

**1. Unify the outline system.** Border color is currently an accident, not a
rule: pills default to `2px solid var(--ink)` because that is the game's
cardstock look, and exceptions accumulated one badge at a time — ultra's gold
fill with an ink ring, legend's inversion, ironic's brick-on-brick.

A **darker tone of the fill** is the better system. Black outlines on eight
pastel fills flatten them toward each other; a tonal border lets each hue hold
itself. The WAR chips benefit more than the badges, being saturated solids where
black does real violence to the color. `.brag.ironic` is already built this way
and is the reference.

The one exception is `legend`, which is inverted on purpose — a darker tone of
ink is just more ink. It keeps the gold ring.

Not done now because it touches every colored surface at once: WAR chips, award
pills, the manager card, mode chips, the record stamp. Half-applying it makes
the inconsistency worse than leaving it. **Do it as one pass, immediately before
or as part of dark mode** — dark mode has to re-derive this system anyway, and
doing them together means deriving it once.

**2. Dark mode.** Lab artifact delivered, no scheme chosen, implementation not
started. The standing recommendation is warm kraft (`#17150f` / `#221f18` /
`#ece6d6`), which requires lifting `--war-high` to `#4181d2` and `--war-star` to
`#8c71cb` for contrast, and replacing the `grayscale() + opacity` ghost idiom
with a `--sunk` token. Fold item 1 into this.

**3. Unshipped badge proposals.** All 13 of `badge-ideas-round19.md`'s measured
proposals shipped in round 19 — OLD HEADS, YOUNG GUNS, ALL-DECADE TEAM, RAIDED
THE DIVISION and the rest. What remains unbuilt is the three that had no
measured arm: 🧭 KNOWS BALL (needs a mode marker on `Home.svelte`), 🪙 THE
OAKLAND WAY, and 🫡 DESERVED BETTER. Divisions resolve era-correctly — a modern
alignment would assert 1992 Houston was in a division that did not exist until
1994.

**4. Still open from round 18.** The front-office right-padding bug is
unreproduced and shipped nothing. The mobile sticky-rail fix needs a real
device. The share-sheet fix needs a real tap. `PAYROLL` as the home-screen
header was questioned and never resolved.

## Round 20 — the first-time flag, one history module, an honest width budget (2026-08-01)

### A badge you have never earned goes to the front, not the back

The finale flags a first-time badge with a `NEW` chip. The first instinct was to
hold it back a beat in the reveal stagger so it landed last, after the others —
and that would have been a silent bug. The pill row caps at four and cuts from
the tail of `earnedBadges`' order, so a first-ever badge sitting fifth is
dropped entirely. Sorting it to the FRONT is what makes the flag reach the
player; the position is the mechanism, not the decoration.

The chip is a filled inset tag rather than a glow or a ring, because the pill
already spends its border AND its fill on rarity and both are load-bearing — a
gold ring around a new RARE would read as an ULTRA. It carries real text, so a
screen reader announces it in the pill's own reading order with no extra aria.
It inverts to gold on `legend` alone, which is the one ink-filled pill.

**The first game flags everything it earns.** On an empty log every badge
genuinely is a first. That is a decision, not an oversight.

### The diff has to run before the write, and that is the whole feature

"Have I earned this before" is a question about the history log as it stood
BEFORE the finished game joined it. `finishGame` reads the log and then appends
to it; swap those two lines and every badge reads as already-owned, forever, on
every game — with no error and no visible symptom beyond a flag that never
appears. It is resolved in the engine for that reason and travels on the finale
as `newBadges`, optional, so a restored pre-field save shows no flags rather
than flagging all of them.

The regression test finishes two real games and asserts the second flags
nothing. It was verified to fail by actually moving the read after the write —
a test for a sequencing bug that has never been run against the bug is a guess.

### lib/history.ts owns the log

The engine and settings each had a copy of the parse and disagreed about the
key's spelling: a `HISTORY_KEY` constant on one side, the literal
`"hotstove.history"` on the other. The engine could not simply import
`badgeCase()` either, because settings imports the engine's config types and
that closes a cycle. The cycle was the design signal — history is a third thing
both depend on, not something either owns. It now holds the key, the row shape,
and the tolerance for rows written by older builds.

### The share line's width budget was measuring a game that no longer exists

`MAXIMAL` in `share.test.ts` was a hand-picked 13-key list written when the set
held 13 stackable badges. The set has since passed 40, and the list never
moved. Two consequences, both silent: `SHIPPED_MAX_LEN` asserted a 34-code-point
ceiling for a format that can now reach **81**, and the "keeps every seedless
line inside the shipped budget" test skipped any shape carrying more badges than
the stale list held — which by then was most of them.

It now derives from `BADGES` plus a declared exclusion map: one representative
per `if / else if` chain in `earnedBadges`, plus every badge that stacks. The
groups are structural facts about control flow, not judgments about baseball.
Semantic exclusions that are not chains (🏅 can never share a club with 🕸️) are
deliberately left out, because counting both only overstates the ceiling and
this bound must never understate it. **Unclassified is stackable**, so a badge
added tomorrow widens the ceiling and tightens the test on its own.

**Open question for the next session.** 32 badges / 81 code points is an upper
bound on the TRIGGERS, not a reachable season — eight roster seats cannot hold
three Molinas, a 1994 striker, a 1995 replacement player, a 2020 season and a
2017 Astro at once. But nothing currently bounds line five at a length that
actually fits a Wordle-style block, and the share string is deliberately
uncapped where the pill row caps at four. Either cap the share list or accept
the tail risk on purpose. Not decided here because it changes shipped output,
and the ask was to fix the test, not the format.

### One rarity ladder

The order was written out three times — the union type, `badgeCase()`'s tile
sort, and the trophy case's band order. One copy was already wrong: the sort
array omitted `"legend"`, so `indexOf` returned −1 and the two rarest badges in
the game sorted above their own heading on the home case. `RARITY_ORDER` is now
the value, `Rarity` derives from it, and both consumers read it.

### Deferred from this round

**5. The share line's realistic ceiling** — see the open question above.

**6. `PILL_CAP` is a view constant with a policy attached.** `bragRow` takes the
cap as an argument, which is right, but four was measured against a season
averaging ~1.5 badges and the set has grown a lot since. Worth re-measuring
against the bot study before assuming four is still the number.

### Review findings, and the four left for tonight

A duplication/decomposition review over everything since the last deploy found
no correctness bugs. Three things were wrong enough to fix on the spot: two doc
comments in `badges.ts` asserted rules the code does not follow (`ironic` said
anti-trophies are "never given a locked trophy-case slot" — the case gives them
an anonymized one; `COLLECTIBLE` called itself slot-eligibility when it is the
progress fraction's denominator), and `TrophyModal` reimplemented a key lookup
with `BADGES.find()` where `BADGE_BY_KEY` exists. False rationale is worse than
no rationale — the next person reading it "fixes" working code.

Left deliberately, all of it cosmetic or placement:

**7. The trophy button is copy-pasted between the HUD and the home screen.**
`App.svelte` and `Home.svelte` carry byte-identical copies of the button markup
including its hand-tuned 6-segment SVG path, the `.tico` rules, and the `.help`
geometry block — comments included. A tweak to the drawing has to be made twice
and a mismatch is invisible until the two screens are compared side by side.
Extract a `TrophyButton.svelte`, or promote `.help`/`.tico` to `app.css` the way
`.psep` already is. `Home.svelte`'s `right: auto` is redundant there.

**8. The WAR-tier color ramp is pasted into two components.** `Finale.svelte`'s
`.tamt.*` and `Home.svelte`'s `.brec.*` duplicate six tier→color rules including
a hardcoded `#e0a010` that deliberately overrides `--war-elite`. Change the
token and neither follows; change one hex and the finale stamp disagrees with
the record book. Wants a `--war-elite-stamp` in `app.css`. Fold into the outline
unification pass (item 1) — same surfaces, same sitting.

**9. `badgeCase()` is in `settings.ts`, which is scoped to mode persistence.**
It reads history and badges and returns collection state; it lives there only
because `bestFor()` does, and its own comment argues those are different
objects. `badges.ts` imports nothing but `scoring`, so moving it closes no
cycle. Placement only, no behavior.

**10. `.x` close-button CSS is identical in `HelpModal` and `TrophyModal`.**
Checked against `Sheet.svelte`'s claim that headers belong to the caller: that
claim holds — six components import `Sheet`, all six define their own
`.sheet-h`, and only these two carry an `.x`. A two-file duplication, not a
`Sheet` omission. Worth an optional `dismissable` prop only if a third appears.

**On `badgeCase()`'s tile sort:** it is currently unobserved. `TrophyModal`
consumes `tiles` as a lookup map and a length check, and re-derives display
order itself from `BADGES`. The sort was kept anyway: the function returns an
array, an array implies an order, and returning map-insertion order would
silently bite whatever renders `tiles` directly next. It is pinned by a test.

## Round 21 — the dark hooks, one payroll box, and a bar that was tiling itself (2026-08-02)

### The stamp gate was built, documented, tested, and inert

`onFieldBadge(baselineWins, stampWins = baselineWins)` vetoes a rung the final
record does not hold — the rule asked for in as many words: 105 baseline taxed
down to 81–81 does not keep 💯. The function was correct and had tests. The
engine never passed `stamp`, so the default made `stampWins === baselineWins`
on every club ever built and the veto could not fire.

Nothing caught it because nothing could. The unit tests hand `stamp` in
directly, so they prove the function honors a fact it is given, never that
anything gives it one. The call site type-checked, ran, and passed — a default
parameter turned a safety gate into dead code.

The shape is the lesson. `hof` and `country` are optional too, but they fail
SAFE: absent means no badge. `stampWins` failed OPEN — absent meant the gate
always passed. **An optional fact with a permissive default is a silent
feature-off switch.** The regression test runs through `finishGame`, not
`earnedBadges`, because the gap was between "the function is right" and "the
function is called right," and only an end-to-end finale sees that gap.

### Four more facts the engine collected but never handed over

`bc`/`hof` on signings, `managerHof`, `ownerLast`, and `countries` on the
history row were all specced and none were wired. 🏛️ 🌎 🕶️ and the passport
panel measured 0.00% and rendered nothing — not because they were wrong, but
because the data stopped one layer short. Study 11 with the hooks live:

    🏛️ hall        0.00% → 6.30%
    🌎 worldtour   0.00% → 3.85%
    🕶️ flyingblind 0.00% → 0.10%

🤝 `wordofmouth` and ✳️ `asterisk` still measure 0.00% and that is correct: both
are seed-provenance badges a bot cannot earn, since nobody hands a bot a code.

`ownerHiredLast` is the one that is bookkeeping rather than plumbing. "The
roster was full WHEN the owner was hired" is a moment, not a property of the
finished club — by the finale the two orders look identical — so it is recorded
as it happens and saved. Only `hireOwner` writes it: the Trade Deadline swap
requires the seat to be taken already, and a club that had a budget all along
was never flying blind however late it changed owners.

**The passport cannot be backfilled.** History rows record badges and a record,
never a roster, so there is no way to recover which countries an already-played
season held. The panel appears after the next finished game and counts from
there.

### One payroll box, finally

`PayrollBox` was extracted last round and `BankBox` kept a full parallel copy of
its markup and CSS — the exact drift `PayrollBox`'s own docstring warns about,
and two files agreeing only by hand. `BankBox` is now a thin adapter: it turns a
`Game` into plain props and draws nothing. The engine dependency stays up there
because `PayrollBox` renders clubs no `Game` exists for — the solver's dream
roster, and a finale restored from storage.

`tests/bank-headline.dom.test.ts` still mounts `BankBox` rather than the
component that now draws the row. That is deliberate: going in the front door
proves the adapter passes the props that produce each state, which a direct
`PayrollBox` mount would skip.

### The loading bar was rasterizing itself into squares

The unknown-payroll hatch carried `background-size: 28.3px 100%`, sized to one
period of its own diagonal. Sizing a repeating gradient down to one period makes
the browser render a single tile to a bitmap and repeat it, and 28.3px is not a
whole number of device pixels — so every tile boundary landed a seam, and a
diagonal cut by regular vertical seams reads as blocks. Rendered side by side,
the stripe widths are visibly uneven.

Unsized, the gradient paints once across the whole bar and stays continuous. The
period moves to the animation, where it belongs: at -45° a horizontal shift of
`d` moves the pattern `d·cos45°` along the gradient axis, so one 20px period
costs `20/cos45° = 28.284px` of travel, and sliding exactly that maps the pattern
onto itself. It was duplicated in both payroll boxes; the merge above meant
fixing it once.

### Copy

American English throughout: `programme`→`program` in 💊's `how` line, plus a
mechanical sweep of ~60 comment lines and one local identifier. Slang stays —
"scrubs", "blank check", "the hard way" are the voice.

💎 THE FRANCHISE PLAYER said "half your payroll" while dividing by SPEND, so a
$40M man on an $80M club fired it under a $200M cap. The copy moved to match the
code rather than the reverse: a threshold change on the eve of a deploy is a
balance decision, and this was a wording bug. 🚜 and 🤏 keep "payroll" because
they really do divide by the budget.

✊ PICKET LINE's `!REPLACEMENTS.has(id)` guard was reported as a copy mismatch and
is not one: no replacement player has a 1994 card season, so the filter is
unreachable today. It stays — ✊ and 🚧 make opposite claims about the same year
and a corpus change must not award both — and now says so in a comment.

### Deferred from this round

**11. The history row stores two different ladders.** `record` is written from
the BASELINE (`displayRecord(expectedWins)`) while `total` on the same row
resolves through `recordFromTotal` to the STAMP the finale printed. Seeding a
row with `record: "112-50"` renders `131–31` in the record book, because the
book reads `total`. Harmless today only because `bestFor().bestRecord` — the one
consumer of the parsed `record` — has no caller outside tests. Either drop
`bestRecord`, or write the stamp into `record` and accept that old rows carry
the other ladder. Not touched before a deploy because nothing user-facing reads
it.

**12. Badge tiers drifted, and now there is clean data to re-tier from.** Study
11 (n=2000/arm, hooks live) disagrees with the shipped table on 14 badges. The
loudest are not the borderline ones: 📖 `recordbook` is `ultra` and measures
8.85%; 🧗 `hardway` and 👬 `brothers` are `rare` and measure 0.00%; ⛰️ `topheavy`
is `rare` at 0.05%. `redsox`/`astros` are the borderline pair from last round and
should move with the rest, not alone. Deliberately not re-tuned in the same pass
that changed what the numbers measure.

**13. 💎's denominator is still a real question.** Copy now matches code, but
"half of everything you spent" and "half your payroll" are different games, and
the second is the one the other two payroll badges play. Worth picking one.

**14. Six tinting calls left open.** The PLAY button is quieter under the retint
(orange-2 + ink rather than saturated orange + white); a replacement-level rail
seat now has a LIGHTER frame (2.49:1) than an empty dashed one (14.09:1), which
inverts the hierarchy; the ceiling record renders untinted gray on purpose so it
cannot read as a second scoreboard; 🧗 THE HARD WAY is gated at 100 baseline
wins, the only zero-powerups badge; the help cue moved `--yellow`→`--gold-8` and
reads stronger; the passport derives from history rather than owning a key.

**15. `PILL_CAP` is still four.** Badges per season now average 3.0 and the set
is 58. Same note as round 20, now with a number.

**16. Two "dead" fields that are not dead, and one comment that was.** A review
flagged `spinLog` and `BestRoster.underBudgetTotal` as computed-but-unread. Both
claims came from grepping `src/` alone: `spinLog` is asserted in
`engine.test.ts`, and `underBudgetTotal` feeds `dreamUnderCap` in the bot
harness. Neither has a UI consumer, which is the real observation — they are
forward-declared, not dead. Left in place. The same review was right about
`app.css`'s duplication note, which claimed a confirm-pill copy PrimePicker does
not have and missed a `.badges` copy it does; the note now says what is true.
`.pos`, `.cost` and `.badges` should move to `app.css` as one set.

Items 7–10 from round 20 are untouched and still stand.

## Round 22 — the seat that had to be filled, one dismissal, and five answers (2026-08-02)

### Badge copy says the condition and stops

Twenty-one `how` strings carried an aside after an em dash and none of them
were load-bearing. The label already names the club, the year already names
the era, and "the year the strike killed the World Series" is a fact about
1994 rather than something the player did.

Three were not simple deletions. 🏛️ kept "counting the skipper" — without it
nobody knows the dugout counts toward the four, which is a RULE wearing an
aside's clothes. The six named rungs converged on one sentence shape, "Exactly
N baseline wins, and a final record no worse", so the ladder reads as one list
instead of six differently-worded near-misses. And the header's vocabulary is
untouched: "baseline wins" and "final record" are the finale's own two labels
for two different numbers, and collapsing them would leave a badge describing
a figure the screen never prints.

🎲's 472-character string is exempt and stays exact. It names four living men,
two of whom have pleaded not guilty and against whom Major League Baseball has
made no finding, and its own comment records that nothing in it may be
shortened into an assertion of guilt. Simpler copy is worth less than that.

### An empty seat is not a club anybody was allowed to build

The finale's yardstick was printing clubs with an open seat — a starting
rotation a man light — and the game does not allow one. There is no passing
and a club must be complete to finish, so a dream team a seat short is
measuring a season nobody was permitted to play.

The first place anyone looks is wrong, and the wrongness is worth recording.
`Dp.solve` picked its terminal state by value alone, and on the over-cap
branch λ = −1, so an item is worth `base − cost` and a $20M starter worth one
win scores −19. `repair()` said the same thing out loud in a comment: "an
empty seat beats a seat that costs points." Both are true of a knapsack and
false of this game, both were fixed, and over 150 games per arm the fix
changed **nothing** — byte-identical output.

The actual defect was one layer out. EVERY comparison downstream of the solve
ranked clubs by finale total alone: `pick()`, the pass-1 shortlist sort, the
pass-2 and pass-3 promotions, the winner loop, and `branchAndBound`. Under
this objective an incomplete club usually scores HIGHER, because the seat it
skipped is the one that would have pushed payroll past the cap. So complete
clubs were found and then discarded, one comparison at a time.

Seed 898010623 holds both halves in series. `repair()` vacated a seat because
the conflicting card had no legal alternative left, and the 8-seat club it
produced then beat the whole field: 134.50 against the best complete club's
130.70, with branch-and-bound explicitly logging a 9-seat leaf at 112.20 and
keeping its 8-seat incumbent. The winner spent 205.9 of a 207.6 cap — it was
never over. It skipped the ninth seat precisely because taking it would have
crossed.

One ordering fixes it: `better(a, b)` on (seats filled, total), seats
dominating, applied at all six sites. Nine seats in 100% of games, against 11
short games in a 600-game sweep before. **The scarcity split is zero.** Not one
of those 11 was a thin pool, and the engine proves it without any eligibility
re-derivation — it will not let a game finish with an open seat, so every one
of those seeds is its own witness that its pool seats nine. The correction
costs the ceiling 0.2 points.

`SEATS` stays anyway, with a comment that no longer claims to be the fix: a
λ = −1 probe ranked on value alone answers "sign nobody", and that is a wasted
probe whatever the ordering above it does.

### The hatch was still sweeping a seam

Round 21 removed the `background-size` that made the unknown-payroll hatch
rasterize into squares, and the glitch survived, because the animation still
moved `background-position`. A gradient with no `background-size` is painted
once at exactly its box size and then TILED; sliding it sideways brings a tile
boundary into view, and unless the bar happens to be a whole number of
28.284px periods wide that boundary is a phase jump — a seam sweeping the
first inch of the bar once per cycle. A translated runway one period wider
than the bar never brings an edge into view at all.

Going over the cap now scrolls too, so the two unsettled states share one
motion language. The periods differ and the speeds are matched rather than the
durations: 16px of stripe costs 22.627px of travel against the unknown hatch's
20px/28.284px, so 2.08s and 2.6s both work out to 10.9px/s.

### One dismissal, drawn once

Every overlay now carries both affordances — a corner ✕ and a full-width
bottom button — and `Sheet` draws both, because five components each growing
their own corner button is the drift that cost a merge in Round 21. The header
moved into the shell with them: the ✕'s 44px tap target only clears the first
content row if one object controls the distance between them.

The bottom label says what the sheet is. A picker is a thing you back out of,
so CANCEL; a sheet that only tells you things says GOT IT; CLOSE is the
neutral fallback.

Sheet heights were the `vh` this file bans, in the one place it mattered most.
`88svh` with a `dvh` line after it takes a 390×844 phone from ~590px to ~684px
of sheet, which is the difference between a six-division Relocate grid that
scrolls and one that does not. Framed sheets are a flex column now, so only
the body scrolls and CANCEL is never scrolled off.

**Escape did nothing on a freshly opened sheet**, and had not since sheets
existed. The handler sits on `.sheet`, and nothing focused it — on mount
`document.activeElement` was `<body>`, so Escape worked only after the player
happened to tap inside. Focusing the shell also stops Tab walking the market
rows behind an open modal.

### The help sheet shows the thing instead of describing it

Five specimens built from plain object literals: a market row with a
tick-mark legend naming its own columns, the roster rail's seats, the payroll
meter under and over, a powerup pill in all three states, and a badge pill
earned and locked. `PayrollBox`, `BadgePill` and `AwardPill` are the REAL
components — they take plain props and were already in the bundle. The market
row and the rail seat are deliberately hand-rolled from the same markup and
classes, because those two take a `Game`, and importing them would wire the
help sheet to live engine state to draw a picture.

Nothing comes from `src/lab`. The gallery is excluded from production by an
`import.meta.env.DEV` guard, so a help sheet importing its fixtures would
either break the build or drag the lab into the bundle. Module count held at
168.

### The powerup is spelled PRIMETIME

One word, in user-facing copy only; the internal key stays `prime`.

The rename bought back a character, and the armed labels needed it. Any
combination can be on screen at once, so the 3+3 lattice has to hold in every
armed state, and the widest resting row — DOUBLE PLAY · TRADE DEADLINE ·
HOMEGROWN — sets the budget at 34 label characters. ✌️'s second state drops to
"ONE MORE…" because with Double Play carrying a spin past its first pick the
other two pills stay armed beside it, and the verb its first state already
established is the cheapest word in the row to lose.

### The seed field stopped zooming the page

Mobile Safari zooms any focused form control whose computed `font-size` is
under 16px, and the seed input was 13px. It is 16px now, with the vertical
padding cut from 5px to 2px and the tracking eased from 0.12em to 0.08em so
the box keeps roughly the height it had — a taller glyph and less padding
very nearly cancel.

`maximum-scale=1` would also have stopped the zoom and is not an option: it
disables pinch-zoom for every user on the page, which trades one person's
minor annoyance for everyone else's accessibility. The component comment says
so, so nobody re-adds it.

The keyboard now matches what a seed is. `autocapitalize` was `characters`,
which put the keyboard in caps mode for no reason — the field is uppercased in
CSS and the parser calls `toUpperCase()` anyway — and is now `none`;
`autocorrect="off"` stops Safari mangling a code into a word; `enterkeyhint`
makes the return key say "go".

### The share string leads with the rung and gives badges their own line

The record line carries a colored heart for the rung it landed on — 💔 under
.500, then 🤍 💚 💙 💜 💛 up the ladder — read from `recordFromTotal`, never
from `warTier`. The two disagree and it matters: `warTier(104)` is "elite"
because 104 clears 8 WAR, while `recordFromTotal(104.3)` is "mid" because 104
wins sits in the 100–115 band. Hearts rather than circles or squares, because
lines 2–4 already spend the whole circle-and-square vocabulary on the roster
grid and a seventh circle would read as a stray seat.

**This reverses Round 18.** Badges used to ride the record line precisely so a
decorated season and a quiet one stayed the same height. They now get a line
of their own, because the badge set has grown to 49 triggerable badges and a
run of them was crowding the one number the string exists to report. The
invariant is weaker but still real: lines 1–4 align row-for-row between any
two pasted results, so the grids still stack. Five lines quiet, six decorated.

It also closes Round 20's open question about capping the badge run. With a
line to itself the run needs no cap: the ceiling is 67 code points for a
maximal real season and 83 for the paranoid every-badge case, against a record
line that tops out at 17.

### Ring chasing counts the Classic

A World Baseball Classic winner is worth two pedigree points for that season
and the runner-up one, on the same axis as an October ring, because it is the
same claim: this man won something that year.

The join is the whole job, and its shape is the finding. Wikipedia gives names
and the game keys on Baseball-Reference ids, so 299 roster entries resolve to
176 ids and 127 draftable player-seasons on 67 of the 1,188 cards. The low
overall rate is CORRECT rather than a shortfall — Japan's 2006, 2009 and 2023
winners were almost entirely NPB, Korea 2009 was KBO and Cuba 2006 was the
Cuban league, so those men have no MLB season for a medal to attach to. The
meaningful denominator is "medalists who also have a card that year", and on
the three MLB-heavy rosters it is 30 of 32, 30 of 30 and 18 of 27.

Unresolved entries keep a null id in `data/wbc.json` rather than being dropped.
They are the record of what was checked.

Stacking with October is intended. Bregman, Clippard and Gregerson each hold a
2017 gold medal and a Houston ring, which is +5, and that is a true thing
about their year.

The axis is uneven across the five tournaments, and that is also true rather
than broken. Measured on best-medal-per-card — the unit that matters, because
you draft one man per card — 2017 is worth 1.37 against 2006's 0.13, roughly
10x, not the 22x the raw point totals suggest. In points on a 100–130 season a
2017 card runs about 1.4 ahead of a 2016 one, inside the WAR variance between
any two neighbors. 2023 inverts the usual pattern: its points are almost all
SILVER, because the champion was NPB and the runner-up was Team USA.

The forecast was an order of magnitude high. The Python playtest moves the
mean score 54.5 → 54.6 and 86.3 → 86.4, about +0.2%, against a predicted
1–3%. Roughly 6% of drafts sign a medalist and 16% are offered one.

### Seven badges, and one that was not added

2️⃣ RE2PECT is Derek Jeter, on 18 of the 1,188 cards and a top-5-WAR seat on 8
of them — meaningfully more frequent than any rare, so uncommon. 🎆 THE
WALK-OFF is the three men who ended a World Series with a hit: Carter 1993,
Rentería 1997, Gonzalez 2001, one card each. Identical supply to 💥 THE CHASE
and strictly harder, because the chase seasons carry 6.5/7.5/11.9 WAR against
the walk-off men's 7.9/2.0/0.9 — nobody drafts Joe Carter's 1993 for the
baseball. `renteri01` is pinned OFF the table in badges-supply: Rick Rentería
is one character from Édgar and also played for the 1993 Marlins.

🌠 THE DREAM TEAM is nine of nine, legendary and silhouetted. It carries one
structural caveat worth knowing: it needs `dreamSeats === 9`, and under Clean
House the dream club buys an owner and a ballpark before it seats anybody, so
it needs ten distinct cards. A completed Clean House club makes eleven
commitments and a spin yields at most two, so a finished game has always seen
ten — reachable, but exactly at the floor. A solve that cost one more pick
would remove the legendary from the default bank silently, so a test pins it.

🧠 BEAT THE DREAM TEAM sits at a measured 2.5%, and the measurement names its
own mechanism: five of five winners used 🏠 Homegrown, and with the discount
disabled the rate is zero. The solver models ✌️ and ⭐ but prices every man at
list, so the discount is the one powerup that can beat it. About 0.5pp of that
rate is search slack rather than play — one no-powerup beat sat entirely
inside the solver's model, which means `REFINE_PAIRS`, `DOUBLE_PAIRS` or
`MAX_NODES` missed it. Anyone widening those constants makes this badge rarer
for reasons unrelated to anybody's draft.

🎮 CHEAT CODES is the Konami code and does nothing else. 🪑 THE INTERIM and
🙈 DIDN'T ASK THE PRICE are anti-trophies for leaving the dugout and the bank
to the last spin. 🙈 is 🕶️ FLYING BLIND's exact complement — same `ownerLast`,
same full roster, same positive budget, split on one comparison — so the pair
can never both fire and say opposite things about one payroll.

A seventh axis, `meta`, holds the badges that are facts about the app rather
than about baseball: the walk-out, the two seed jokes, and the cheat code. The
file had already named those three as its members if the axis ever existed.

**No badge was added for off-field criminal conduct**, 🎲's list was not
extended to reach it, and the men in question are named nowhere in the code.
🎲 covers baseball's betting rules and that is the whole of the right scope. A
badge is a reward, and there is no framing under which rewarding a roster
choice about those cases is defensible.

### The powerups combine, and mostly already did

⭐ browsing is no longer gated by 🏠. Homegrown filters the LANDED CARD's
market; a career sheet is a different market, at list prices. That was the
user's literal example and it was genuinely broken — an armed Homegrown shrank
an armed Primetime to debut-eligible rows.

⭐ browsing still requires reachability: an open seat, or an armed 🔁 with an
occupied one it may vacate. Dropping that half reopens the dead end where the
career sheet opens and every season in it is gray. ⭐ with 🔁 and no open seat
now completes as a trade, spending both, vacating the lowest-WAR eligible seat
— vacating is destructive where filling is not, so it picks the cheapest loss.
An open seat always beats the swap inside the sheet, and 🔁 stays ready when
unused, which is the opposite of the row-level rule, because closing the sheet
disarms ⭐ and not 🔁.

⭐ + 🏠 commits at LIST price and leaves Homegrown unspent. Round 5 settled
that discount pricing does not travel, and `endSpin` returns the powerup to
ready.

What did not change: an armed powerup claims a market row's tap, so SIGN and
TRADE FOR do not render beside an armed ⭐. That is Round 17's one-voice rule,
disarming is one tap, and the Trade Deadline swap completes one screen later
anyway. Making the confirm pills co-available is a product decision that would
break the precedent, and it is deferred rather than taken.

## Round 23 — a payroll of zero, one page for the case, and the era question answered (2026-08-03)

### A club with no owner has a payroll of $0

Round 22 shipped a pre-owner box that read `$???` for the payroll and then, on
the first signing, printed the same figure twice — `SPENT $44.1M` beside
`$44.1M OVER` — in two different visual languages. It implemented what was
asked and it looked broken, which was flagged at the time as the judgment call
most likely to come back.

The fix is not a label. It is reading the empty chair as a **payroll of zero**,
which is what it actually is: the chair is where a payroll comes from, so an
unhired one is not an unknown number, it is no number. Every register then
agrees without a rule of its own — the product chip says `$0M` (still dashed,
because one is coming), `$0M` is what is LEFT, and the first dollar committed
is a dollar over. The duplicate figure survives and is now explained by the
chip two lines above it: spent and over ARE the same number when there is no
payroll for any of it to be inside of.

The bar goes with it. Over $0 is over, so a pre-owner club that has signed
anybody wears the orange overrun alarm rather than a neutral hatch implying
nothing is wrong — and that leaves the gray drifting hatch holding exactly one
state, nothing hired and nothing spent, which is what it always meant.

Still a DISPLAY rule and only a display rule. `effectiveBudget` still falls
back to the league-minimum floor, the luxury tax and the payroll bonus are
computed from it unchanged, and nothing here can move a point. The finale
cannot contradict it either: a classic club is not complete without an owner,
so the finale never renders this state.

### All three bars drift

The drift used to mean "unsettled" and belonged to the two unresolved states.
The trouble with that reading is that it made the calm state the odd one out:
a green bar sitting perfectly still beside two that crawl reads as a different
component, and stillness becomes the anomaly rather than the reassurance.

What separates the three was never the motion. It is the **cut edge** — green
has one and its position is the quantity; the overrun has none because the bar
is full and then some; the blank state has none and prints `$0M SPENT`, which
no full green bar ever does. So all three drift at the same 10.9px/s and hue
says which one it is, the same division of labor the rest of the box runs on.

`--green-6` (#40c057) is a new token, one rung below the fill, chosen so
green's stripe step is the same size orange's 5→6 step is. Green's stripes sit
ON the green-5 fill rather than replacing it, at the widest period of the
three, because a one-rung contrast needs a coarser pattern to stay legible —
and the calm bar should be the faintest thing the box draws. Loud stripes on
an under-payroll club would make being under payroll look like a problem.

### The finale's two manager rows wear the rung they earned

Round 22 tinted the skipper's fill and frame from `warTier` and left the
numeral on `.qwar`'s default green, so a +14.0 W skipper sat in a gold seat
reading a green number. The dream club's skipper had the identical defect while
the eight player rows above it were already correct. Both now pass the tier.
`.qwar`'s bare green is now a fallback nothing reaches, kept as the one honest
default for a value with no rung.

### The drafted players' seats are still not tinted, and here is why

Asked directly, and the answer is not readability. **A player seat's fill is a
STATE channel**: card-white at rest, amber when the release picker has armed
it. A tinted fill takes that away — an armed 5.2-WAR seat could then say
"tappable" or "5.2-WAR guy" but not both. The manager's chair has no armed
state (hiring happens in the front office row), and that is precisely what
freed ITS fill for the tier in Round 22. The border carries the rung on every
seat; the fill carries state on eight of nine.

The finale rejected the same thing two rounds earlier for a second reason that
still holds: eight tinted rows are eight competing fills, and the skipper is
the one row whose value has nowhere else to live.

### Two badges retired, and the pill row uncapped

2️⃣ RE2PECT and 🎆 THE WALK-OFF are gone with `CAPTAIN`, `WALK_OFF_SEASONS`,
`isWalkOff` and eleven tests. Both shipped, so real saves hold both keys —
`badgeCase()` drops any key the table no longer defines at ingestion, and a
test now seeds a history of *nothing but* retired keys, because a reader that
only survives a mixed history would pass a weaker one.

`bragRow`'s cap is gone. Four pills and a cut meant a club that earned six was
shown a club that earned four, and a badge cut for space is indistinguishable
from a badge not earned — while the share string was already uncapped, so the
pill row was the one surface understating the result. `cap` survives as an
optional argument defaulting to `Infinity`, because the tests that pin the
fresh-first ORDER need a cut to observe it against. The stagger is counted off
a `--i` index on a `display: contents` seat instead of one hand-written rule
per pill, so nine badges deal in sequence rather than six arriving together.

The trophy case dropped `12 OF 58`. A fraction over a collection answers "how
much is left", which is the one question a souvenir should not be pressing; the
ladder below already shows what is missing by drawing it. The reader still
computes `earned`/`total` — the sheet just stopped printing it.

### The passport is a board, on one page with the badges

Two reversals, both deliberate, both recorded against the comments that argued
the other way.

**One page, no tabs.** Round 22 put the passport behind a tab because a panel
under six bands and fifty-eight pills is a screen and a half of scrolling away.
That is true and it is the wrong problem to solve with navigation: a tab hides
the passport from everyone who does not press it, which is worse than a scroll.
The sheet is one object — a lifetime record of what a career turned up — and it
now reads as one, badges then countries, separated by the app's own dashed rule.

**Every country, with the unvisited ones grayed.** The old rule was "found
stamps only, never a checklist", on the reasoning that nothing in the game
shows a birth country so a grid of gray slots points at a hunt with no tools
for it. That reasoning was about INVITATION and it still holds — a slot names
no player, and no move a player can make produces a Lithuanian. What it got
wrong is what the empty slots are FOR: a player who has fielded eleven
countries has no way to know whether that is most of them or a tenth, and a
souvenir with no scale is a souvenir you cannot tell a story about. The board
answers that and invites nothing. The unvisited half runs commonest first,
which is the honest order for a thing nobody chases — the countries a few more
seasons will turn up on their own sit at the top, and 🇱🇹 at the bottom.

The finale shows the whole passport rather than tonight's slice, with the
career's player counts and a NEW chip on what tonight added. A new stamp is
only legible against the ones already there, and a club that added nothing new
gets a souvenir anyway. No grayed slots there: the empty half is context for a
collection being browsed, and a finale is a scoreboard.

Both surfaces run `passportItems()` in settings.ts, so no figure on a stamp can
disagree between them — the exact drift the tab version was already one edit
away from. NEW is still derived from `visits <= 1` on tonight's countries
rather than from a date comparison: dates are day-granular and two games in one
day would flag the earlier one's countries.

### The help sheet shows the real seat and the real pill

Both were hand-copied markup, on the stated grounds that `RosterRail` and
`PowerupRow` take a `Game`. That is a reason to extract, not a reason to copy.
`RailSeat.svelte` and `PowerupPill.svelte` now take plain values and both
screens render them.

Every one of the forty seat rules moved **verbatim** — selectors and
declarations diffed rule-by-rule against the old file — so the live rail's
phone and desktop geometry is byte-identical to what shipped. The pill gained
`color: inherit`, because it renders as a `<span>` when given no `onclick`: a
focusable control that does nothing promises an action a help sheet cannot
deliver.

One real bug fell out of the extraction and is worth recording. `RailSeat`
turns itself into a full-width row at 760px, and the help sheet's specimen grid
is two narrow columns — so on desktop every name clipped. The specimen now
switches to the rail's own flex column at the same breakpoint, which is
correct on its own terms: a help sheet has to teach the screen the reader is
about to be looking at. `PowerupPill`'s container query has the same shape of
contract, and both callers declare `container-type: inline-size`.

The eight seats are counted off `SLOT_TYPES` rather than written out, in the
loop section and the new one under the squad — copy drifts the way markup does.
The payroll section now says what Clean House actually asks: no payroll at all
until an owner is hired.

### 2020's ballparks are correct, and now they are pinned

Every club drew zero in 2020, so `ranks.index(0)` returns 0 for all thirty and
every 2020 park lands on the 0.85 floor. **That is not a bug.** The floor is
what a park with nobody in it is worth, and 2020 is the one season the whole
league earned it; tie-breaking the zeros by any rule at all would invent a gate
ranking out of thirty identical empty stadiums.

A 0.0 multiplier was considered as an easter egg and rejected. It would
multiply an owner's budget down to no payroll, which is not a joke — it is a
card that ends the game for whoever buys it. The floor punishes; zero forfeits.
Three tests now pin all of this, because the shape invites a fix.

### Study 16: the era gap is real and does not reach the score

The 1980s WAR-per-dollar deficit reported in Round 22 was attributed to the
$1M price floor meeting a moving salary minimum. **That mechanism was wrong.**
The normalized minimum is flat across forty years ($1.0–1.6M) and aggregate
WAR per dollar is nearly flat too (0.131 in 1985 to 0.155 in 2025). The real
gap is DISPERSION at the top of the market: the best bargains in 1985–89 return
1.97 WAR/$M against 4.81 in 2015–19, because median salary is $8.1M in 1985 and
$1.4M in 2025 — before arbitration there was no long tail of minimum-salary
seasons with real WAR in them.

Which is genuine history, so the question is only whether it costs anybody a
season. Study 16 says no, twice, over 1,200 vanilla classic games:

- By decile of mean roster year, totals run 110.3–113.7 with no trend, and the
  oldest decile scores 2.88 points **higher** than the newest — the sign is
  backwards from what the ratio predicts.
- By seats drafted before 1995 (the sharper cut, because a mean of eight years
  regresses to the middle of the window), totals run 110.7–113.1 across zero
  through four old seats, and roster WAR barely moves at all (37.0–37.9).

The one term that does move is the payroll bonus at four old seats: 5.83
against ~7.0. An old club spends more of its cap on fewer men and misses "spent
it all" slightly more often. That is the mechanism working, not failing.

**So nothing changes.** Dollars are already normalized for LEVEL (share of
league-average slot-8 payroll × $160M); what is left is distribution SHAPE, and
flattening that means rank-mapping each year's salaries onto a canonical curve,
which deletes the compressed pre-arbitration structure the prices currently
teach. Adjusting owner budgets does not reach it either — the payroll bonus
caps at +10 however large the cap is. The study is the tripwire: if a data
regen or an economy change ever turns the curiosity into a handicap, it fails
and names which term moved.

### Deferred from this round

1. **The locked stamps' flags are grayscaled to 50% opacity.** Legible as
   flags, not identifiable as countries — which is intentional (the name is
   printed on every one) but is the one number here that was picked by eye
   rather than measured.
2. **`bragRow`'s `cap` argument now has no production caller.** It is kept for
   the order tests and for a future width-budgeted surface. If neither
   materializes it should go.
3. **The help sheet's market row is still hand-drawn.** `PlayerList` is a list
   of buttons wired to signings and pickers, and there is no presentation layer
   to lift out of it that would not be the whole component. It is the one
   specimen that can still drift.
4. **Everything deferred in Round 22 (items 1–8) stands**, including the
   missing parity-fixture generator — `scoring.test.ts` points at a generator
   that is not in `git log`, so those fixtures can no longer be regenerated
   from the Python source of truth. That remains the highest-value item on the
   list.

### Two defects the round's own changes introduced, both caught before shipping

**The help sheet's manager chair was lying.** It shipped as
`tier="star"` beside a hand-typed `war="+9.4 W"` — and 9.4 is `elite`, so the
sheet was teaching the wrong rung directly under a caption reading "a seat's
border color is that player's WAR tier". The number was invented too: Cox's
1995 Braves went 90–54, which is `+7.2 W` through the engine's own expression,
and 7.2 IS `star`. Every specimen figure is now the real one off data/cards
(Piazza 8.7, Maddux 10.8, Pedro 9.8 at $54.6M, Pudge 6.4 at $44M), every tier
is derived by `warTier` rather than written down, and `help-specimens.test.ts`
finds each one on a card. Extracting the components fixed the markup drift and
left the *data* drift untouched — worth remembering as a separate failure mode.

**The uncapped brag row's first stagger broke BadgeSlot.** Replacing the
hand-written `:nth-of-type` rules with a `display: contents` span carrying a
`--i` index is correct CSS and quietly wrong here: `BadgeSlot.measure()` reads
`btnEl.parentElement` to get the row it places its reveal panel against, and a
`display: contents` parent generates no box, so `getBoundingClientRect()`
returns zeros and every panel in the finale would have been mis-placed. The
stagger is a `delay` NUMBER on BadgePill now — no wrapper, no selector counting
siblings (which the panel would break anyway by inserting itself into the row).
Verified in the browser rather than argued: seven pills at 0→0.72s, panel
`offsetParent` `.brags`, fenced inside the row.

## Round 24 — one line color, every seat on its rung, and the fixtures come back (2026-08-03)

### The structural line stops being ink

`--line: #57534a` now draws every plain white box in the game: market rows, the
ledger, the bank box, buttons, chips, picker tiles. Thirty-three borders moved.

app.css used to argue the other way, in as many words — that ink on the ground
is 14.09:1 against 2.2–6.2:1 for every tinted border, so ink was "the only thing
left holding the page's structure" and softening it "would leave nothing hard on
the page." The measurement was right and the conclusion was too strong. At
7.53:1 on card the line still outranks the strongest tinted border, so the
hierarchy the tinting rule depends on survives intact; what changes is that a
colored surface can hold its own beside a plain one instead of being fenced by
it. WCAG 1.4.11 asks 3:1 of a meaningful boundary, so this is a stylistic
setting with real headroom, not a contrast budget being spent.

Ink keeps the two jobs that were never structure — the armed dash and a
committed solid fill (the SIGN pill, the confirm pill). Those are now the
hardest marks on the page, which is the correct order: the thing you can act on
should outrank the box it sits in. The two saturated team chips (OAK green, NYY
navy) keep their ink line for the reason already recorded beside them: a fill
that dark has no rung 2 to drop to, so there is no pair to make.

### Every seat on the finale wears its rung, which is what fixed the skipper

The manager's row kept being reported as "still bright green." It was not
broken. `warTier(2.6)` is `mid`, `--war-mid-fill` IS green-2, and the row was
correctly wearing the rung its wins earned. The problem was that it was the only
tinted row on a page of white ones, so a correct mid rung read as a highlight.

A cue that is right and unreadable is a design bug, not a data bug, and the fix
is to stop making the skipper the exception. All eight player rows now tint too,
in both lists and for both skippers. The column reads gold-gold-violet-blue down
its edge and the shape of a club is legible before a single number is.

Round 23 had rejected exactly this, on the grounds that eight tinted rows would
be "eight competing fills." That is true of eight fills chosen for variety and
false of eight drawn from one ordered ladder — the ladder is the point, and
seeing it is what the finale is for.

Consequences, all forced:

- The numeral goes ink on every row. That is app.css's rule for type on a rung-2
  fill (9.52:1 at worst, 13.41 at best) against 2.17–3.77:1 for a numeral tinted
  to match its own fill. The rung is said twice already, by fill and by frame.
- Both sub-lines go `--muted-2`. They now sit on whichever of six washes the row
  supplies rather than on card white, and violet-2 is the darkest of them.
- The dream team's "you found this one" green tint is gone, replaced by the star
  the squad list already uses. Against a tinted column the green tint had become
  indistinguishable from a mid-rung row. One cue used in both lists is more
  consistent than two cues used once each.

**The one live objection.** The `low` rung is the warm gray pair, and a tinted
`low` row reads a little like the `taken` state on the draft screen, which uses
the same tokens plus a grayscale filter. No finale row is ever `taken`, so
nothing collides in fact — but a 1.9-WAR reliever now looks faintly disabled.
Left alone: it is the honest bottom of a color ladder, and inventing a seventh
hue for it would break the ladder to fix a resemblance.

### The passport is a board of flags

The flag IS the stamp. Thirty-nine spelled-out country names is a list; a field
of flags is a collection, and the second is what a passport is. The name moves
to the stamp's accessible name and its tooltip rather than disappearing — a
screen reader gets "Dominican Republic, 3" and the tests now look it up there,
which is a strictly better contract than reading it off a `>Japan<` text node. A
country whose flag the table does not know still prints its name, because then
the name is the only mark there is.

An unvisited country keeps its rarity fill. A country's tier is a fact about the
COUNTRY — true before anyone has been there — so showing it turns the board from
a checklist into a map: the gold squares are visibly the hard ones the first
time the case is opened. What a slot loses is the solid border, the count, and
the flag's color.

Held at 0.62 opacity, and that number is doing real work. Most of the table is
`ultra` — the long tail of one-player countries is the bulk of it — so a board
drawn at full strength came out a wall of gold in which an earned USA (common,
warm gray) was the quietest thing on screen. That inverts the whole point: the
stamps you HAVE are the souvenir and the slots are context.

The prose note under the stamps is gone. A passport that needs a caption is not
a passport, and both facts it carried (what a number counts, which seasons have
none) are already on each stamp's own title, attached to the country being asked
about rather than to the board.

**A spacing bug, found by moving it.** The passport band was a sibling of the
wrapper holding the rarity bands, not a member of it, so `.band + .band` never
reached it and its separator rode closer to the stamps above than any other
separator on the sheet. It is inside the wrapper now and the rhythm is uniform.

### The buttons were two controls pretending to be one

`.bic` (the button glyph) and the action row's cell shape both lived twice,
privately, in Home and Finale. That is how the two surfaces came to disagree
about them: PLAY's flame was loose text inheriting its label's 17px while every
other glyph in the game was pinned at 19px, and the finale read `Modes / Replay
/ Share` in Title Case two taps from home's `PLAY / LAST GAME / PLAY A SEED` in
caps. Both are now `.bic` and `.btnrow` in app.css, all-caps everywhere, with
the optical centering correction the caps now require (0.047 × font-size).

**"Replay" was the wrong word and is now PLAY AGAIN.** The button calls
`newGame()`, which starts a fresh season in the same mode on a NEW random seed.
It replays nothing. The seed chip directly beneath it is the thing that actually
replays a game, so the page had the word attached to the wrong control — which
matters more now that per-game finale history is on the table.

### Five badges, each measured before it shipped

🫡 FEARLESS LEADER (8.95%), 🚒 THE FIREMAN (1.4%), 🧤 THE FIELD GENERAL (7.7%),
🪙 LEAGUE MINIMUM (10.15%) and 💳 THE BILL CAME DUE (0%). Study 17 plays 4,000
games across three populations and reports what each candidate would fire at, so
every rarity is the tier a player actually hits.

Two things the study settled that argument could not:

**"The skipper beat the whole roster" is a badge that can never fire.** Framed
as beating every individual seat it lands at ~9%; framed as beating the roster's
TOTAL WAR it is 0.00% in 6,000 games. The first framing shipped because the
second one is dead code with a nice name.

**💳 fires in 0.05% of games, and ships anyway.** A baseline good enough for a
rung that the luxury tax then stamps away is a genuine hole in the on-field
axis — `onFieldBadge` vetoes the rung and awards nothing in its place — but it
turns out clubs that spend enough to be taxed that hard are also carrying the
WAR to survive it. Shipping it at `freq: 0` is consistent rather than a
compromise: 👔, 📉, 💀, 🧾, 🕸️ and 🏖️ all carry a measured 0 already. That is
what an anti-trophy is here — reachable, never accidental.

### The help sheet was implying six things it never said

Not a copy pass. The gaps, in order of what a player loses by not knowing:

1. The payroll bonus is a **−10 to +10 swing**, described as "up to +10" — half
   a 20-point axis was invisible.
2. The luxury tax is **uncapped**, never stated.
3. **162 points is a perfect season** was never stated at all, though badges.ts
   asserts "the game's stated goal, which the help sheet already states."
4. The sheet claimed a seat's border color IS its WAR tier and showed no key.
5. World Baseball Classic medals score, on a row whose chips only ever draw
   💍/🚩, so those points arrived from nowhere.
6. The dream team was scored against and never defined.

Spacing is now one rhythm over the sheet's children rather than adjacency rules
written a pair at a time — which is how a payroll caption came to sit at 0px
against the box below it, the only zero gap on the page.

### The parity fixtures can be regenerated again

`scoring.test.ts` told anyone regenerating its 31 fixtures to use "the snippet
in the repo history." No such snippet was ever committed — confirmed by
searching every tree in every commit. So for most of this project's life a
balance change in `scoring.py` could be mirrored into `scoring.ts` wrongly, or
not at all, and nothing would fail.

`pipeline/gen_fixtures.py` closes it. Run against the current `scoring.py` it
reproduces `scoring-fixtures.json` byte for byte, which is simultaneously its
own smoke test and a live proof that the two implementations are in parity right
now rather than presumed to be.

**BUILD.md was the third copy, and it is the one that rotted.** It restated the
formulas in prose with no test under it, and by now had replacement wins, ring
points, the skipper's per-net-win rate and the record's derivation all wrong,
with Manager of the Year, the Classic and the scouting bonus missing entirely.
The Py↔TS pair, which has a test between them, stayed exact. That is the whole
argument about duplication in one file: the copy nobody executes is the copy
that lies. It now describes the shape and points at the module for every number.

### Open, with the reasoning so far

**Scouting at 0.5 instead of 1.0** — settled in Round 25 below. It needed the
same treatment the badges got (a study, then a decision), and it was cheap to do
correctly because changing it means regenerating fixtures, which is finally
possible.

**The payroll bonus is not a 10-point axis, it is a 20-point one**, and there is
a cliff at the cap: `+10` at exactly the budget, `0` one dollar over, plus an
uncapped tax from there. Worth deciding deliberately rather than trimming the
ceiling on the assumption it runs 0→+10.

**~9.2 MB of the 16 MB deploy is droppable** and none of it is on the critical
path. `wbc.json` (23.5 KB) ships and is never fetched; minifying the card JSON
alone is 2.2 MB with no schema change; twelve fields are dead across every card.
Untouched this round because it is a pipeline change that cannot be verified
without a full rebuild.

**`statLine()` was a finished, tested, unused feature, and it is now deleted.**
`bat` and `pit` were on every player with `format.ts:statLine` as their only
consumer, which no component imported. The open question was whether that made
it a regression to restore or data to drop; it was put to the player, who does
not want the trad line, so the branch is closed and both the function and the
two objects are gone. The cards fell 15,202,676 → 12,478,984 bytes (2.72 MB,
17.9%), verified by diffing the old and new trees key by key: zero card-level
key changes, zero player-key changes beyond `bat`/`pit`, zero shared-value
changes. `pipeline/transform.py` still BUILDS the stat lines and nothing emits
them — the multi-stint join is the expensive half and deleting it would pull
`"Batting"` out of `LAHMAN_TABLES`, changing what a fresh clone downloads.

**Twelve more dead card fields are measured but NOT removed.** `warRaw`,
`contract`, `salary`, `est`, `pa`, `gs`, `relIP`, `teams`, `attendancePct`,
`budgetRaw`, `contracts` and `posG.dh` have no reader in `app/src` outside their
`types.ts` declarations and `lab/fixtures.ts`, which writes them to satisfy the
type rather than reading them. Dropping all of them is a further 4.82 MB (38.6%
of what remains). Held back because the cost is not in the pipeline: `gs` alone
has 47 fixture hits across `app/tests`, `pa` 27, `contract` 22, and those would
surface as excess-property errors in `svelte-check` rather than as test
failures. `engine.svelte.ts:1404` also spreads a whole card (`...card`) for the
best-roster yardstick, so any card-LEVEL removal has to be checked against
save/share serialization first — that would make it a save-compat question
rather than a size one.

**History cannot simply be capped.** `appendHistory` is unbounded and fails
silently at quota, which looks like a bug wanting a `slice`. It is not: the
trophy case and the passport are lifetime UNIONS over that log, so dropping the
oldest row deletes a badge the player earned. The correct fix is compaction —
fold a dropped row's badges and countries into a retained summary — and it is
not urgent at ~420 bytes a row (about 12,000 games). It becomes urgent
immediately if per-game finales are stored, at ~5.4 KB each.

## Round 25 — a scout point is worth half, and the copies that said otherwise (2026-08-03)

### SCOUT_HIT_POINTS is 0.5

Round 24 left this open and named the reason it could finally be closed: the
change is one constant in two files plus a regeneration, and the regeneration
diff is the whole blast radius. That is exactly what it turned out to be. Of the
31 parity cases, 18 moved and 13 (the zero-hit ones) are byte-identical; in
every case that moved, `scoutBonus` and `total` fell by exactly 0.5 per hit and
nothing else changed. No other field in any case moved, which is also the
standing proof that `gen_fixtures.py` has not drifted from the fixtures it
generated at 1.0.

What it costs a real season, from the always-on bot regression over 400 games a
bot: baseline 112.5 → 110.9, powerups 137.7 → 135.4, and the powerups bot's
≥162 rate goes 1% → 0%. WAR, spend, the payroll bonus and the tax columns are
unchanged to the tenth, so the whole move is the scouting row and nothing
leaked. A perfect nine-⭐ sweep is worth 4.5 points now rather than 9 — less
than two World Series rings, where it used to be three.

### The pair now says it is a pair

`scoring.py` and `scoring.ts` each carry a header naming the other file by path
and naming `pipeline/gen_fixtures.py` as the thing that fails when only one of
them is edited. The mechanism has existed since Round 24; what was missing was
any way for someone opening one file to learn the other exists before changing a
number in it.

### Five more copies, found by asking what still restates a constant

BUILD.md was the third copy and it rotted (Round 24). It was not the last one.

- **SPEC.md's Scoring section was a fourth prose copy, and it had rotted
  further than BUILD.md's did.** It carried `47.7 + Σ WAR` (the baseline has
  been 50 since Round 6), an award table missing every ballot finish and the
  All-Star selections, no Classic medals, no scouting bonus at all, and — worst,
  because it describes a mechanic the game deliberately removed — "displayed
  record comes from a seeded game-by-game Monte Carlo sim." The sim was cut in
  Round 5 for reconciling with nothing; the spec has been advertising it since.
  It is not a dead file, either: BUILD.md's first line, README.md's reading
  order and `engine.svelte.ts`'s header all point a reader at it. Same treatment
  BUILD.md got — the shape, in words, and the module for every number. It is the
  cleanest demonstration of the rule available: two prose copies, written by the
  same hands from the same source, and BOTH drifted, while the Py↔TS pair with a
  test between them stayed exact.

- **`bestroster.ts`'s header wrote the whole objective out in numbers** —
  `min(50 + WAR + 0.2·mgrNet, 162)`, `10·(2·spend/budget − 1)`, `3·rings`,
  `1·scoutHits`. The block earns its place by explaining why the solver
  maximizes the finale's total rather than WAR, so it stays; it now names the
  terms and points at `./scoring` for every value, which is the same treatment
  BUILD.md got. Its fixed-point proof is written with a symbolic weight too —
  the argument needs the scout point to be non-negative and needs nothing else
  about it, and that is worth saying, because the old proof was only literally
  true at 1.0.
- **The help sheet said `+1`**, in a SCORING list whose line directly above it
  already interpolates `{MANAGER_PER_NET_WIN}`. It interpolates
  `{SCOUT_HIT_POINTS}` now.
- **Study 4's theoretical ceiling had three constants inlined, and one had
  already rotted.** It computed the dataset ceiling with `net * 0.1` — the
  manager rate has been 0.2 since Round 6 — plus a literal `+10` bonus and `+9`
  scout. It imported `REPLACEMENT_WINS`, `GAMES` and `AWARD_POINTS` from
  `scoring.ts` and inlined the rest, which is precisely the shape a rot takes:
  the pinned half stays right and the inlined half quietly stops being true. All
  four terms are imported now. The stale one dates to `0ede1d0`, 57 commits back,
  and this is the argument for pinning stated at its cheapest — nothing failed,
  no test went red, the study just printed a wrong ceiling that whole time.
  Its artifact is regenerated (5,000-seed sweep, 414s), and the correction is
  larger than the scout change that prompted it: the skipper term doubles, so
  the dataset ceiling goes 211.1 → 213.6 even though the scout term fell 9 → 4.5.
  Lou Piniella's 2001 Mariners were being credited +7.0 wins where the shipped
  game gives +14.0. The sweep moves too, and downward as expected: max 174.5 →
  172.5, mean 135.5 → 134.5, and games ≥162 over 5,000 seeds 31 → 23.
- **The bot harness reported the scout BONUS in a field both studies read as a
  hit COUNT.** `scout: f.parts.scoutBonus` was indistinguishable from
  `f.scoutHits` while the constant was 1.0. Study 10 knew, and said so in a
  comment that stopped being true the moment the constant moved; Study 12 did
  not know, and would have reported a 🔮 CRYSTAL BALL rate thresholded on points
  against a badge gated on seats. The field is `f.scoutHits` now, because a
  count keeps meaning the same thing when the price of a seat changes.

Left unpinned deliberately: the help sheet's award values, its `+3` ring and its
`50 base`, and the finale's `50 + N WAR` why-line. Interpolating ten award
constants into a sentence a player reads makes the sentence worse, and the copy
is a teaching surface rather than a second implementation. The distinction that
matters is whether a number is restated somewhere it can go stale unnoticed —
these are read every time the sheet is opened, on the same screen as the ledger
that would contradict them. A prose file nobody opens for months is the opposite
case, which is why both of them rotted and the help sheet did not.

### One display bug the constant would have created

The finale's scouting row rendered `signed(p.scoutBonus, 0)`, matching the
trophy case and ring-chasing rows above it, which are integer-valued by
construction. `scoutBonus` is not integer-valued any more: at any odd hit count
the row would have rounded to a whole number and stopped adding up to the total
printed underneath it. It renders to the tenth now, like the payroll bonus and
the baseline-wins rows that were already fractional.

### A weaker intent than the test names claim

`bestroster.test.ts` has two below-replacement cases — a −2.0 catcher and a −0.5
catcher — whose comments read as if the solver weighed the scout point against
the WAR and decided. It does not: rule 6 makes seats dominate the total, so a
lone card's lone catcher is rostered at any WAR whatsoever. Neither case can
fail on a change to `SCOUT_HIT_POINTS`, and neither could at 1.0 either. The
comments now say what the cases actually pin. Recorded rather than fixed,
because a case that discriminates on the constant would be a different case, not
a tuned version of these.

## Round 28

### Homegrown Discount Travels to Prime Time (supersedes round 5)

Round 5 ruled that 🏠 Homegrown's discount did not travel to ⭐ Prime Time:
the discount was described as a claim about the LANDED card's market, not the
career sheet. Round 28 reverses this. The mechanism that was the obstacle
(`discountEligible` needing to read `debut` from the career-sheet season) was
never actually a problem — `CardPlayer.debut` is a required field on every
card season, and `this.card` in `discountEligible` is the LANDED card (not the
career sheet's browsed card), so the eligibility check works identically for
prime picks. The only change is intent: a player who debuted at this franchise
is hometown-eligible whether you sign the landed season or a career year. The
display in `PrimePicker.svelte` routes through `game.priceFor(sea.p)` so the
green "$1M" price appears before the player clicks.

When discounted, `spendPowerup("hometown")` is called inside `applyPrime`,
before `consumeChoice`, mirroring `signPlayer`'s existing order.

### WBC Ring Values Halved

World Baseball Classic gold medals drop from 2 → 1.5 and silvers from 1 → 0.5.
A Classic is now worth half a World Series at both rungs (WS ring 3 / pennant
1). Only five Classics land inside the 1985–2025 card window, and their rarity
made the original 2/1 values distort the ring-chasing axis for a handful of
seasons. At 1.5/0.5 the medals remain meaningful (a gold + ring season like
2017 Bregman is still +4.5) while bringing the Classic into proportion with
October hardware.

**Discriminant split**: `CardPlayer.wbc` and `Signed.wbc` store 2 (gold) / 1
(silver) as card-data values — unchanged. New constants `WBC_CHAMPION_ID = 2`
and `WBC_RUNNERUP_ID = 1` in `scoring.ts` serve as filter discriminants;
`WBC_CHAMPION_POINTS = 1.5` and `WBC_RUNNERUP_POINTS = 0.5` are the scoring
weights. Comparison code must use the ID constants, not the point constants.
`Finale.svelte` (not owned by this agent) uses the point constants as
discriminants — those four comparisons need to be updated to the ID constants
by the Finale agent.

### Per-Season Refinement of the Homegrown + Prime Time Rule (addendum to round 28)

The initial round 28 implementation treated the discount as per-player: if the
player's debut franchise matched the landed card's franchise, every career season
on the career sheet received the $1M price. That is wrong.

**The correct rule: the discount is per season.** Only seasons whose card
FRANCHISE matches the player's debut franchise sign at $1M. On an A's card with 🏠
armed, McGwire's 1987 OAK season costs $1M; his 1998 STL season costs full price.

**Mechanism**: the comparison runs on the season card's `franchise`, never its
team code. `p.debut` is a franchise id, and renamed clubs (CAL → ANA Angels,
MON → WSN, FLA → MIA) have seasons whose team code equals no debut value —
the first cut of this rule compared `sea.team` and priced every 1986 Angels
season at list with 🏠 armed, caught live in Chrome. `applyPrime(team, year)`
loads the season card and checks `primeDiscountEligible(p, card.franchise)`;
`primePriceFor(p, card.franchise)` applies the $1M cap. `PrimePicker.svelte`
threads `card.franchise` onto each season row and renders
`game.primePriceFor(sea.p, sea.franchise)` so the correct price (full or $1M)
shows before the user clicks.

The original round 28 text above incorrectly described the display as routing
through `game.priceFor(sea.p)`.

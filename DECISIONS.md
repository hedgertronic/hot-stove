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
8. **Hometown Hero surfacing.** When owner+stadium franchises match and the hero is
   unused, a slim 🏠 strip appears under the powerup row, and every eligible player row
   (debut == that franchise) shows 🏠 with its price rewritten to that season's
   normalized league minimum. Signing one consumes the hero. Roster full + TD unspent:
   hero rows stay live through the TD swap flow at hero price (burns TD and hero
   together). Hero pricing applies at commit time only — no retroactive repricing.
9. **Effective bankroll** = `(owner ? owner.budget : minBudget) × (stadium ? mult : 1)`.
   The stadium multiplier applies to the league-minimum floor too — you bought the
   park. Real floor from data: **$18.2M** (2021 Orioles), not the mock's illustrative
   $45.1M. Punitive as intended.
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
  math; owner/stadium rows never render; skipper still hires. Hometown Hero is
  naturally unreachable (needs owner + stadium). Share strings and history entries are
  tagged with the mode.

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
  new WAR/cost/awards/pedigree, real contract price (hero pricing doesn't travel),
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
  disarming after pick one (armed pill reads "PICK 2 — TAP TO UNDO") or moving on
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
- **Help sheet** (? pill, upper-left): loop, bankroll (incl. Hometown Hero and
  sign-past-the-cap), scoring with medal values, one line per powerup — and it
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

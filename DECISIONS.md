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

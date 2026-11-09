# Badge style guide

Rules for writing a badge: the copy, the face, the key, and the process. The
badge table lives in `app/src/lib/badges.ts`; several of these rules are
enforced by tests, noted inline. Every new badge goes through the checklist at
the bottom before it ships.

## The description (`how`)

The `how` string is shown when a player opens an **earned** badge in the
trophy case. Locked badges never reveal it.

- **One sentence, ending in a period.** (Enforced: `badges.test.ts` asserts
  the terminal period.)
- **State the condition the player met, not a rule to chase.** It reads as a
  caption on something that already happened.
- **Verbs:** past tense for things the player did ("Took back a move.",
  "Entered the Konami code.", "Rostered a player worth less than 0.0 WAR.").
  A bare noun phrase for facts about the season or club ("Back-to-back losing
  seasons.", "A gold record, 155 wins or better, with a below-replacement
  player on the club.").
- **Plain and short.** Numerals, not spelled-out numbers ("95", "$51.5M",
  "155 wins"). No em dashes; use commas. No second clause explaining why the
  badge exists — that reasoning lives in the def's comment, not the copy.
- **Name the record you read.** A badge keyed to baseline wins must say
  "baseline wins" and must not say "stamp"; a floor rung reads "the record
  the finale stamps". (Enforced: the `baselineKeyed` and floor-rung wording
  tests in `badges.test.ts`. A new baseline-keyed badge joins that list.)
- **Categories over verdicts** for anything about real people: name the class
  ("MLB gambling suspensions"), never an individual's legal status, which
  dates. See the 🎲 def comment.

## The label and name

- `label` is ALL CAPS, the finale-pill voice. Use "THE X" when the badge
  names the one guy or the one thing (THE ALBATROSS, THE FRANCHISE PLAYER,
  THE DYNASTY); drop the article for counts and clubs (RING BEARERS,
  100-WIN CLUB).
- `name` is the tooltip: mixed title case, matching the label only for pure
  acronyms (WBC, MVP). (Enforced: non-empty, mixed-case, ≠ label.)
- Name the **experience**, not the mechanic — PACKED IT IN, DÉJÀ VU,
  WORD OF MOUTH, not "the quit badge" or "the redo mechanic".

## The face (emoji)

- **Unique across the badge set**, and **never a mode face** — 📊 🔭 🏗️ 🐘 💸
  belong to the difficulties and banks. (Both enforced: `badges.test.ts`
  uniqueness; `share.test.ts` one-emoji-one-meaning.)
- Prefer single-code-point glyphs; a variation selector costs the share line
  an extra code point (documented in `share.test.ts`'s width changelog).
- The face carries the joke or the claim on its own — it is all the share
  string ever shows.

## The key

- Lowercase letters only — the trigger-scrape test matches
  `out.push("[a-z]+")` and anything else is invisible to it.
- Never a mode id ("moneyball", "classic", "scout") and never re-keyed once
  shipped: history rows store keys, and a re-key orphans every earned copy
  (see `secondthoughts`).

## Tier, secrecy, and irony

- `freq` records a **measured** rate from a bot study, or `null` — never a
  guess. Badges bots cannot earn (keyboard, undo, cross-game, deliberate bad
  signings) stay `null` with a comment saying why.
- `ironic: true` ⇔ `rarity: "ironic"` (enforced). An anti-trophy's locked
  slot is anonymous: its name is an instruction to farm it.
- `secret: true` when the name is itself the reward (a discovery, an
  exact-match rung, or a peak) — the doctrine is spelled out on `BadgeDef`.
  A chaseable direction stays named (💯, 🏰).

## Axis and exclusivity

- Exclusive axes (`onfield`, `payroll`, `scout` and the smaller chains)
  resolve in one `if/else` chain; a badge joining a chain must be added to
  the `EXCLUSIVE` map in `share.test.ts`.
- Stacking axes (`roster`, `era`, `goal`, `meta`, `career`) need no
  resolver. Two stackers that can never co-fire by arithmetic (⚖️/⛰️,
  🏰/🧱) stay stackers — the exclusivity is in the world, not the control
  flow.
- A badge unearnable in some bank sets `banks:` so the trophy case's lens
  drops it from N OF M; note whether the lock is mechanics (Clean House) or
  the trigger's own gate (📈).

## Shipping checklist

1. One `BadgeDef` + one trigger in `badges.ts`, with a comment carrying the
   reasoning (tier judgment, threshold choice, anything a future reader would
   re-litigate).
2. New `BadgeFacts` fields are **optional and fail safe**: absent must earn
   nothing. Anything read from the history log is resolved in the engine
   **before** `recordHistory` appends the current game.
3. Trigger unit tests in `badges.test.ts`, including the fail-safe direction.
4. Bump the pinned counts: `trophycase.test.ts` (COLLECTIBLE / BADGES),
   `share.test.ts` (MAXIMAL length, SHIPPED_MAX_LEN, MAX_LEN) and extend the
   width changelog comment there.
5. If the trigger stands on a data fact (a year, a price, a WAR ceiling), pin
   it in `badges-supply.test.ts`.
6. Confirm the golden finale list and the BASE-earns-nothing test still pass
   unchanged, or update them knowingly.
7. Run the copy above against this guide.

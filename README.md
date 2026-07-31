# Hot Stove 🔥

**Play it: [hedgertronic.com/hot-stove](https://hedgertronic.com/hot-stove/)** (public beta)

A baseball drafting game. The stove spins you a random real team-season
(1985–2024); take one thing per spin — sign a player at his real salary, or
hire that year's manager, owner, or stadium. Fill 8 roster seats plus the
front office, manage your payroll, and chase 116 wins.

- **Two difficulties:** 📊 Box Score (stats, salaries, awards) · 🔭 Eye Test
  (names and prices only — trust your memory).
- **Three banks:** 💼 Owner's Box (hire an owner to set your payroll) ·
  ⚾ Moneyball ($82.9M) · 💸 Blank Check ($248.6M).
- **Five once-per-game powerups:** 🎟️ Season Ticket, 🚚 Relocate,
  ✌️ Double Play, 🔁 Trade Deadline, ⭐ Prime Time (browse a whole career —
  or a manager's, park's, or owner's history — and take any season of it).
- **Finale:** score ledger, your squad vs. the card-perfect dream team,
  a 162-game goal bar, and a shareable seed (`GAME #XXXX` replays the exact
  card sequence).

## Repository layout

- **`app/`** — the game: Svelte 5 + Vite + TypeScript. Static site, no backend;
  state persists in localStorage only.
- **`data/`** — 1,158 team-season cards (~8KB each, fetched on demand), index,
  players/owners/specials indexes. Everything the game reads at runtime.
- **`pipeline/`** — fetch → transform → build. Baseball-Reference is touched for
  exactly two files ever, double-cached — never loosen this. `scoring.py` is the
  scoring source of truth (ported 1:1 to the frontend); `playtest.py` is the
  balance harness — rerun it after any economy change. Regenerate data:
  `uv run python -m pipeline.build` (byte-stable).
- **`design/cardstock-v2.html`** — the authoritative visual/interaction
  reference; open it in a browser for live demos.

## Docs

1. **SPEC.md** — the game rules: loop, spin economy, powerups, scoring, modes.
2. **BUILD.md** — the implementation plan: stack, design tokens, data contract,
   state machine, components.
3. **DECISIONS.md** — every rule SPEC left undefined, with rationale.

When SPEC, BUILD, and the mock disagree: SPEC wins on rules, the mock wins on
look and feel, BUILD wins on architecture.

## Development

```sh
cd app
npm ci            # install (lockfile-exact; scripts disabled by .npmrc)
npm run dev       # localhost:5173
npm test          # vitest — scoring parity + engine/mode/best-roster suites
npx svelte-check  # types
npm run build     # production bundle → dist/
```

Deploys automatically: every push to main runs tests + build and publishes to
GitHub Pages (`.github/workflows/deploy.yml`). A red test blocks the deploy.

## Roadmap

- Daily mode: date seed, shared spins, streaks.
- Pipeline: hand-verify the 15 `wikipediaOnly` owner entries.

## Constraints that are decisions, not accidents

- No MLB logos, no player photos (trademark/publicity rights — names + stats are
  protected use per CBC v. MLBAM). Identity = franchise colors + typography.
- Static only; no backend. Daily mode = date seed; share = self-reported string.
- All randomness through one seeded RNG (mulberry32).
- All dollars normalized to share of league-avg slot-8 payroll × $160M.

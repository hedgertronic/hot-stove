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

## What's next (Milestone 1, per BUILD.md)

Svelte 5 + Vite + TS scaffold in `app/`, playable spin → sign → repeat loop against
real cards. Then M2 full rules, M3 finale + share, M4 modes + deploy.

Small pipeline TODOs on the way: player stat lines + age (Scout mode, GM challenges),
league-minimum bankroll in meta.json, franchise accent `colors.json` (~30 hexes),
hand-verify the 15 `wikipediaOnly` owner entries.

## Constraints that are decisions, not accidents

- No MLB logos, no player photos (trademark/publicity rights — names + stats are
  protected use per CBC v. MLBAM). Identity = franchise colors + typography.
- Static only; no backend. Daily mode = date seed; share = self-reported string.
- All randomness through one seeded RNG (mulberry32).
- All dollars normalized to share of league-avg slot-8 payroll × $160M.

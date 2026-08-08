# Hot Stove

**Play it: [hedgertronic.com/games/hot-stove](https://hedgertronic.com/games/hot-stove/)**

A baseball roster-drafting game. Each spin deals a random real team-season (1985–2025); take one thing per spin — sign a player at his real salary, or hire that year's manager, owner, or stadium. Fill 8 roster slots plus a front office, then score the season across wins, payroll, hardware, pedigree, and scouting. Two knowledge modes, three payroll modes, and six once-per-game powerups.

## Repository layout

- **`app/`** — the game: Svelte 5 + Vite + TypeScript. Static site, no backend; state in localStorage.
- **`data/`** — 1,188 team-season cards plus index, players, specials, and meta files. Everything the game reads at runtime.
- **`pipeline/`** — `fetch.py` (raw data acquisition with local snapshots), `transform.py` (aggregates WAR + salary + awards into game-ready structures), `build.py` (emits all `data/` files). `scoring.py` is the scoring source of truth, ported 1:1 to the frontend. `playtest.py` is the balance harness — rerun after any economy change.
- **`design/cardstock-v2.html`** — visual and interaction reference; open in a browser for live demos.
- **`pyproject.toml`** — pipeline dependencies (`fungo`); managed with `uv`.

## Development

```sh
cd app
npm ci            # install (lockfile-exact; ignore-scripts enforced by .npmrc)
npm run dev       # dev server at localhost:5173
npm test          # vitest — scoring parity, engine, mode, and best-roster suites
npm run check     # svelte-check type pass
npm run build     # production bundle → dist/
```

## Data pipeline

Refresh or rebuild `data/` from the project root:

```sh
uv run python -m pipeline.build
```

The build is byte-stable. Raw data is snapshotted under `build/raw/` — delete a snapshot file to force a re-fetch for that source; never loop requests against Baseball-Reference.

## Deployment

Every push to `main` runs tests, then build, then deploys to GitHub Pages via `.github/workflows/deploy.yml`. A failing test blocks the deploy. Pushes that touch only `*.md` or `design/` files skip the workflow.

The canonical Cloudflare Workers deploy lives at `hedgertronic.com/games/hot-stove/` (`app/wrangler.jsonc` + `app/worker.js`; deploy with `wrangler deploy` from `app/`). The `hot-stove.josh-6d6.workers.dev` origin remains available as a direct Worker preview.

The social-card image (`app/public/og-image.png`) is committed, not built in CI; regenerate it after a branding change with `uv run --with playwright python tools/generate_og_image.py`.

## Docs

- **LAUNCH.md** — authoritative launch checklist and release verification.
- **SPEC.md** — game rules: loop, spin economy, powerups, scoring, modes.
- **BUILD.md** — implementation plan: stack, design tokens, data contract, state machine, components.
- **DECISIONS.md** — every rule SPEC left undefined, with rationale.
- **DEVLOG.md** — running notes.

When SPEC, BUILD, and the mock disagree: SPEC wins on rules, the mock wins on look and feel, BUILD wins on architecture.

## Data & attribution

Player statistics and biographical data derive from the **Sean Lahman Baseball Database**, licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Source: [seanlahman.com](http://seanlahman.com/).

WAR data comes from **Baseball-Reference** (Sports Reference LLC, [baseball-reference.com](https://www.baseball-reference.com/)), fetched via the `fungo` library under their standard access terms — two WAR daily files, cached permanently after the first fetch.

The derived data files in `data/` inherit the CC BY-SA 3.0 terms from the Lahman source. The game code in `app/` and the pipeline code in `pipeline/` have no separate open-source license on file.

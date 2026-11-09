# Hot Stove

**Play it: [hotstove.io](https://hotstove.io/)**

A baseball roster-drafting game. Each spin deals a random real team-season (1985–2025); take one thing per spin — sign a player at his real salary, or hire that year's manager, owner, or stadium. Fill 8 roster slots plus a front office, then score the season across wins, payroll, hardware, pedigree, and scouting. Two knowledge modes, three payroll modes, and six once-per-game powerups.

## Repository layout

- **`app/`** — the game: Svelte 5 + Vite + TypeScript. Static site, no backend; state in localStorage.
- **`data/`** — 1,188 team-season cards plus index, players, specials, and meta files. Everything the game reads at runtime.
- **`pipeline/`** — `fetch.py` (raw data acquisition with local snapshots), `transform.py` (aggregates WAR + salary + awards into game-ready structures), `build.py` (emits all `data/` files). `scoring.py` is the scoring source of truth, ported 1:1 to the frontend; `gen_fixtures.py` regenerates the parity fixtures that pin the port. Game balance is measured by the bot harness in `app/tests/bots/` (`npm run test:full`, `npm run test:studies`).
- **`design/logo/`** — source SVGs for the logo and favicon; `npm run dev`/`build` copy them into `app/public/`. The live visual reference is the app's own component gallery at `localhost:5173/?lab`.
- **`pyproject.toml`** — pipeline dependencies (`fungo`); managed with `uv`.

## Development

```sh
cd app
npm ci            # install (lockfile-exact; ignore-scripts enforced by .npmrc)
npm run dev       # dev server at localhost:5173
npm test          # fast suite (~25s) — scoring parity, engine, modes, UI contracts
npm run test:full # + the bot harness regression (~10 min); runs weekly in CI, not on deploy
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

Every push to `main` runs `npm run check`, `npm test`, the real-browser ink-alignment probe, the build, and the cross-origin migration test in Chromium, Firefox and WebKit, then deploys to Cloudflare Workers via `.github/workflows/deploy.yml` (`wrangler deploy` on `app/wrangler.jsonc` + `app/worker.js`). A failing step blocks the deploy. Pushes that touch only `*.md` or `design/` files skip the workflow.

The deployed game lives at `hotstove.io`, its canonical home. One Worker serves it at three origins: the apex, `hedgertronic.com/games/hot-stove/` (the original mount, which runs the save handoff that moves a returning player's `localStorage` to hotstove.io — a redirect there would strand it), and `hot-stove.josh-6d6.workers.dev` as a direct preview. `www.hotstove.io` redirects to the apex. To deploy by hand, run `wrangler deploy` from `app/`.

The social-card image (`app/public/og-image.png`) is committed, not built in CI; regenerate it after a branding change with `uv run --with playwright python tools/generate_og_image.py`.

## Data & attribution

Player statistics and biographical data derive from the **Sean Lahman Baseball Database**, licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Source: [seanlahman.com](http://seanlahman.com/).

WAR data comes from **Baseball-Reference** (Sports Reference LLC, [baseball-reference.com](https://www.baseball-reference.com/)), fetched via the `fungo` library under their standard access terms — two WAR daily files, cached permanently after the first fetch.

The derived data files in `data/` inherit the CC BY-SA 3.0 terms from the Lahman source. The game code in `app/` and the pipeline code in `pipeline/` have no separate open-source license on file.

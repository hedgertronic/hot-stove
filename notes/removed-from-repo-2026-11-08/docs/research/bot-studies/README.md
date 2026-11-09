# Bot-study reports

Console reports from the balance harness in `app/tests/bots/` — each file is
the output of the matching `study*.test.ts` (plus `powerup-bots.txt` from the
always-on harness regression). The studies replay thousands of seeded games
per bot policy to measure the game's economy: score distributions, powerup
value, badge hit rates, era effects.

These are committed snapshots of the shipped tuning. To regenerate after an
economy change, run the studies from `app/`:

```sh
npm run test:studies
```

Each study rewrites its `tests/bots/last-run-*.txt` (untracked); copy a
report here when its findings are worth keeping. The design conclusions the
studies fed live in `DECISIONS.md`.

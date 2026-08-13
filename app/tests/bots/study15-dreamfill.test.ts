/** STUDY 15 — does the dream club ever leave a seat open, and can a played club
 * beat it? Two questions about the same object, so one loop answers both.
 *
 * THE SEAT QUESTION. The game has no passing and will not let a season end with
 * an open seat (DECISIONS.md item 2), so a yardstick printing an eight-man club
 * is measuring a season nobody was allowed to play. The solver used to print
 * one: its DP relaxes the one-season-per-human rule, `repair` vacates a seat
 * when the conflicting card has nothing else legal to give, and every
 * comparison after that ranked clubs on the finale total alone. An incomplete
 * club usually WINS that comparison — the seat it skipped was the one that put
 * payroll over the cap, and the luxury tax it dodges is worth more than the win
 * it gave up. `better` in bestroster.ts ranks on (seats filled, total) instead,
 * seats dominating, and this study is the assertion that it holds on real games
 * rather than on fixtures: not a rate to stay under, but zero.
 *
 * The bound is honest rather than assumed. A club cannot finish incomplete, so
 * every seed here is a game that PROVED nine seats reachable from its own pool;
 * anything short is the search losing them, not the cards withholding them. A
 * pool genuinely too thin for nine (a lab fixture, a game abandoned four spins
 * in) is covered in bestroster.test.ts, where the pool can be made thin on
 * purpose.
 *
 * THE CEILING QUESTION, for the "beat the dream team" badge. The solver models
 * ✌️ Double Play (one card supplies two things), ⭐ Prime Time (the off-reel
 * season enters the pool, narrowed to the one man the powerup bought), and
 * repeat landings (one pool entry per landing; `seen` records duplicates).
 *
 * 🏠 Homegrown is deliberately NOT modeled, and this study is where that was
 * priced: modeling it raised the mean ceiling 2.0 points across these four
 * arms and dropped the beat count from 4 to 0 (200 games/arm, 2026-08-12).
 * The omission is what keeps 🦉 OUTSCOUTED earnable. The 🏠-off arm is the
 * control — it isolates bot behavior, not solver modeling, so both arms run
 * the same solver.
 *
 * 🔁 Trade Deadline is unmodeled and cannot move the ceiling. The 🎟️/🚚
 * rerolls and the cold-stove respin ARE modeled now: both cards of a re-deal
 * stay in the pool and the landing pays out at most one of them, so a game that
 * rerolled no longer draws a pick off each card it cycled through.
 *
 * ⭐ Prime Time is the KNOWN GAP that remains, and it inflates: `primeSign`
 * spends the landing's pick, but `offReelCards()` hands the solver that season
 * for free on top of every landing — 3.2 points on one recorded game.
 * bestroster's header carries the shape of the fix.
 *
 * Run: BOT_STUDIES=1 npx vitest run tests/bots/study15-dreamfill.test.ts
 * (BOT_GAMES=<n>, default 500) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALL_POWERUPS, loadData, playGame, type BotConfig, type GameResult } from "./harness";
import { makeSeeds, mean } from "./stats";

const N = Number(process.env.BOT_GAMES ?? 500);
const seeds = makeSeeds(N);

const pct = (n: number, of: number): string =>
  of === 0 ? "n/a" : `${((100 * n) / of).toFixed(2)}%`;

describe("study 15: dream-club seat fill and the ceiling-beat rate", () => {
  it(`counts open dream seats over ${N} games per bot`, { timeout: 900_000 }, async () => {
    const d = loadData();
    const runs: { label: string; bot: BotConfig }[] = [
      { label: "baseline", bot: { name: "baseline", enabled: new Set(), overspend: false } },
      {
        label: "powerups",
        bot: { name: "powerups", enabled: new Set(ALL_POWERUPS), overspend: false },
      },
      // The control for the badge: every powerup the solver does not model
      // except the one that can actually pay — 🏠 Homegrown's repricing.
      {
        label: "no 🏠",
        bot: {
          name: "no-homegrown",
          enabled: new Set(ALL_POWERUPS.filter((k) => k !== "hometown")),
          overspend: false } },
      // The over-cap branch is where an open seat paid best, so a bot that
      // deliberately overspends is the arm that showed it loudest.
      {
        label: "overspend",
        bot: { name: "overspend", enabled: new Set(ALL_POWERUPS), overspend: true },
      },
    ];

    const lines: string[] = [];
    lines.push(`=== Study 15: dream-club seats and ceiling beats, ${N} Classic games/bot ===`);
    lines.push(
      ["run".padEnd(10), "seats".padStart(6), "open".padStart(8), "solverT".padStart(8),
        "played".padStart(8), "beat".padStart(8), "tie".padStart(8),
        "beat|🏠".padStart(9)].join(" "),
    );
    // Every game whose dream club came up short, named so a failure is one
    // `git bisect` rather than one re-run: the seed and the arm reproduce it.
    const short: string[] = [];
    for (const run of runs) {
      const rs: GameResult[] = [];
      for (const seed of seeds) rs.push(await playGame(seed, run.bot, d));
      for (const r of rs)
        if (r.dreamSeats < 9)
          short.push(`${run.label} seed=${r.seed} seats=${r.dreamSeats} cards=${r.seenCount}`);
      // Strict, and ties counted separately: a badge for beating the dream team
      // should not fire on matching it, which is what `ceilingIsAchieved`
      // (a ≤ test, and the finale's own clamp) would count.
      const scored = rs.filter(
        (r): r is GameResult & { solverTotal: number } => r.solverTotal !== null,
      );
      const beat = scored.filter((r) => r.total > r.solverTotal + 1e-9);
      const tie = scored.filter((r) => Math.abs(r.total - r.solverTotal) <= 1e-9);
      const beatHg = beat.filter((r) => r.uses.hgSigns > 0);
      lines.push(
        [
          run.label.padEnd(10),
          mean(rs.map((r) => r.dreamSeats)).toFixed(3).padStart(6),
          pct(rs.filter((r) => r.dreamSeats < 9).length, N).padStart(8),
          mean(scored.map((r) => r.solverTotal)).toFixed(1).padStart(8),
          mean(rs.map((r) => r.total)).toFixed(1).padStart(8),
          pct(beat.length, scored.length).padStart(8),
          pct(tie.length, scored.length).padStart(8),
          `${beatHg.length}/${beat.length}`.padStart(9),
        ].join(" "),
      );
      expect(rs).toHaveLength(N);
    }
    const out = lines.join("\n");
    console.log(`\n${out}\n`);
    const dir = path.dirname(fileURLToPath(import.meta.url));
    fs.writeFileSync(path.join(dir, "last-run-study15.txt"), `${out}\n`);
    // The assertion is the invariant, not a rate: every one of these games
    // finished, so every one of these pools can seat nine.
    expect(short).toEqual([]);
  });
});

/** STUDY 17 — the five candidate badges of round 24, measured before any of
 * them is written into badges.ts.
 *
 * Each candidate is a threshold looking for a number:
 *
 *   1. 🫡 the skipper's win contribution beats every player's WAR
 *   2. 🚒 the relief seat is the most expensive man on the club
 *   3. 🧤 the catcher is the most expensive man on the club
 *   4. 🪙 how many seats a club fills at the league minimum
 *   5. 💳 a baseline that earned an on-field rung, and a stamp that took it away
 *
 * The study measures INGREDIENTS rather than badges — every seat's position,
 * cost paid, WAR and Homegrown flag, the skipper's net, the two records — and
 * evaluates every candidate threshold post-hoc over one population. That is
 * the only way to compare rungs against each other: a study that measured a
 * shipped trigger could answer "does 5 fire often" and never "would 4".
 *
 * Three arms, in study 11's and study 14's shape:
 *   - reference: From the Ground Up bank + all six powerups, cap treated as a hard
 *     feasibility gate. This is the population `BadgeDef.freq` documents
 *     itself against, so it is the arm quoted.
 *   - vanilla: From the Ground Up, no powerups. Context, and the arm that answers the
 *     one question the reference cannot — 🏠 Homegrown pays a flat $1M, so the
 *     reference arm's cheap seats are partly a powerup click rather than a
 *     bargain anyone found.
 *   - overspend: all powerups, crossing the cap whenever the WAR gained
 *     outruns the tax plus the forfeited bonus. Candidate 5 is a badge about
 *     a payroll that busted, and the other two arms never bust on purpose —
 *     without this arm its rate would be a fact about the bots' feasibility
 *     gate rather than about the rung. Study 14 measures the same population
 *     from the other side.
 *
 * Run: BOT_STUDIES=1 BOT_GAMES=4000 BOT_GAMES_CTX=2000 \
 *        npx vitest run tests/bots/study17-newbadges.test.ts
 * (BOT_GAMES sizes the reference arm, default 2000; BOT_GAMES_CTX sizes the
 * two context arms, default the same. last-run-study17.txt is the 4,000 /
 * 2,000 / 2,000 run the thresholds in badges.ts were read off.)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BADGE_BY_KEY, onFieldBadge } from "../../src/lib/badges";
import { Game } from "../../src/lib/engine.svelte";
import { recordFromTotal } from "../../src/lib/format";
import { GAMES, MANAGER_PER_NET_WIN, MARINERS_WINS } from "../../src/lib/scoring";
import { ALL_POWERUPS, loadData, playGame, type BotConfig, type HarnessData } from "./harness";
import { makeSeeds } from "./stats";

const N_REF = Number(process.env.BOT_GAMES ?? 2000);
const N_CTX = Number(process.env.BOT_GAMES_CTX ?? N_REF);
const SLOTS = 8;

/** Every price the candidate cheap-seat rung might call "the minimum". The
 * card set has no single floor: it is $1.6M in 1985, $1.1–1.4M through 1991
 * and $1.0M from 1992 on, so a rung written at $1.0M would be unreachable for
 * a mid-eighties seat that IS at its league minimum. */
const CHEAP_PRICES = [1.0, 1.2, 1.6, 2.0, 3.0];

interface Seat {
  pos: string;
  costPaid: number;
  war: number;
  hero: boolean;
}

interface Row {
  seats: Seat[];
  full: boolean;
  /** (W − L) × MANAGER_PER_NET_WIN — the skipper's contribution in WINS, the
   * same term `ScoreParts.managerWins` carries. Zero with an empty dugout. */
  mgrWins: number;
  hasManager: boolean;
  /** 50 + WAR + skipper, rounded — the finale ledger's opening line. */
  baseline: number;
  /** The record the finale STAMPS: the points total, rounded and clamped. */
  stamp: number;
  total: number;
  spend: number;
  budget: number;
  /** The keys the ENGINE's own `earnedBadges` call produced. Section 6 checks
   * each shipped rung against the candidate predicate that chose its
   * threshold: post-hoc arithmetic over ingredients cannot catch a trigger
   * wired into the wrong branch, and a rung whose two numbers disagree is a
   * mis-wire rather than a measurement. */
  badges: string[];
}

const pct = (n: number, of: number): number => (100 * n) / of;
const f2 = (x: number): string => x.toFixed(2);
const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

/** The candidate triggers, written exactly as they would be in badges.ts so
 * the report and the shipped rung cannot drift apart in this study's lifetime.
 * Each takes the ingredients and answers yes or no. */

/** 1 — the skipper out-earned every man on the field. `full` for the reason
 * 🏅/🧼 want it, and strictly positive because a −16-win skipper over eight
 * negative seats is an anti-trophy rather than this one. */
const fearless = (r: Row): boolean =>
  r.full && r.mgrWins > 0 && r.seats.every((s) => r.mgrWins > s.war);

/** 2 / 3 — one seat strictly outcosts every other. Strict, because 20.5% of
 * the card set's player-seasons cost exactly the same $1.0M and a `>=` rung
 * would hand a club of eight minimum men every position badge at once. */
const priciestIs = (r: Row, pos: string): boolean =>
  r.full &&
  r.seats.some((p) => p.pos === pos && r.seats.every((q) => q === p || q.costPaid < p.costPaid));

/** Which position owns the strict maximum, or null on a tie. */
function priciestPos(r: Row): string | null {
  const top = Math.max(...r.seats.map((s) => s.costPaid));
  const at = r.seats.filter((s) => s.costPaid === top);
  return at.length === 1 ? at[0].pos : null;
}

/** The priciest seat itself — what the club paid for, and what it got. */
function priciestSeat(r: Row): Seat {
  return r.seats.reduce((a, b) => (b.costPaid > a.costPaid ? b : a));
}

/** 4 — seats at or under a candidate minimum. */
const cheapSeats = (r: Row, price: number): number =>
  r.seats.filter((s) => s.costPaid <= price).length;
/** …and the same count with 🏠 Homegrown's flat-priced men taken out. */
const cheapFound = (r: Row, price: number): number =>
  r.seats.filter((s) => !s.hero && s.costPaid <= price).length;

/** 5 — the rung the baseline earned, taken away by the stamp. Written as the
 * complement of `onFieldBadge`'s own veto so it can never drift from the
 * ladder: a rung on the baseline alone, nothing once the stamp is applied. */
const vetoed = (r: Row): boolean =>
  onFieldBadge(r.baseline, r.baseline) !== null && onFieldBadge(r.baseline, r.stamp) === null;
/** …and whether a floor rung caught it anyway, in which case the badge does
 * not fire: it sits at the END of the on-field chain. */
const floorRung = (r: Row): boolean => r.stamp <= 0 || r.stamp <= 40 || GAMES - r.stamp >= 100;

async function runArm(seeds: number[], bot: BotConfig, d: HarnessData): Promise<Row[]> {
  const rows: Row[] = [];
  for (const seed of seeds) {
    let club: Game | null = null;
    await playGame(seed, bot, d, undefined, (g) => (club = g));
    const g = club as Game | null;
    if (!g || !g.finale) continue;
    const seats: Seat[] = g.slots
      .filter((s) => s !== null)
      .map((s) => ({ pos: s!.pos, costPaid: s!.costPaid, war: s!.war, hero: s!.hero }));
    const total = g.finale.parts.total;
    rows.push({
      seats,
      full: seats.length === SLOTS,
      mgrWins: g.manager ? (g.manager.wins - g.manager.losses) * MANAGER_PER_NET_WIN : 0,
      hasManager: g.manager !== null,
      baseline: g.finale.wins,
      stamp: recordFromTotal(total, GAMES, MARINERS_WINS).wins,
      total,
      spend: g.finale.spend,
      budget: g.finale.budget,
      badges: g.finale.badges,
    });
  }
  return rows;
}

describe("study 17: the five candidate badges", () => {
  it.runIf(process.env.BOT_STUDIES === "1")(
    "measures every candidate threshold over one population",
    async () => {
      const d = loadData();
      const powerups: BotConfig = {
        name: "powerups",
        enabled: new Set(ALL_POWERUPS),
        overspend: false,
      };
      const vanilla: BotConfig = { name: "vanilla", enabled: new Set(), overspend: false };
      const busted: BotConfig = {
        name: "overspend",
        enabled: new Set(ALL_POWERUPS),
        overspend: true,
      };

      const t0 = Date.now();
      const ref = await runArm(makeSeeds(N_REF), powerups, d);
      const van = await runArm(makeSeeds(N_CTX), vanilla, d);
      const over = await runArm(makeSeeds(N_CTX), busted, d);
      const wall = (Date.now() - t0) / 1000;

      const arms: { label: string; rows: Row[] }[] = [
        { label: `reference (From the Ground Up + all powerups, n=${ref.length})`, rows: ref },
        { label: `vanilla (From the Ground Up, no powerups, n=${van.length})`, rows: van },
        { label: `overspend (all powerups, crosses the cap, n=${over.length})`, rows: over },
      ];
      const rate = (rows: Row[], f: (r: Row) => boolean): string =>
        f2(pct(rows.filter(f).length, rows.length));
      const bothArms = (f: (r: Row) => boolean): string =>
        arms.map((a) => `${rate(a.rows, f).padStart(6)}%`).join("   ");

      const L: string[] = [];
      L.push("=== Study 17: five candidate badges, measured as ingredients ===");
      L.push(`Wall clock: ${wall.toFixed(1)}s for ${ref.length + van.length} games.`);
      L.push(`Column order everywhere: ${arms.map((a) => a.label).join("  |  ")}`);
      L.push(`Full clubs (eight seats filled): ${bothArms((r) => r.full)}`);
      L.push(`Clubs with a skipper:            ${bothArms((r) => r.hasManager)}`);
      L.push("");

      // ---- 1. the skipper out-earning the roster ----
      L.push("--- 1. 🫡 the skipper's wins beat every player's WAR ---");
      L.push(`  shipped shape (full club, skipper > 0, beats every seat): ${bothArms(fearless)}`);
      L.push(
        `  without the positive gate:                                 ` +
          bothArms((r) => r.full && r.seats.every((s) => r.mgrWins > s.war)),
      );
      L.push(
        `  without the full-club gate:                                ` +
          bothArms((r) => r.mgrWins > 0 && r.seats.every((s) => r.mgrWins > s.war)),
      );
      L.push(
        `  beats the roster's TOTAL WAR (a different, harder claim):   ` +
          bothArms((r) => r.full && r.mgrWins > r.seats.reduce((t, s) => t + s.war, 0)),
      );
      L.push("");
      L.push("  distribution of the skipper's contribution, and of the top seat:");
      for (const a of arms) {
        const withMgr = a.rows.filter((r) => r.hasManager);
        const mw = withMgr.map((r) => r.mgrWins).sort((x, y) => x - y);
        const best = a.rows.filter((r) => r.full).map((r) => Math.max(...r.seats.map((s) => s.war)));
        const q = (xs: number[], p: number): string => f2(xs[Math.floor(p * (xs.length - 1))] ?? 0);
        L.push(
          `    ${a.label.split(" ")[0].padEnd(10)} skipper wins  p50 ${q(mw, 0.5)}  p90 ${q(mw, 0.9)}` +
            `  p99 ${q(mw, 0.99)}  max ${f2(Math.max(...mw))}`,
        );
        L.push(
          `    ${" ".repeat(10)} best seat WAR p50 ${q([...best].sort((x, y) => x - y), 0.5)}` +
            `  p10 ${q([...best].sort((x, y) => x - y), 0.1)}  min ${f2(Math.min(...best))}`,
        );
      }
      L.push("");

      // ---- 2/3. the priciest seat ----
      L.push("--- 2/3. 🚒 / 🧤 which position is the most expensive man on the club ---");
      L.push("  (strict maximum: a tie at the top counts for nobody)");
      for (const a of arms) {
        const full = a.rows.filter((r) => r.full);
        const counts = new Map<string, number>();
        let ties = 0;
        for (const r of full) {
          const p = priciestPos(r);
          if (p === null) ties += 1;
          else counts.set(p, (counts.get(p) ?? 0) + 1);
        }
        L.push(`  ${a.label}`);
        for (const [p, n] of [...counts.entries()].sort((x, y) => y[1] - x[1]))
          L.push(`    ${p.padEnd(6)} ${f2(pct(n, full.length)).padStart(6)}%  (${n})`);
        L.push(`    ${"TIE".padEnd(6)} ${f2(pct(ties, full.length)).padStart(6)}%  (${ties})`);
      }
      L.push("");
      L.push(`  🚒 RP is the priciest seat:  ${bothArms((r) => priciestIs(r, "RP"))}`);
      L.push(`  🧤 C  is the priciest seat:  ${bothArms((r) => priciestIs(r, "C"))}`);
      L.push("");
      L.push("  Supply: the RP seat takes `pos === \"RP\"` only, so a full club holds exactly");
      L.push("  one. The C SEAT takes anyone with ten games behind the plate, and a man");
      L.push("  listed at C can sit in IF or FLEX — so the count of catchers varies.");
      L.push(`  full clubs holding at least one pos === "C":  ${bothArms((r) => r.full && r.seats.some((s) => s.pos === "C"))}`);
      L.push(`  full clubs holding exactly one pos === "RP":  ${bothArms((r) => r.full && r.seats.filter((s) => s.pos === "RP").length === 1)}`);
      L.push("");
      L.push("  Is either a misallocation? Mean final total, club by club:");
      for (const a of arms) {
        const full = a.rows.filter((r) => r.full);
        const rp = full.filter((r) => priciestIs(r, "RP"));
        const c = full.filter((r) => priciestIs(r, "C"));
        L.push(
          `    ${a.label.split(" ")[0].padEnd(10)} all ${f2(mean(full.map((r) => r.total)))}` +
            `   RP-priciest ${f2(mean(rp.map((r) => r.total)))} (n=${rp.length})` +
            `   C-priciest ${f2(mean(c.map((r) => r.total)))} (n=${c.length})`,
        );
        L.push(
          `    ${" ".repeat(10)} the priciest seat itself — cost, then WAR:` +
            `  RP $${f2(mean(rp.map((r) => priciestSeat(r).costPaid)))}M / ${f2(mean(rp.map((r) => priciestSeat(r).war)))}` +
            `   C $${f2(mean(c.map((r) => priciestSeat(r).costPaid)))}M / ${f2(mean(c.map((r) => priciestSeat(r).war)))}` +
            `   any $${f2(mean(full.map((r) => priciestSeat(r).costPaid)))}M / ${f2(mean(full.map((r) => priciestSeat(r).war)))}`,
        );
      }
      L.push("");

      // ---- 4. cheap seats ----
      L.push("--- 4. 🪙 seats at the league minimum ---");
      L.push("  Card-set floors: $1.6M in 1985, $1.1–1.4M to 1991, $1.0M from 1992 on.");
      for (const price of CHEAP_PRICES) {
        L.push(`  at or under $${price.toFixed(1)}M — share of clubs with N such seats:`);
        for (const a of arms) {
          const cells: string[] = [];
          for (let n = 1; n <= SLOTS; n++)
            cells.push(`${n}+ ${f2(pct(a.rows.filter((r) => cheapSeats(r, price) >= n).length, a.rows.length)).padStart(6)}%`);
          L.push(`    ${a.label.split(" ")[0].padEnd(10)} ${cells.join("  ")}`);
          L.push(
            `    ${" ".repeat(10)} mean ${f2(mean(a.rows.map((r) => cheapSeats(r, price))))} seats` +
              `, Homegrown share of them ${f2(
                pct(
                  a.rows.reduce((t, r) => t + (cheapSeats(r, price) - cheapFound(r, price)), 0),
                  Math.max(1, a.rows.reduce((t, r) => t + cheapSeats(r, price), 0)),
                ),
              )}%`,
          );
        }
      }
      L.push("");
      L.push("  Same rungs counting only seats NOT signed at the Homegrown price:");
      for (const price of CHEAP_PRICES) {
        for (const a of arms) {
          const cells: string[] = [];
          for (let n = 1; n <= SLOTS; n++)
            cells.push(`${n}+ ${f2(pct(a.rows.filter((r) => cheapFound(r, price) >= n).length, a.rows.length)).padStart(6)}%`);
          L.push(`    $${price.toFixed(1)}M ${a.label.split(" ")[0].padEnd(10)} ${cells.join("  ")}`);
        }
      }
      L.push("");

      // ---- 5. the vetoed rung ----
      L.push("--- 5. 💳 the rung the baseline earned and the stamp took away ---");
      L.push(`  baseline earns a rung at all:        ${bothArms((r) => onFieldBadge(r.baseline, r.baseline) !== null)}`);
      L.push(`  …and the stamp vetoes it:            ${bothArms(vetoed)}`);
      L.push(`  …and no floor rung catches the club: ${bothArms((r) => vetoed(r) && !floorRung(r))}`);
      L.push(`  (the floor-rung case, which reads 📉/💀 instead): ${bothArms((r) => vetoed(r) && floorRung(r))}`);
      L.push("");
      for (const a of arms) {
        const hits = a.rows.filter((r) => vetoed(r) && !floorRung(r));
        const over = hits.filter((r) => r.spend > r.budget);
        L.push(
          `  ${a.label}: n=${hits.length}` +
            `  over the payroll ${hits.length > 0 ? f2(pct(over.length, hits.length)) : "n/a"}%` +
            `  mean drop ${f2(mean(hits.map((r) => r.baseline - r.stamp)))} wins` +
            `  mean baseline ${f2(mean(hits.map((r) => r.baseline)))}` +
            `  mean stamp ${f2(mean(hits.map((r) => r.stamp)))}`,
        );
        L.push(
          `    with the trigger also gated on spend > payroll: ` +
            `${f2(pct(a.rows.filter((r) => vetoed(r) && !floorRung(r) && r.spend > r.budget).length, a.rows.length))}%`,
        );
      }

      // ---- 6. shipped triggers against the candidates that chose them ----
      /* Once a rung is written into badges.ts the engine's own `earnedBadges`
       * call starts producing its key, and the two columns below must agree.
       * They are measured differently on purpose: the left is this study's
       * post-hoc arithmetic over ingredients, the right is what the finale
       * actually stamped on the season. A gap between them is a trigger in the
       * wrong branch of the chain, which no amount of post-hoc arithmetic
       * could see. Before the rungs ship, the right column reads 0.00. */
      const SHIPPED: { key: string; candidate: (r: Row) => boolean }[] = [
        { key: "fearless", candidate: fearless },
        { key: "fireman", candidate: (r) => priciestIs(r, "RP") },
        { key: "fieldgeneral", candidate: (r) => priciestIs(r, "C") },
        { key: "minimum", candidate: (r) => cheapSeats(r, 1.6) >= 4 },
        {
          key: "taxed",
          candidate: (r) => vetoed(r) && !floorRung(r) && r.spend > r.budget,
        },
      ];
      L.push("");
      L.push("--- 6. shipped trigger vs the candidate predicate (must agree) ---");
      for (const s of SHIPPED) {
        L.push(`  ${s.key.padEnd(14)} candidate ${bothArms(s.candidate)}`);
        L.push(
          `  ${" ".repeat(14)} shipped   ` +
            arms.map((a) => `${rate(a.rows, (r) => r.badges.includes(s.key)).padStart(6)}%`).join("   "),
        );
      }

      const out = L.join("\n");
      console.log(`\n${out}\n`);
      const dir = path.dirname(fileURLToPath(import.meta.url));
      fs.writeFileSync(path.join(dir, "last-run-study17.txt"), `${out}\n`);

      // Structural only — every number above is the deliverable and must be
      // free to move when the badge set or the economy is retuned.
      expect(ref.length).toBeGreaterThan(0);
      expect(van.length).toBeGreaterThan(0);
      // The candidate that fills a documented hole must actually be in it: a
      // vetoed rung earns nothing from `onFieldBadge`, by construction.
      for (const r of [...ref, ...van, ...over])
        if (vetoed(r)) expect(onFieldBadge(r.baseline, r.stamp)).toBeNull();
      // Section 6's claim, as an assertion rather than only as a report: a
      // rung that has shipped fires on exactly the clubs its candidate names.
      // Skipped per key while the badge is undefined, which is the state the
      // study was written in and the state it has to keep passing in.
      for (const s of SHIPPED) {
        if (BADGE_BY_KEY[s.key] === undefined) continue;
        for (const a of arms)
          for (const r of a.rows)
            expect(r.badges.includes(s.key), `${s.key} on seed of ${a.label}`).toBe(
              s.candidate(r),
            );
      }
    },
    3_600_000,
  );
});

/** Shared aggregation helpers for the bot study test files. */
import type { GameResult } from "./harness";

export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

export const pctl = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

export const pearson = (xs: number[], ys: number[]): number => {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
};

export const f1 = (x: number): string => x.toFixed(1);
export const f2 = (x: number): string => x.toFixed(2);
export const pct = (x: number): string => `${(100 * x).toFixed(0)}%`;

/** The standard per-bot table row over raw engine-scored results.
 * `total` overrides the scored value per game (Study 3 rescoring). */
export function tableRow(
  name: string,
  rs: GameResult[],
  total: (r: GameResult) => number = (r) => r.total,
): string {
  const t = rs.map(total);
  return [
    name.padEnd(20),
    f1(mean(t)).padStart(6),
    f1(pctl(t, 0.5)).padStart(6),
    f1(pctl(t, 0.9)).padStart(6),
    f1(Math.max(...t)).padStart(6),
    f1(mean(rs.map((r) => r.war))).padStart(6),
    `${f1(mean(rs.map((r) => r.spend)))}/${f1(mean(rs.map((r) => r.budget)))}`.padStart(12),
    pct(mean(rs.map((r) => (r.tax > 0 ? 1 : 0)))).padStart(5),
    f1(mean(rs.map((r) => r.tax))).padStart(5),
    pct(mean(t.map((x) => (x >= 162 ? 1 : 0)))).padStart(6),
  ].join(" ");
}

export const TABLE_HEADER = [
  "bot".padEnd(20),
  "mean".padStart(6),
  "med".padStart(6),
  "p90".padStart(6),
  "max".padStart(6),
  "WAR".padStart(6),
  "spend/bank".padStart(12),
  "bust".padStart(5),
  "tax".padStart(5),
  ">=162".padStart(6),
].join(" ");

/** The seed list every study shares (pairing across bots and arms). */
export function makeSeeds(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (123456789 + i * 2654435761) >>> 0);
}

/** Where the dream solve runs.
 *
 * `bestRoster` blocks the thread it runs on for its whole run — measured on
 * the ?endgame forge's 13-card Open Market solve: ~140ms on a desktop, ~770ms
 * at 4x CPU throttle (a mid-tier phone), ~1.65s at 8x. On the main thread
 * that window swallows every tap and every non-composited frame, which is
 * why the finale used to open behind a full-screen card. In a worker the
 * board keeps running: the signed man's 450ms thunk into his chair plays
 * out, and on all but the slowest devices the solve is done before it ends.
 *
 * One solve per completed season, so the worker is spawned per call and
 * terminated on the way out rather than kept warm. */
import { bestRoster, type BestClubOptions, type BestRoster } from "./bestroster";
import type { Card } from "./types";

export function solveBestRoster(
  cards: Card[],
  opts: BestClubOptions,
): Promise<BestRoster> {
  // The bot harness runs whole seasons in Node, which has no Worker — the same
  // environment check `finishGame` already makes for requestAnimationFrame.
  // There the solve is the only work on the thread and blocking it costs
  // nothing.
  if (typeof Worker !== "function")
    return Promise.resolve(bestRoster(cards, opts));
  const worker = new Worker(new URL("./solve.worker.ts", import.meta.url), {
    type: "module",
  });
  return new Promise<BestRoster>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<BestRoster>) => resolve(e.data);
    worker.onerror = (e) =>
      reject(new Error(`dream solve failed: ${e.message}`));
    worker.postMessage({ cards, opts });
  }).finally(() => worker.terminate());
}

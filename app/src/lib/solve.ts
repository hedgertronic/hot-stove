/** Where the dream solve runs.
 *
 * The solve is one `solveClub` per landing pool, and a season that used a
 * reroll or ⭐ Prime Time spends the whole pool budget: six independent
 * searches, each blocking the thread it runs on for its whole run. Measured
 * over 60 real Open Market games, main-thread: ~340ms mean on a desktop,
 * ~1.5s at 4x CPU throttle. That window used to swallow every tap and every
 * non-composited frame.
 *
 * The pools are independent by construction — `landingPools` enumerates them
 * and nothing crosses between them until `reduceBest` picks the winner — so
 * they go out to workers and come back to be reduced HERE, in ENUMERATION
 * order. The order is not cosmetic: `reduceBest` is first-wins on ties, so a
 * list assembled in completion order would resolve ties to a different club.
 * Results are placed by index, never pushed.
 *
 * Lanes rather than a worker per pool: the pool budget is six in all but a
 * long reroll chain, but nothing in the enumeration promises that, and a
 * phone asked for a dozen workers at once finishes no sooner than one asked
 * for four. One solve per completed season, so workers are spawned per pool
 * and terminated on the way out rather than kept warm. */
import {
  bestRoster,
  landingPools,
  reduceBest,
  type BestClubOptions,
  type BestRoster,
  type PoolTask,
} from "./bestroster";
import type { Card } from "./types";

function solveOne(
  cards: Card[],
  opts: BestClubOptions,
  task: PoolTask,
): Promise<BestRoster> {
  const worker = new Worker(new URL("./solve.worker.ts", import.meta.url), {
    type: "module",
  });
  return new Promise<BestRoster>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<BestRoster>) => resolve(e.data);
    worker.onerror = (e) => reject(new Error(`dream solve failed: ${e.message}`));
    worker.postMessage({ cards, opts, task });
  }).finally(() => worker.terminate());
}

export async function solveBestRoster(
  cards: Card[],
  opts: BestClubOptions,
): Promise<BestRoster> {
  // The bot harness runs whole seasons in Node, which has no Worker — the same
  // environment check `finishGame` already makes for requestAnimationFrame.
  // There the solve is the only work on the thread and blocking it costs
  // nothing.
  if (typeof Worker !== "function") return bestRoster(cards, opts);
  const tasks = landingPools(cards, opts);
  const results = new Array<BestRoster>(tasks.length);
  let next = 0;
  const lane = async (): Promise<void> => {
    while (next < tasks.length) {
      const i = next++;
      results[i] = await solveOne(cards, opts, tasks[i]);
    }
  };
  // One lane per core the browser admits to, minus the one this thread is on.
  // hardwareConcurrency is a hint and is absent on some browsers; four lanes
  // is the floor worth trying, and oversubscribing a small phone costs little
  // because the pools are the same size and all of them have to finish.
  const cores = navigator.hardwareConcurrency ?? 4;
  const lanes = Math.min(tasks.length, Math.max(2, cores - 1));
  const started = Date.now();
  await Promise.all(Array.from({ length: lanes }, lane));
  // Dev-only, and it is the seam's one honest number on a device this session
  // cannot drive: the browser reports its own solve rather than a harness
  // reporting it for them.
  if (import.meta.env.DEV)
    console.log(
      `[hot stove] dream solve ${Date.now() - started}ms · ${tasks.length} pools · ` +
        `${lanes} lanes · ${cores} cores`,
    );
  return reduceBest(results);
}

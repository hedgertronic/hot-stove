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
  signal: AbortSignal,
): Promise<BestRoster> {
  const worker = new Worker(new URL("./solve.worker.ts", import.meta.url), {
    type: "module",
  });
  let stop = (): void => {};
  return new Promise<BestRoster>((resolve, reject) => {
    // A quit lands here: the worker is solving a season that no longer exists,
    // and it holds the whole card pool while it does. Terminating drops the
    // thread and everything it was carrying, rather than leaving all six pools
    // running to completion against the home screen the player just reached.
    stop = () => {
      worker.terminate();
      reject(signal.reason);
    };
    signal.addEventListener("abort", stop, { once: true });
    worker.onmessage = (e: MessageEvent<BestRoster>) => resolve(e.data);
    worker.onerror = (e) => reject(new Error(`dream solve failed: ${e.message}`));
    worker.postMessage({ cards, opts, task });
  }).finally(() => {
    // The signal outlives this solve — it belongs to the Game — so the
    // listener has to come off with the worker it was holding.
    signal.removeEventListener("abort", stop);
    worker.terminate();
  });
}

export async function solveBestRoster(
  cards: Card[],
  opts: BestClubOptions,
  signal: AbortSignal,
): Promise<BestRoster> {
  // The bot harness runs whole seasons in Node, which has no Worker — the same
  // environment check `finishGame` already makes for requestAnimationFrame.
  // There the solve is the only work on the thread and blocking it costs
  // nothing.
  if (typeof Worker !== "function") return bestRoster(cards, opts);
  const tasks = landingPools(cards, opts);
  const results = new Array<BestRoster>(tasks.length);
  // One controller for both ways this fan-out ends early — the player quits,
  // or a pool fails and the rest are answering a question nobody will read.
  // The Game's own signal feeds it rather than being passed down directly, so
  // a lane failure can stop its peers without reaching back into the Game.
  const stop = new AbortController();
  const relay = (): void => stop.abort(signal.reason);
  signal.addEventListener("abort", relay, { once: true });
  // A quit taken during `finishGame`'s frames aborts the Game's signal before
  // this listener exists, and an already-aborted signal fires no event.
  if (signal.aborted) relay();
  let next = 0;
  const lane = async (): Promise<void> => {
    // Checked per pool, not just per solve: a quit taken while lane 1 is on
    // its second pool must not start a third.
    while (!stop.signal.aborted && next < tasks.length) {
      const i = next++;
      results[i] = await solveOne(cards, opts, tasks[i], stop.signal);
    }
  };
  // One lane per core the browser admits to, minus the one this thread is on.
  // hardwareConcurrency is a hint and is absent on some browsers; four lanes
  // is the floor worth trying, and oversubscribing a small phone costs little
  // because the pools are the same size and all of them have to finish.
  const cores = navigator.hardwareConcurrency ?? 4;
  const lanes = Math.min(tasks.length, Math.max(2, cores - 1));
  const started = Date.now();
  try {
    await Promise.all(Array.from({ length: lanes }, lane));
    // Dev-only, and it is the seam's one honest number on a device this
    // session cannot drive: the browser reports its own solve rather than a
    // harness reporting it for them.
    if (import.meta.env.DEV)
      console.log(
        `[hot stove] dream solve ${Date.now() - started}ms · ${tasks.length} pools · ` +
          `${lanes} lanes · ${cores} cores`,
      );
    return reduceBest(results);
  } catch (e) {
    // Stop the peers first: `Promise.all` rejects on the first failure but
    // leaves the other lanes pulling pools off the queue, and their answers
    // are already worthless.
    stop.abort(e);
    // A quit is not a failure — there is nothing to salvage, and re-solving a
    // discarded season on the main thread is the freeze this file exists to
    // avoid.
    if (signal.aborted) throw e;
    // Everything else — a worker the page is not allowed to spawn, a chunk
    // that 404s, a throw inside the solver — falls back to the main thread,
    // and the fall is deliberate. `best` reaching the finale as null is not a
    // slower finale, it is a WRONG one: no dream club, no ceiling, zero
    // scouting hits, and the badges that read them silently withheld. A
    // freeze is the cheaper failure.
    console.warn("hot stove: dream solve fell back to the main thread", e);
    return bestRoster(cards, opts);
  } finally {
    // The Game's signal outlives this solve; the relay must not outlive it.
    signal.removeEventListener("abort", relay);
  }
}

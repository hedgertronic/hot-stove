/** One pool of the dream solve, off the main thread. One message in (the
 * cards the season landed on, the solver's options, and which pool to solve),
 * one message out (that pool's best club).
 *
 * `solvePool` is pure over plain data — bestroster.ts imports only
 * ./eligibility and ./scoring, touches no DOM and loads nothing — which is
 * what makes this module a wrapper and nothing more. The cards arrive
 * structured-cloned, so the club that comes back holds copies of the card
 * players; every consumer compares those by id/team/year, never by identity.
 *
 * No error handling here on purpose: a throw inside the solve surfaces as the
 * worker's error event, which `solve.ts` turns into a rejected promise, which
 * lands in the same catch in `finishGame` that already answers a solve that
 * could not run. */
import { solvePool, type BestClubOptions, type PoolTask } from "./bestroster";
import type { Card } from "./types";

self.onmessage = (
  e: MessageEvent<{ cards: Card[]; opts: BestClubOptions; task: PoolTask }>,
) => {
  self.postMessage(solvePool(e.data.cards, e.data.opts, e.data.task));
};

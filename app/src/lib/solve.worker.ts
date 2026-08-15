/** The dream solve, off the main thread. One message in (the cards the season
 * landed on plus the solver's options), one message out (the BestRoster).
 *
 * `bestRoster` is pure over plain data — it imports only ./eligibility and
 * ./scoring, touches no DOM and loads nothing — which is what makes this
 * module a wrapper and nothing more. The cards arrive structured-cloned, so
 * the club that comes back holds copies of the card players; every consumer
 * compares those by id/team/year, never by identity.
 *
 * No error handling here on purpose: a throw inside the solve surfaces as the
 * worker's error event, which `solve.ts` turns into a rejected promise, which
 * lands in the same catch in `finishGame` that already answers a solve that
 * could not run. */
import { bestRoster, type BestClubOptions } from "./bestroster";
import type { Card } from "./types";

self.onmessage = (e: MessageEvent<{ cards: Card[]; opts: BestClubOptions }>) => {
  self.postMessage(bestRoster(e.data.cards, e.data.opts));
};

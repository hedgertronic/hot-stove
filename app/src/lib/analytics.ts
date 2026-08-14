/** GA4 analytics for Hot Stove.
 *
 * Every event the game sends to Google Analytics flows through `track()` in
 * this module. Nothing else calls `window.gtag` directly. That single entry
 * point is what makes the three suppression guards unconditional: no caller
 * has to remember to check them, and no future event can slip past them.
 *
 * The measurement ID G-4HLN28H3S4 belongs to Hot Stove's dedicated GA4
 * property. The game still answers on two hosts: hotstove.io, the canonical
 * home where it sits at the root path, and hedgertronic.com/games/hot-stove/,
 * the original mount. The separate property keeps its traffic and game events
 * distinct from the hedgertronic.com homepage; use HOSTNAME when you need to
 * distinguish the two game mounts inside Hot Stove reporting.
 *
 * No code here reads the path. Sending events from a second host needs no
 * change in this module: the gtag config in index.html leaves cookie_domain
 * at its default ("auto"), which derives the cookie scope from whichever
 * registrable domain is serving the page.
 *
 * The gtag script is loaded by index.html via the canonical Google snippet.
 * This module does NOT load it — if the script is missing (adblocker,
 * network error, vitest, any non-browser runner) `track()` is a no-op.
 * The guard is a `typeof` check on `window.gtag` at call time rather than a
 * flag set at import time, so a script that loads late is picked up on the
 * next event without any initialization step.
 *
 * THREE SUPPRESSION GUARDS — all three must pass for an event to fire:
 *
 *   (1) `window.gtag` is a function. Covers the vitest node environment (no
 *       `window` at all), jsdom runs that never load the script, adblockers,
 *       and any future server-side rendering path. Nothing here can throw in
 *       those contexts because guard (1) short-circuits before any browser
 *       API is touched.
 *
 *   (2) The page hostname is not localhost or 127.0.0.1. `npm run dev` binds
 *       to localhost, and events from a dev session would count as real
 *       traffic in the GA4 property. Suppressing at the hostname level means
 *       the guard holds even if the script loads from the network during
 *       local development (which it can, over plain http to a phone on the
 *       same LAN via the Vite host flag).
 *
 *   (3) The URL does not carry `?lab`. That query param activates the
 *       dev-only component gallery (App.svelte gates it behind
 *       import.meta.env.DEV, so a production `?lab` just renders the game).
 *       Analytics have no business running inside a UI test harness, and
 *       keeping the production guard means a dev-built LAN session testing
 *       the lab on a phone stays untracked too.
 */

/** Minimal gtag shape. Declared inline so there is no dependency on
 * @types/gtag.js, which carries the full four-overload signature and is a
 * separate npm package. Only the `"event"` call form is used here; the rest
 * of the surface (config, consent, etc.) is handled by the inline snippet in
 * index.html and needs no TypeScript visibility. */
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Send a GA4 event, or do nothing when any suppression guard is active.
 *
 * `event` must follow GA4 naming conventions: lowercase snake_case, at most
 * 40 characters. `params` accepts the three GA4-legal primitive types. Do
 * not pass user-identifying values — no session IDs, no free-text inputs,
 * nothing that constitutes personal data under GDPR or CCPA. */
export function track(
  event: string,
  params?: Record<string, string | number | boolean>,
): void {
  // Guard (1): window absent (node/vitest) or gtag not loaded (adblocker).
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;

  // Guard (2): local dev server — localhost and 127.0.0.1 both suppress.
  // The try/catch is defense against any environment where `location` is
  // syntactically present but throws on access (sandboxed iframes, etc.).
  try {
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "") return;
  } catch {
    return; // inaccessible location → treat as suppressed
  }

  // Guard (3): ?lab gallery route (DEV-gated component showcase in App.svelte).
  try {
    if (new URLSearchParams(location.search).has("lab")) return;
  } catch {
    /* location.search inaccessible — already caught by guard (2) above */
  }

  window.gtag("event", event, params);
}

/** Hand-rolled FLIP for the brand lockup's trip between the home masthead
 * and the in-game header — the one element both screens share, so it is the
 * thing that can carry continuity across the swap.
 *
 * Why not a real shared-element crossfade (two live copies, svelte
 * crossfade): an out-transition defers the outgoing BRANCH's teardown, and
 * the home screen and the game screen are if/else siblings in normal flow —
 * both alive at once means both laid out at once, the game board rendering
 * below a lingering home screen. So the outgoing side instead stashes its
 * lockup's rect at the moment of the switch (the DOM is about to go), and
 * the incoming side plays one flight from that rect to its own.
 *
 * WAAPI rather than a CSS class because the from-transform is computed per
 * flight — and that is also why the reduced-motion gate is by hand:
 * app.css's global animation kill reaches CSS animations, not
 * element.animate().
 *
 * The stash is consumed exactly once and cleared: a header mounted with no
 * stored rect (a reload straight into a saved game) simply appears, which
 * is the correct entrance for a screen nothing traveled to. */

let stash: { rect: DOMRect; duration: number } | null = null;

/** Called by the OUTGOING screen in the same handler that flips screens,
 * while its lockup is still in the DOM. Null is fine — the flight is
 * skipped. The duration belongs to the trip, not the lander: the boot→home
 * glide is a once-per-load arrival and takes it slower than the play/quit
 * hops. */
export function stashBrandRect(
  el: Element | null | undefined,
  duration = 420,
): void {
  stash = el ? { rect: el.getBoundingClientRect(), duration } : null;
}

/** Svelte action for the INCOMING screen's lockup wrapper. Scale is uniform
 * off the heights (the two cuts share their aspect: same wordmark, same
 * mark-beside-text shape), centers matched so the flight reads as the same
 * object shrinking into the header rather than a corner-pinned zoom. */
export function brandfly(node: HTMLElement) {
  const trip = stash;
  stash = null;
  if (!trip) return;
  if (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  const from = trip.rect;
  const to = node.getBoundingClientRect();
  if (to.height === 0) return;
  const s = from.height / to.height;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  node.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
      { transform: "translate(0px, 0px) scale(1)" },
    ],
    // composite "add": the flight rides ON TOP of whatever transform the
    // element already wears — the header lockup's optical seat is a base
    // translateY, and an animation that ends at `none` overrode it for the
    // flight's whole life and then snapped the lockup down 2px on finish.
    // Additive, the deltas above are exact too: `to` was measured with the
    // base applied, so adding (from − to) starts the flight on the pixel.
    {
      duration: trip.duration,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      composite: "add",
    },
  );
}

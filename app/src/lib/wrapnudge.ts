/** Optical rebalance for a market row's wrapping `.mid` column.
 *
 * THE GEOMETRY. A row's mid column is a wrapping flex box: the name (or the
 * career sheet's year label) on line one, award pills on line two when they
 * don't fit beside it. Line one is TYPE: its line box carries leading above
 * the caps — at 14px/16px in bundled Nunito (ascent 1.011em, cap 0.705em)
 * that's (16/14−1.364)/2 + (1.011−0.705) = 0.196em ≈ 2.7px of invisible air
 * between the box's top edge and the ink. Line two is BOXES: bordered pills
 * whose ink ends flush at their bottom edge, no leading at all. Flex
 * centering centers the box, so the ink block sits half the cap overhead low
 * and the card reads as more whitespace above the name than below the pills.
 *
 * On one line the imbalance doesn't exist — the pills share the name's line
 * and the name's own descent overhang balances its cap leading — which is
 * why this cannot be a static declaration: CSS has no wrapped-flex selector,
 * so the action watches and nudges only while the column is actually two
 * lines. Transform, not margin: paint-only, so the row's height and the
 * sibling columns never move.
 *
 * WRAP DETECTION IS A THRESHOLD, not an inequality. In a center-aligned flex
 * row, two same-line items of different heights already have different
 * offsetTops — an award chip shorter than the name's line box sits a pixel or
 * two below its top, and a bare `>` read that centering jitter as a second
 * line and nudged a one-line row (the Cabrera bug: the only row on the card
 * with an award chip was the only row riding high). A real wrap displaces a
 * child by at least the first line's height; half of it cleanly separates the
 * two regimes (jitter ≤ a few px, wrap ≥ ~16px).
 *
 * `px` is half the cap overhead of line one's type, derived per call site
 * (1.4px for the market's 14px name, 1.3px for the career sheet's 13px year
 * label).
 *
 * `freeze` (market rows only) pins the column's width while a confirm pill
 * replaces the .right column. The confirm and the chip column it displaces
 * are different widths, so the swap used to hand .mid extra room and snap
 * wrapped pills back to one line for exactly the life of the pill. The action
 * records the column's free width on every reflow while unfrozen (observer
 * callbacks run post-layout, so the stored number is always the width of the
 * position BEFORE the swap) and clamps `max-inline-size` to it while frozen —
 * the wrap can't reflow, and the row keeps the pre-tap shape under the tap. */
export function wrapnudge(
  node: HTMLElement,
  opts: number | { px: number; freeze?: boolean },
) {
  // Fractional width, rounded UP. offsetWidth rounds down, and clamping a
  // 200.4px column to 200px re-wrapped one-line rows under the confirm — the
  // clamp exists to stop reflow, so it must never be narrower than the truth.
  const measure = () => Math.ceil(node.getBoundingClientRect().width);
  let freeWidth = measure();
  let frozen = false;
  const apply = (o: number | { px: number; freeze?: boolean }) => {
    const px = typeof o === "number" ? o : o.px;
    frozen = typeof o === "number" ? false : o.freeze === true;
    // Never re-measure at freeze time: the confirm has already swapped into
    // the DOM when the action's update runs, so offsetWidth here would read
    // the post-swap layout. The stored width is the honest one.
    node.style.maxInlineSize = frozen ? `${freeWidth}px` : "";
    const kids = [...node.children] as HTMLElement[];
    const wrapped =
      kids.length > 1 &&
      kids.some((k) => k.offsetTop > kids[0].offsetTop + kids[0].offsetHeight / 2);
    // The nudge rides the DEVICE-pixel grid, not the CSS one. The award pills
    // on line two are pinned to whole-pixel heights precisely so their 1.5px
    // rings never straddle a split device pixel (AwardPill's sizing note), and
    // a raw 1.3/1.4px translate puts every ring edge back onto one — the top
    // arc of a wrapped pill shaved thin, only while the nudge is live, which
    // is what "sometimes the badge is cut off in the career sheet" was.
    // Rounding to the nearest device pixel keeps the optics (within half a
    // device pixel of the derived value) and keeps the edges whole.
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    const snapped = Math.round(px * dpr) / dpr;
    node.style.transform = wrapped ? `translateY(${-snapped}px)` : "";
  };
  // The observer hears every reflow that can change the wrap: the viewport,
  // the confirm pill swapping the right column in and out, badges appearing
  // on a mode toggle. Observing the node itself is enough — any of those
  // changes this box's inline or block size. Guarded because the vitest DOM
  // has no ResizeObserver — there the nudge is a one-shot no-op (offsetTop
  // is 0 everywhere in a non-laying-out DOM), which is also the honest
  // degradation in any ancient browser: no observer, no nudge, the row
  // simply keeps the pre-fix centering.
  apply(opts);
  if (typeof ResizeObserver === "undefined") return;
  const ro = new ResizeObserver(() => {
    if (!frozen) freeWidth = measure();
    apply(opts);
  });
  ro.observe(node);
  return {
    update(next: number | { px: number; freeze?: boolean }) {
      opts = next;
      apply(next);
    },
    destroy: () => ro.disconnect(),
  };
}

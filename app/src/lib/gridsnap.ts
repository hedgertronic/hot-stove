/** Pin a chip's border-box top to the DEVICE-pixel grid.
 *
 * THE PROBLEM IT CLOSES. The small award pills wear a 1.5px ring on a
 * whole-pixel box (AwardPill's sizing note), but a whole-pixel BOX only
 * guarantees a whole-pixel EDGE if the box's offset is whole too — and the
 * gameplay rows can't promise that. A market row wears a 2.5px border, flex
 * centering leaves half-pixel remainders (a 15px pill centered in a 16px
 * name line sits 0.5px down; a 33px mid column centered in a row leaves
 * another half), and the halves stack differently per row. At 2× a half CSS
 * pixel is one whole device pixel and nothing shows. At 3× it is 1.5 device
 * pixels: the ring's top arc is painted across a split pixel and fades —
 * "the outline looks thin/cut off", on phones, only in gameplay. The finale
 * lays its chips on integral offsets, which is why it never showed there.
 *
 * THE FIX is wrapnudge's own doctrine, applied to the chip instead of the
 * nudge: measure where layout actually put the box, and translate by the
 * sub-device-pixel remainder (≤ half a device pixel, invisible as motion) so
 * the border box's top edge lands on the grid. Paint-only — transform moves
 * no layout, so rows, wraps and reserved heights are untouched.
 *
 * Scroll never invalidates a snap: scroll offsets rest on device pixels, and
 * a device-integral shift preserves a device-integral edge. What CAN move a
 * settled chip is a reflow (viewport resize, a wrap forming or clearing), so
 * the action re-measures on its own resize observation and on window resize.
 * The measurement subtracts its own applied transform first — the observed
 * rect includes it, and compounding would walk the chip downward.
 *
 * `active` gates the work: the finale's full-size chips already sit clean
 * and stay untouched — the action is a no-op there rather than a risk.
 *
 * The shift rides the CSS `translate` PROPERTY, not `transform`, so a
 * consumer that owns its transform (press dips, step-asides) keeps it —
 * `translate` composes instead of overriding, and nothing here transitions
 * it, so a snap lands instantly rather than animating.
 *
 * AwardPill is the ONLY consumer, by measurement rather than accident: the
 * corner/sheet pills wore this briefly and were reverted the same day —
 * their rings paint symmetric at natural offsets (owner screenshots, both
 * engines), so snapping bought nothing there while its late re-applies
 * were VISIBLE as micro-jumps, and a re-measure landing during a pill's
 * armed/pushed transform absorbed the transform into a persistent wrong
 * offset.
 *
 * NEVER MEASURE MID-FLIGHT. A rect read under an active transform — the
 * node's own or any ancestor's — is a transient position, and a snap
 * computed from it is wrong at rest: the rail peek's FLIP morph mounts
 * its award pills inside a scaling panel, and the snap taken mid-scale
 * corrected itself at animationend as a visible one-device-pixel hop
 * (down on one-line panels, up on wrapped ones — rounding direction).
 * So apply() skips while any element up the chain is transformed. (The
 * snap's own shift rides the `translate` property, which computed
 * `transform` does not include — the guard never sees its own work.)
 *
 * THE SKIP HAS NO SETTLE EVENT UNDER A SVELTE TRANSITION. The re-apply
 * listeners below hear CSS animations and transitions only — Svelte 5 runs
 * `transition:` css-functions through the Web Animations API, which fires
 * NEITHER event, and holds computed transform ≠ none (`fill: 'forwards'`)
 * until Svelte cancels it. So a pill mounted inside a Svelte transition
 * skips every apply during the flight and then snaps whenever some
 * UNRELATED transitionend happens by — a translate landing on a pill
 * already visibly at rest, i.e. a hop, direction set by the fractional
 * phase of the pill's resting top (the rail-peek jitter: up from the top
 * row, down from `.low`). Such hosts must not use gridsnap at all — the
 * rail peek wears the finale's FULL-SIZE pills, which never snap — and
 * accept the bounded half-device-pixel ring asymmetry instead, the same
 * trade the corner/sheet pills already made. */
export function gridsnap(node: HTMLElement, active: boolean) {
  if (!active || typeof window === "undefined") return;
  let applied = 0;
  const inFlight = () => {
    for (let el: Element | null = node; el && el !== document.body; el = el.parentElement) {
      if (getComputedStyle(el).transform !== "none") return true;
    }
    return false;
  };
  const apply = () => {
    if (inFlight()) return;
    const dpr = window.devicePixelRatio || 1;
    // Layout's own top: the rect minus what this action already added.
    const top = node.getBoundingClientRect().top - applied;
    const want = Math.round(top * dpr) / dpr - top;
    if (want !== applied) {
      applied = want;
      node.style.translate = applied ? `0 ${applied}px` : "";
    }
  };
  // A ResizeObserver delivers an initial post-layout notification on observe,
  // so it is also the mount measurement. Guarded for the vitest DOM, where
  // the honest degradation is no snap — the pre-fix rendering, not an error.
  if (typeof ResizeObserver === "undefined") return;
  const ro = new ResizeObserver(apply);
  ro.observe(node);
  // The body too: the node's own RO fires only when the NODE resizes, but a
  // snap goes stale whenever anything above the pill reflows — and almost
  // every vertical reflow (fonts settling, async data landing, a wrap
  // forming) changes the body's height. apply() is a few float ops and
  // idempotent (it subtracts its own applied offset — verified stable
  // across repeated calls), so re-running it on every body resize is noise-
  // priced insurance.
  ro.observe(document.body);
  window.addEventListener("resize", apply);
  // Entrance animations are the stale-maker the RO pair cannot see: market
  // rows ride in on `.after`'s fadeup (a translateY animation), so the
  // initial observation measures a TRANSIENT position, and the animation's
  // end resizes nothing — the wrong snap simply stayed (measured live:
  // every gameplay pill steady at 0.417 device px off grid at 3×, the
  // "second-row badges sit low" report). Both events bubble to window, so
  // one listener pair re-measures at exactly the moments layout settles,
  // with no polling. apply() is idempotent; extra firings are noise-priced.
  window.addEventListener("animationend", apply, true);
  window.addEventListener("transitionend", apply, true);
  // Fonts are the settle that stales MOST snaps, and a font strut shift
  // does not always move the body's total height — so fonts.ready gets its
  // own explicit re-apply (measured: a 0.25px settle above a snapped pill
  // reads phase 0.5 at dpr 2, the owner's exact Safari reading that
  // surfaced this), plus one more a frame later for layout that commits
  // behind it. For chips mounted after fonts (i.e. most gameplay rows) the
  // promise is already resolved and this is one harmless extra pass. A
  // reflow that changes neither the node nor the body's size can still
  // stale a snap silently; the bound stays half a device pixel of ring
  // asymmetry — the pre-snap rendering — never anything worse.
  let raf = 0;
  document.fonts?.ready.then(() => {
    if (!node.isConnected) return;
    apply();
    raf = requestAnimationFrame(apply);
  });
  return {
    destroy() {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      window.removeEventListener("animationend", apply, true);
      window.removeEventListener("transitionend", apply, true);
      cancelAnimationFrame(raf);
    },
  };
}

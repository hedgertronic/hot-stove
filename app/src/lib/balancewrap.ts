/** BALANCED WRAPPING FOR A CHIP ROW — `text-wrap: balance`, but for flex.
 *
 * A centered flex-wrap row fills each line greedily, so a thirteen-chip band
 * can land 6/6/1: full rows and then one orphan. Centering softens the orphan
 * but cannot remove it. Text gets `text-wrap: balance` for exactly this;
 * flex has no equivalent, so this action supplies one, tuned for chip bands:
 * scan the narrower boxes that keep (or grow by at most one) the line count
 * and take the one with the evenest per-line CHIP COUNTS (13 → 5/4/4).
 * Text-balance's own rule — minimize width at fixed line count — is not
 * enough here, because chip widths are wildly mixed (a long-named badge is
 * five flags wide) and the width-minimal fill can still strand one flag
 * alone under a six-flag line. Counting is what the eye does on a chip
 * band, so counts are what the score reads.
 *
 * The wrap is SIMULATED from the chips' measured widths rather than probed by
 * relayout: one narrowing pass over the widths mirrors flexbox's greedy
 * algorithm, so the binary search costs no reflows. Absolutely positioned
 * children (an open PillSlot reveal panel) hold no seat in a flex line and
 * are skipped. Under jsdom every width reads 0, one line, and the action is
 * a no-op — the trophy tests keep exercising markup, not layout.
 *
 * The narrowed box is also PillSlot's panel fence (`max-width: 100%` resolves
 * against it), so panels clamp to the balanced width instead of the sheet's.
 * That is at worst a slightly narrower panel, never an overflowing one.
 *
 * `key` re-balances when the row's membership changes (the filter lens); a
 * ResizeObserver on the PARENT re-balances when the sheet does. Observing the
 * node itself would loop — setting its max-inline-size is a resize. */
export function balancewrap(node: HTMLElement, key: unknown) {
  const apply = () => {
    node.style.maxInlineSize = "";
    const cs = getComputedStyle(node);
    const gap = parseFloat(cs.columnGap) || 0;
    // The row's actual flex items: a display:contents child (the finale's
    // .brags / .stamps group divs) has no box of its own — its children are
    // the items, so it expands in place. Absolutely positioned children (an
    // open PillSlot reveal) hold no seat in a flex line and are skipped.
    // offsetWidth, not getBoundingClientRect: the finale's chips thunk in
    // through a scale transform and a rect read mid-animation is scaled;
    // offsetWidth is the layout width regardless.
    const items: HTMLElement[] = [];
    const collect = (parent: HTMLElement) => {
      for (const k of parent.children) {
        if (!(k instanceof HTMLElement)) continue;
        const s = getComputedStyle(k);
        if (s.display === "contents") {
          collect(k);
          continue;
        }
        if (s.position === "absolute") continue;
        items.push(k);
      }
    };
    collect(node);
    const widths = items.map((k) => k.offsetWidth);
    const avail = node.clientWidth;
    if (widths.length < 2 || avail <= 0) return;
    /** Chips per line under greedy fill at a given content width — flexbox's
     * own algorithm. The half-pixel slack forgives fractional chip widths
     * that layout would still seat (getBoundingClientRect is fractional, the
     * box is not). */
    const fill = (w: number): number[] => {
      const counts: number[] = [];
      let run = 0;
      let n = 0;
      for (const cw of widths) {
        const next = run === 0 ? cw : run + gap + cw;
        if (n !== 0 && next > w + 0.5) {
          counts.push(n);
          n = 1;
          run = cw;
        } else {
          n += 1;
          run = next;
        }
      }
      counts.push(n);
      return counts;
    };
    const natural = fill(avail);
    if (natural.length <= 1) return;
    // Scan the widths that keep the natural line count and pick the evenest
    // COUNT distribution: maximize the thinnest line, then minimize the
    // spread, then take the narrowest box. Minimal-width alone (text-balance's
    // rule) is not enough here — chip widths are wildly mixed (a long-named
    // badge is five flags wide), so the width-minimal fill can still strand
    // one flag alone under a six-flag line. Counting is what the eye does on
    // a chip band, so counts are what the score reads.
    // One extra line is admissible when it is what evens the counts: an
    // 8-line band growing to 9 is invisible, a stranded orphan is not.
    const score = (c: number[]): [number, number, number] => [
      Math.min(...c),
      -(Math.max(...c) - Math.min(...c)),
      -c.length,
    ];
    const better = (a: number[], b: number[]): boolean => {
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] > b[i];
      }
      // Full tie: the later (narrower) candidate wins — tightest box.
      return true;
    };
    let bestW = avail;
    let best = score(natural);
    for (let w = avail - 4; w >= Math.max(...widths); w -= 4) {
      const c = fill(w);
      if (c.length > natural.length + 1) continue;
      const s = score(c);
      if (better(s, best)) {
        best = s;
        bestW = w;
      }
    }
    if (bestW >= avail) return;
    node.style.maxInlineSize = `${Math.ceil(bestW)}px`;
    // The narrowed box re-centers in the band the row used to fill.
    node.style.marginInline = "auto";
    // TRUST BUT VERIFY: the simulation runs on integer offsetWidths while
    // flex fills with fractional sizes, so accumulated rounding across a long
    // line can make the real wrap at bestW differ from the scored one. A
    // one-chip difference is cosmetic; blowing past the admitted line count
    // is the one outcome worse than doing nothing, so read the real line
    // count back (offsetTop is layout truth, immune to the entrance
    // transforms) and stand down if the narrowed box overshot. One reflow
    // read, no loop — the reset is terminal for this apply.
    const realLines = new Set(items.map((k) => k.offsetTop)).size;
    if (realLines > natural.length + 1) {
      node.style.maxInlineSize = "";
      node.style.marginInline = "";
    }
  };

  // jsdom: no ResizeObserver, zero-width children — wrapnudge's rule applies
  // here too, a synchronous one-shot no-op keeps the tests on markup.
  if (typeof ResizeObserver === "undefined") {
    apply();
    return;
  }

  let raf = requestAnimationFrame(apply);
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(apply);
  };
  const ro = new ResizeObserver(schedule);
  if (node.parentElement) ro.observe(node.parentElement);

  return {
    update(next: unknown) {
      key = next;
      schedule();
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
    },
  };
}

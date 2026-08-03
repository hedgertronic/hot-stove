<script lang="ts">
  import type { BadgeDef } from "../lib/badges";
  import BadgePill from "./BadgePill.svelte";

  /** A tappable badge and the trigger it reveals — the one implementation the
   * finale row and the trophy case both render, for the same reason they share
   * BadgePill: a badge behaves the way the player first learned it behaves.
   *
   * The reveal is a floating panel that OVERLAYS the row. Nothing moves when a
   * badge opens: not the pill that was tapped, not its row-mates, not the
   * buttons below. That is the whole reason it is absolutely positioned rather
   * than a block in the flow — an in-flow reveal has to take a row's worth of
   * space from somewhere, and every way of taking it rearranges pills the
   * player is still looking at.
   *
   * CONTRACT WITH THE CALLER: the element that holds these slots must be
   * `position: relative`. It is the panel's containing block, which makes it
   * both the coordinate origin and the horizontal fence — the panel is capped
   * at `100%` of it and clamped inside it, so a panel can never widen a
   * scrolling sheet or push a horizontal scrollbar onto one.
   *
   * Only an EARNED badge is ever given a slot. A locked one has nothing to
   * open, and a trigger string is the reward for earning the badge — the case
   * renders those as a bare, inert BadgePill. */
  interface Props {
    badge: BadgeDef;
    /** Times earned; the pill marks it above one. */
    count?: number;
    /** The finale's thunk-in entrance. */
    animate?: boolean;
    /** Forwarded to BadgePill: seconds before this pill's entrance plays. */
    delay?: number;
    /** First time this badge has ever been earned. Finale only. */
    fresh?: boolean;
    open: boolean;
    /** Flips this badge open, and flips it shut again. The dismissal paths
     * below only ever fire it while the panel is open, so for them it reads as
     * "close". */
    ontoggle: () => void;
  }
  let {
    badge,
    count = 1,
    animate = false,
    delay = 0,
    fresh = false,
    open,
    ontoggle,
  }: Props = $props();

  /** Per-instance, so the trophy case opened over a finale cannot point two
   * `aria-controls` at one id. */
  const howId = $props.id();

  /** Pill edge to panel edge. The arrow is 9 tall but sits against the panel's
   * PADDING box, so 2 of those 9 fall inside the border and only 7 stick out —
   * which leaves a 7px standoff between the pill and the arrow's tip. At 9 the
   * standoff was 2 and the join read as pinched. Measured at 7.00px in both
   * orientations. */
  const GAP = 14;
  /** How close the arrow may get to a corner before the radius eats it. */
  const NOTCH_INSET = 14;
  /** Breathing room kept between the panel and the edge it could fall past. */
  const EDGE = 6;

  let btnEl: HTMLButtonElement | undefined = $state();
  let panelEl: HTMLElement | undefined = $state();

  interface Placement {
    /** Row-local coordinates, in px. */
    left: number;
    top: number;
    /** Arrow position along the panel's own top (or bottom) edge. */
    notch: number;
    /** Flipped to sit above the pill because there was no room below. */
    above: boolean;
  }
  let place = $state<Placement | null>(null);

  /** The nearest ancestor that scrolls, so the flip decision is made against
   * the box the player can actually see. In the trophy case that is the sheet;
   * on the finale there is none and the window is the viewport. */
  function scrollBox(el: HTMLElement): HTMLElement | null {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if (o === "auto" || o === "scroll") return p;
    }
    return null;
  }

  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

  /** Measured, not guessed. The panel is sized by its own text and the row is
   * whatever width the layout gave it, so the only way to point an arrow at a
   * pill is to read both back after they exist. */
  function measure(): void {
    if (!open || !btnEl || !panelEl) return;
    const row = btnEl.parentElement;
    if (!row) return;
    const rowR = row.getBoundingClientRect();
    const btnR = btnEl.getBoundingClientRect();
    const pw = panelEl.offsetWidth;
    const ph = panelEl.offsetHeight;

    // The pill's center in the row's own coordinates — the point the arrow has
    // to land on.
    const center = btnR.left + btnR.width / 2 - rowR.left;
    // Center the panel under it, then shove it back inside the row. A pill hard
    // against either margin gets a panel flush with that margin and an arrow
    // that slides along the panel's edge to keep pointing at the pill.
    const left = clamp(center - pw / 2, 0, Math.max(0, rowR.width - pw));

    const boxR = scrollBox(btnEl)?.getBoundingClientRect();
    const viewTop = Math.max(0, boxR?.top ?? 0);
    const viewBottom = Math.min(window.innerHeight, boxR?.bottom ?? window.innerHeight);
    // Below by default; above only when below would run past the visible box
    // AND above actually fits. Decided once, at open — re-deciding on scroll
    // would make the panel hop while the player is reading it.
    const above =
      btnR.bottom + GAP + ph + EDGE > viewBottom && btnR.top - GAP - ph - EDGE > viewTop;

    place = {
      left,
      top: above ? btnR.top - rowR.top - ph - GAP : btnR.bottom - rowR.top + GAP,
      notch: clamp(center - left, NOTCH_INSET, Math.max(NOTCH_INSET, pw - NOTCH_INSET)),
      above,
    };
  }

  /* Placement, and the two ways out. Every listener is added only while this
   * panel is open and removed the moment it shuts.
   *
   * Dismissal is `pointerdown` rather than `click`, for two reasons. It cannot
   * swallow the tap: the handler only observes — never preventDefault, never
   * stopPropagation — so whatever sits underneath still receives its own click,
   * the draft board's pick-commit path included. And it cannot self-close: the
   * tap that opened the panel spent its pointerdown before this listener
   * existed, so there is no race to guard against.
   *
   * Escape is caught in the CAPTURE phase and stopped there. Sheet closes the
   * whole modal on a bubbling Escape, and one key should not dismiss two
   * things — the panel is the innermost thing open, so it goes first and alone.
   * Nothing else in the app listens for Escape. */
  $effect(() => {
    if (!open) {
      place = null;
      return;
    }
    measure();
    const onResize = () => measure();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (t && (btnEl?.contains(t) || panelEl?.contains(t))) return;
      ontoggle();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      ontoggle();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  });
</script>

<!-- A bare wrapper: no box of its own, the pill's geometry unchanged, and the
     hit target exactly the pill. -->
<button
  class="slot"
  bind:this={btnEl}
  aria-expanded={open}
  aria-controls={open ? howId : undefined}
  onclick={ontoggle}
>
  <BadgePill {badge} {count} {animate} {delay} {fresh} />
</button>
{#if open}
  <!-- A sibling of the button, not a child of it: the panel's containing block
       has to be the ROW, so that clamping it inside the row is the same thing
       as keeping it inside the sheet. Rendered hidden and revealed once
       measured, so it is never seen at an unplaced position. -->
  <p
    class="how"
    class:above={place?.above}
    class:placed={place !== null}
    id={howId}
    bind:this={panelEl}
    style:left="{place?.left ?? 0}px"
    style:top="{place?.top ?? 0}px"
    style:--notch="{place?.notch ?? 0}px"
  >
    <span class="notch" aria-hidden="true"></span>{badge.how}
  </p>
{/if}

<style>
  .slot {
    display: flex;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
    border-radius: 999px;
  }
  .slot:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  /* The trigger, in the player's own words — as wide as the words are and no
     wider, so a six-word trigger gets a six-word panel.
     `max-width: 100%` is measured against the row, which is the fence that
     keeps a floating panel from widening a scrolling sheet: a box with
     `overflow-y: auto` computes the other axis to `auto` as well, so anything
     reaching past the sheet's padding box earns a horizontal scrollbar.
     Ink on card and nothing else — no shadow. A floating panel is exactly
     where a shadow is conventional and exactly where this game doesn't have
     one; it lifts off the page by covering what is under it, which the opaque
     card fill and the ink outline already do. */
  .how {
    position: absolute;
    /* Over the pills and the rows below, under the rail pin (10) and the
       sheets (50). It only ever has to beat its own siblings. */
    z-index: 5;
    /* Placed by measurement; unplaced means not yet shown. */
    visibility: hidden;
    margin: 0;
    width: max-content;
    max-width: min(280px, 100%);
    border: 2px solid var(--line);
    border-radius: 10px;
    background: var(--card);
    color: var(--ink);
    font-size: 11.5px;
    font-weight: 700;
    line-height: 1.4;
    padding: 8px 11px;
    /* Centered, and it survives the whole table because the box is sized to its
       own text: anything up to the 280px cap gets a one-line panel with nothing
       to center, and anything past it fills every line but the last, so the two
       ragged edges stay short. Measured across the shortest trigger (19 chars,
       one line) and the longest (216 chars, six lines).
       `text-wrap: balance` was tried here and removed: with a `max-content` box
       Chrome produces byte-identical layout with it, without it, and with
       `pretty`, so it was dead CSS pretending to do the work the cap does. */
    text-align: center;
  }
  .how.placed {
    visibility: visible;
  }
  /* The connector: an ink triangle with a card triangle sitting just inside it,
     so what shows is a 2px chevron that continues the panel's own outline and
     then a card fill that erases the panel border behind it. One unbroken ink
     line, no seam where the arrow meets the box.
     (The first attempt was a rotated square with two inked sides. It cannot
     work: the square's fill cuts the panel's border on a diagonal while its
     ink edges stop half-way through that border, which leaves a visible step
     on both sides of the arrow. It is the shape the owner called awkward.)
     The inner triangle's offset is derived, not tuned: see the rule below for
     the one line of trigonometry that ties it to the border weight it has to
     match. The shape is reviewable in the lab's own gallery.
     `--notch` is the measured distance from the panel's left edge to the pill's
     center, so the arrow keeps pointing at the pill even when the panel has
     been shoved sideways to stay inside the row. */
  .notch,
  .notch::after {
    position: absolute;
    width: 0;
    height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
  }
  .notch {
    left: var(--notch);
    margin-left: -7px;
    bottom: 100%;
    border-bottom: 9px solid var(--line);
  }
  .notch::after {
    content: "";
    left: -7px;
    /* 9px of triangle plus the 3.26px offset that makes the visible ink match
       the panel's 2px border. A vertical offset is NOT the outline's
       thickness: the slanted edge runs (-7, 9), so its normal is (9, 7)/√130
       and a shift of d projects onto it as t = d·7/√130 = 0.614·d. The 1px
       offset this started with painted a 0.61px hairline against a 2px box,
       which is what read as a thin, tacked-on arrow.
       Inverted for the offset a given weight needs: d = t / 0.614, so 2px
       wants 3.26. In general, for a half-width w and a height h,
       t = d·w/√(w²+h²) — equivalently d = t/cos α with α = atan(h/w) — so the
       offset is a function of the arrow's proportions and must be recomputed
       with them: a 16×8 arrow needs a different number for the same weight. */
    bottom: -12.26px;
    border-bottom: 9px solid var(--card);
  }
  /* Flipped above the pill: the same pair, mirrored onto the underside. */
  .how.above .notch {
    bottom: auto;
    top: 100%;
    border-bottom: 0;
    border-top: 9px solid var(--line);
  }
  .how.above .notch::after {
    bottom: auto;
    /* Mirrored, same derivation as the downward arrow above. */
    top: -12.26px;
    border-bottom: 0;
    border-top: 9px solid var(--card);
  }
</style>

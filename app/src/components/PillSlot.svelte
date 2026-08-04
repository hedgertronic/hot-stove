<script lang="ts">
  import type { Rarity } from "../lib/badges";
  import Pill from "./Pill.svelte";

  /** A TAPPABLE CHIP AND THE PANEL IT REVEALS — one implementation for badges
   * and countries, on the finale and in the trophy case alike.
   *
   * This used to be two files with one algorithm in them. `Passport.svelte`
   * carried a comment saying its panel was "BadgeSlot's, re-implemented rather
   * than imported", and the two copies were identical down to the 12.26px notch
   * offset and the capture-phase Escape. Two inches apart on the same sheet,
   * that is a drift waiting to happen. It is one copy now, and which chip is
   * inside it is a prop.
   *
   * THE REVEAL OVERLAYS THE ROW. Nothing moves when a chip opens: not the chip
   * that was tapped, not its row-mates, not the buttons below. That is the whole
   * reason the panel is absolutely positioned rather than a block in the flow —
   * an in-flow reveal has to take a row's worth of space from somewhere, and
   * every way of taking it rearranges chips the player is still looking at.
   *
   * CONTRACT WITH THE CALLER: the element that holds these slots must be
   * `position: relative`. It is the panel's containing block, which makes it
   * both the coordinate origin and the horizontal fence — the panel is capped at
   * `100%` of it and clamped inside it, so a panel can never widen a scrolling
   * sheet or push a horizontal scrollbar onto one. The trophy case's `.bandrow`
   * and the finale's `.stamps` and `.brags` all satisfy it.
   *
   * Only a COLLECTED chip is ever given a slot. A locked badge has nothing to
   * open, and a trigger string is the reward for earning it — the case renders
   * those as a bare, inert `Pill`. */
  interface Props {
    /** What the panel says. The one sentence this chip is worth a tap for. */
    reveal: string;
    /** Overrides what the button announces. A stamp needs one, because every
     * visible part of it — the NEW chip, the flag, the count — is drawn rather
     * than written, and a flag is not a name. A badge needs none: its pill is
     * already text, and an `aria-label` here would REPLACE it. */
    ariaLabel?: string;
    open: boolean;
    /** Flips this chip open, and flips it shut again. The dismissal paths below
     * only ever fire it while the panel is open, so for them it reads as
     * "close". */
    ontoggle: () => void;

    /* ---- forwarded to Pill; see there for what each one draws ---- */
    emoji?: string;
    label?: string;
    count?: number | null;
    rarity?: Rarity | null;
    shape?: "round" | "rect";
    fresh?: boolean;
    animate?: boolean;
    delay?: number;
    title?: string;
  }
  let {
    reveal,
    ariaLabel,
    open,
    ontoggle,
    emoji,
    label,
    count = null,
    rarity = null,
    shape = "round",
    fresh = false,
    animate = false,
    delay = 0,
    title,
  }: Props = $props();

  /** Per-instance, so a trophy case opened over a finale cannot point two
   * `aria-controls` at one id. */
  const howId = $props.id();

  /** Chip edge to panel edge. The arrow is 9 tall but sits against the panel's
   * PADDING box, so 2 of those 9 fall inside the border and only 7 stick out —
   * which leaves a 7px standoff between the chip and the arrow's tip. At 9 the
   * standoff was 2 and the join read as pinched. */
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
    /** Flipped to sit above the chip because there was no room below. */
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
   * chip is to read both back after they exist. */
  function measure(): void {
    if (!open || !btnEl || !panelEl) return;
    const row = btnEl.parentElement;
    if (!row) return;
    const rowR = row.getBoundingClientRect();
    const btnR = btnEl.getBoundingClientRect();
    const pw = panelEl.offsetWidth;
    const ph = panelEl.offsetHeight;

    // The chip's center in the row's own coordinates — the point the arrow has
    // to land on.
    const center = btnR.left + btnR.width / 2 - rowR.left;
    // Center the panel under it, then shove it back inside the row. A chip hard
    // against either margin gets a panel flush with that margin and an arrow
    // that slides along the panel's edge to keep pointing at the chip.
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
   * existed, so there is no race to guard against. It is also what makes chips
   * mutually exclusive across kinds — a tap on a stamp is outside a badge's
   * panel, and a tap on a badge is outside a stamp's.
   *
   * Escape is caught in the CAPTURE phase and stopped there. Sheet closes the
   * whole modal on a bubbling Escape, and one key should not dismiss two
   * things — the panel is the innermost thing open, so it goes first and
   * alone. */
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

<!-- A bare wrapper: no box of its own, the chip's geometry unchanged, and the
     hit target exactly the chip. -->
<button
  class="slot {shape}"
  bind:this={btnEl}
  aria-label={ariaLabel}
  aria-expanded={open}
  aria-controls={open ? howId : undefined}
  {title}
  onclick={ontoggle}
>
  <!-- The tooltip rides the BUTTON, not the chip inside it: the control is what
       a pointer is over, and a `title` on the span would be a second hoverable
       box inside the first. -->
  <Pill {emoji} {label} {count} {rarity} {shape} {fresh} {animate} {delay} />
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
    <span class="notch" aria-hidden="true"></span>{reveal}
  </p>
{/if}

<style>
  .slot {
    display: flex;
    padding: 0;
    border: 0;
    background: none;
    /* A button takes the platform's own font rather than the page's, so without
       this a chip dropped out of Nunito into system sans the moment it became
       one. */
    font: inherit;
    color: inherit;
    cursor: pointer;
  }
  /* The focus ring takes the SHAPE OF THE CHIP INSIDE IT. A capsule outline
     around a rectangle is the giveaway that a wrapper stopped matching its
     contents, and with both kinds now in one band it would be visible on the
     same row as the shape it fails to match. */
  .slot.round {
    border-radius: 999px;
  }
  .slot.rect {
    border-radius: 4px;
  }
  .slot:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  /* The reveal, in the player's own words — as wide as the words are and no
     wider, so a six-word trigger gets a six-word panel.
     `max-width: 100%` is measured against the row, which is the fence that
     keeps a floating panel from widening a scrolling sheet: a box with
     `overflow-y: auto` computes the other axis to `auto` as well, so anything
     reaching past the sheet's padding box earns a horizontal scrollbar.
     Ink on card and nothing else — no shadow. A floating panel is exactly
     where a shadow is conventional and exactly where this game doesn't have
     one; it lifts off the page by covering what is under it, which the opaque
     card fill and the ink outline already do.
     Sentence case and its own type, because it is a sentence — a chip's small
     caps are a mark, and a mark's rules do not survive being read as prose. */
  .how {
    position: absolute;
    /* Over the chips and the rows below, under the rail pin (10) and the
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
    letter-spacing: normal;
    text-transform: none;
    padding: 8px 11px;
    /* Centered, and it survives the whole table because the box is sized to its
       own text: anything up to the 280px cap gets a one-line panel with nothing
       to center, and anything past it fills every line but the last, so the two
       ragged edges stay short. Measured across the shortest trigger (19 chars,
       one line) and the longest (216 chars, six lines). */
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
     `--notch` is the measured distance from the panel's left edge to the chip's
     center, so the arrow keeps pointing at the chip even when the panel has
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
  /* Flipped above the chip: the same pair, mirrored onto the underside. */
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

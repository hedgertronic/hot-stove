<script lang="ts">
  import { sortAwards, warTier } from "../lib/format";
  import { wrapnudge } from "../lib/wrapnudge";
  import AwardPill from "./AwardPill.svelte";

  /** THE MARKET ROW'S CONTENT, presentational and inert — position tag, name +
   * hardware column, and the price/WAR (or hint) column. The same lift RailSeat
   * and PowerupPill got, and for the same reason: the help sheet used to draw
   * this row by hand, and both of its real drift bugs (a stale pit fill, a
   * hint arrow with no margin) lived in that copy. Now the sheet and the
   * market render the one component and cannot disagree.
   *
   * NO interactive elements here. PlayerList's `.prow-btn` button wraps this
   * whole row and owns the tap; the help sheet embeds it as a diagram. That is
   * the split that keeps the component liftable — the presentation has no
   * game wiring to drag along.
   *
   * The ROW ITSELF (cardstock, border, padding, the four state washes) stays
   * with each caller: PlayerList's `.prow` carries the live states (dead /
   * swap / prime / hg) because their predicates are game logic, and the help
   * sheet's specimen `.prow` carries only the two looks it teaches. What this
   * component owns about state is the `dead` prop's CONTENT treatment — the
   * grayscale/desaturate filters on its own parts — so a dead row's innards
   * gray identically on both surfaces.
   *
   * The root is `display: contents`: the pos/mid/right spans must be flex
   * items of the caller's row for the market's geometry to hold, and a
   * wrapper box would seat them one level too deep. The `.dead` class rides
   * the root and reaches the parts through scoped descendant rules — a
   * DOM-tree relationship, which `display: contents` does not disturb. */
  interface Props {
    /** Position tag text ("SP", "C/IF/OF" — shrinks past 5 chars). */
    pos: string;
    /** Pitcher tag: filled to the ring's own gray. */
    pit?: boolean;
    name: string;
    /** Award codes, unsorted — sorted here so both surfaces share the order.
     * Pass undefined when the mode hides hardware (Eye Test). */
    awards?: string[];
    /** World Baseball Classic medal: 2 = champion 🥇, 1 = finalist 🥈. */
    wbc?: number;
    /** Formatted price ("$12.5M") and its tint tier ("cheap" | "spendy" | ""). */
    priceText: string;
    priceTier?: string;
    /** WAR value, or null when the mode hides the chip (Eye Test). */
    war?: number | null;
    /** The orange instruction that replaces the value column while a pick is
     * in flight: the slot picker's or Trade Deadline's. */
    hint?: "slot" | "trade" | null;
    /** The rail sits above this row at every width (the help sheet), so the
     * hint keeps ↑ and never swaps to the wide layout's ←. */
    hintAbove?: boolean;
    /** The host row wears the armed orange wash (a ⭐/🔁/🏠 target row):
     * the hint pill flips to cardstock fill so it doesn't melt into it. */
    washed?: boolean;
    /** A confirm pill has replaced the value column — render no right column
     * at all (the caller draws the pill as the button's sibling). */
    rightHidden?: boolean;
    /** wrapnudge freeze: pin the mid column's width while a confirm or hint
     * has swapped out the right column. */
    freeze?: boolean;
    /** The row is dead (seat taken): this component grays its own parts; the
     * caller washes the row box. */
    dead?: boolean;
  }
  let {
    pos,
    pit = false,
    name,
    awards,
    wbc,
    priceText,
    priceTier = "",
    war = null,
    hint = null,
    hintAbove = false,
    washed = false,
    rightHidden = false,
    freeze = false,
    dead = false,
  }: Props = $props();
</script>

<span class="mrow" class:dead>
  <span class="pos chipbox" class:pit class:long={pos.length > 5}
    ><span class="chiplbl">{pos}</span></span
  >
  <!-- wrapnudge: when the pills wrap under the name, the ink block is
       re-centered by half the name line's cap overhead (1.4px = half of
       0.199em at 14px — see lib/wrapnudge.ts for the derivation). -->
  <span class="mid" use:wrapnudge={{ px: 1.4, freeze }}>
    <span class="nameline">
      <span class="pname">{name}</span>
    </span>
    <!-- WBC medal follows award chips, mirroring the Finale's own order:
         award pills → WS ring → pennant → WBC gold → WBC silver. The medal
         lives INSIDE .badges so the whole hardware group wraps as one unit
         at the pills' own 3px gap — as a sibling it took the mid flex's 6px
         column gap and wrapped to its own line while the pills stayed put.
         The span's render gate is hardware-or-medal, so a medal-only man
         still shows his. -->
    {#if (awards && awards.length > 0) || wbc}<span class="badges"
        >{#if awards}{#each sortAwards(awards) as a}<AwardPill code={a} small />{/each}{/if}{#if wbc}<span
            class="wbc"
            role="img"
            aria-label="World Baseball Classic {wbc === 2 ? 'champion' : 'finalist'}"
            >{wbc === 2 ? "🥇" : "🥈"}</span
          >{/if}</span
      >{/if}
  </span>
  {#if !rightHidden}
    <span class="right" class:lone={war === null}>
      {#if hint}
        <!-- The picker lives in the rail — point there, cardstock-terse. The
             rail sits ABOVE the market on the phone and LEFT of it at width,
             so the glyph is two spans and the 760px media tier picks the one
             that points at the actual rail (unless `hintAbove` pins ↑).
             Both labels are questions about the pick itself: the slot hint
             fires only when a man's eligible seats span more than one slot
             TYPE (engine.svelte.ts signFromCard — same-type seats
             auto-resolve), so "WHAT SLOT?" is literally the open question —
             and "slot", not "position", because FLEX is one of the choices
             and FLEX is a seat, not a position — and "WHO GOES?" is the
             armed 🔁 pill's own words. Both run 10 characters or fewer,
             narrower than the price column they replace, so neither can
             push a chip-heavy row to a second line (wrapnudge's freeze pins
             the mid column as the backstop). -->
        <span class="confirm hint" class:above={hintAbove} class:wash={washed}
          ><span class="ph" aria-hidden="true">↑</span><span class="wd" aria-hidden="true">←</span
          ><span class="chiplbl">{hint === "slot" ? "WHAT SLOT?" : "WHO GOES?"}</span></span
        >
      {:else}
        <span class="cost {priceTier}">{priceText}</span>
        {#if war !== null}<span class="warchip {warTier(war)}"
            >{war.toFixed(1)}<span class="unit">WAR</span></span
          >{/if}
      {/if}
    </span>
  {/if}
</span>

<style>
  /* The root has no box: the caller's row is the flex container and these
     parts are its items. */
  .mrow {
    display: contents;
  }
  /* Position is a filter cue, not the headline: a compact fixed-width tag so
     the left edge scans as a column. Pitchers flip to the filled gray — one
     subtle two-way split (arms vs bats), no rainbow. */
  /* The chip joins the chipbox recipe (markup class): pinned whole-pixel
     height with the label in a .chiplbl, so the trim branch seats the caps on
     center in both engines — the old grid-centered, padding-driven box rode
     the caps high on WebKit. 22px is the old 21.5px content height rounded to
     the recipe's whole-pixel rule. */
  .pos {
    width: 38px;
    --chip-h: 22px;
    border-radius: 7px;
    background: var(--card);
    color: var(--ink);
    border: 2px solid var(--line);
    font-weight: 800;
    font-size: 9.5px;
    letter-spacing: 0.03em;
    flex: none;
  }
  /* Filled INK, ring to match — the one-tone/no-halo rule unchanged, back in
     the ink voice at the owner's call (round eight: the gray fill read
     washed-out). The confirm pill made the same round trip; twins still. */
  .pos.pit {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--card);
  }
  /* Multi-group labels ("C/IF/OF") shrink to keep the fixed-width column. */
  .pos.long {
    font-size: 7.5px;
    letter-spacing: 0.01em;
  }
  /* Name and hardware share a line when they fit; the badges wrap to a second
     line when they don't (narrow phones). The name never shrinks to make room
     for pills — a name longer than the whole row still ellipsizes via the
     nameline's max-width. */
  /* Scoped as the ROOT'S OWN CHILD, not a bare `.mid` anywhere: the WAR
     ladder's middle rung is ALSO called `mid`, and Svelte's scope hash rides
     every element in this template — the WAR chip included — so a bare
     selector would still reach a mid-tier chip and turn it into a wrapping
     flex container. The child combinator is a DOM-tree relationship, which
     the contents root does not disturb. */
  .mrow > .mid {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 6px;
    min-width: 0;
    overflow: hidden;
  }
  .nameline {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
    max-width: 100%;
    min-width: 0;
  }
  .pname {
    font-weight: 800;
    font-size: 14px;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badges {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: none;
  }
  /* The medal rides inside .badges at the pills' own 3px gap. It sits under
     the name's 14px because a glyph reads at its whole box where type reads at
     its cap band, and line-height 1 keeps the emoji's taller line box from
     setting the row's height. */
  .wbc {
    font-size: 12px;
    line-height: 1;
    flex: none;
  }
  /* THE CHIP INSET RULE IS RETIRED, everywhere at once (this row, both prime
     pickers, SpecialRows, the rail, the finale squads): the chip stops at the
     row's FULL padding, exactly where bare type stops. One right edge for
     every row beats the box-against-box optic the inset used to serve. */
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
  }
  /* Eye Test gates the WAR chip off, leaving the price as bare rightmost
     text; the pinned height is the chip's, so the swap cannot change the
     row's. */
  .right.lone {
    min-height: 26.3px;
  }
  /* The chip is the rightmost item, so its right edge has to be consistent or
     the WAR column jitters as values vary. app.css's 42px min-inline-size is a
     floor, not a fixed width; 64px seats the widest values the market's
     visible-players filter passes, with the salary's own side room. Scoped
     here rather than in app.css: the global chip is shared by the finale, the
     rail and the career sheet, none of which need the market's column pin. */
  .right .warchip {
    min-inline-size: 64px;
  }
  /* Structural right-alignment (flex, not text-align) so every engine agrees. */
  .cost {
    display: inline-flex;
    justify-content: flex-end;
    font-weight: 800;
    font-size: 13px;
    white-space: nowrap;
    min-width: 56px;
  }
  .cost.cheap {
    color: var(--green);
  }
  .cost.spendy {
    color: var(--orange);
  }
  /* Pending pick: the next tap belongs to the rail, not this row — the pill
     goes orange (the rail hint's color) and points up at it. The .confirm
     base recipe lives in app.css. */
  .confirm.hint {
    background: var(--orange-2);
    border-color: var(--orange-8);
    color: var(--ink);
  }
  /* ON A WASHED ROW ONLY (the `washed` prop — a ⭐/🔁/🏠 target row wears
     the armed pills' own orange-2/orange-8 pair), the pill's orange-2 fill
     melted into the row's: border against border, no pill. Cardstock fill
     pops there; everywhere else the orange fill stays the hint's voice. */
  .hint.wash {
    background: var(--card);
  }
  /* The hint's arrow, one glyph per layout: ↑ while the rail rides above the
     market (phone), ← once the wide grid seats it to the left. Declared after
     the base so the wide block's swap wins on source order. `.above` pins ↑
     for surfaces where the rail sits above at every width (the help sheet). */
  .hint .wd {
    display: none;
  }
  /* Air between the arrow and its words — a real margin rather than a space
     character inside the label, which the chiplbl's cap trim can't measure
     and which read as no gap at all at this size. */
  .hint .ph,
  .hint .wd {
    margin-inline-end: 4px;
  }
  @media (min-width: 760px) {
    .hint:not(.above) .ph {
      display: none;
    }
    .hint:not(.above) .wd {
      display: inline;
    }
  }
  /* A dead row still whispers its tier: the identity bits (position tag,
     name, award pills) go monochrome, but the WAR chip and salary keep their
     hue — faded by the caller's row opacity and a mild desaturation — so a
     gold you can't reach still reads gold ("need Trade Deadline for him").
     Modes that hide a chip render nothing here, so nothing new leaks. */
  .dead > .pos,
  .dead > .mid {
    filter: grayscale(1);
  }
  .dead .warchip,
  .dead .cost {
    filter: saturate(0.7);
  }
  .dead .pos {
    background: transparent;
  }
  /* A dead pit tag STAYS INVERTED — an SP flipping to the outline family
     read as a different chip, not a dead one — but its fill drops from ink
     to the outline chips' own --line gray, ring to match, so the one gray
     the dead outline rings wear is the one gray this fill wears and the
     grayscale(1) above maps both to the same value. (Both halves are the
     owner's calls, round eight: first the gray-ink fill read as a second
     gray beside the outline chips; then the drained outline version read
     as not-an-SP.) Cream type on --line was the LIVE chip's own pairing
     before the ink round trip, so the dead contrast is a solved problem. */
  .dead .pos.pit {
    background: var(--line);
    border-color: var(--line);
    color: var(--card);
  }
</style>

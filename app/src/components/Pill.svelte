<script lang="ts">
  import type { Rarity } from "../lib/badges";

  /** THE ONE CHIP. Every small collectible mark in the game draws through this:
   * a badge on the finale, a badge in the trophy case, a country stamp on
   * either. They were two components with two copies of the rarity ladder, two
   * NEW chips and two entrance animations, and they sat inches apart in the
   * same band — which is exactly the arrangement that lets a rung recolored in
   * one place stop matching the same rung in the other.
   *
   * What varies between a badge and a stamp is described here as OPTIONS rather
   * than as separate files:
   *
   *   shape   — `round` is a 999px capsule, `rect` a 4px rectangle. This is the
   *             channel that tells the two kinds apart inside one band, which
   *             is what frees the fill to carry rarity for both. A country is
   *             not a badge and the two are read side by side, so the SHAPE is
   *             the distinction and it is deliberate, not decorative.
   *   emoji   — present or not. A badge's glyph, a country's flag, or nothing.
   *   label   — present or not. A badge's name; a country prints none, because
   *             thirty-nine spelled-out names is a list where a field of flags
   *             is a collection. A country the flag table does not know is the
   *             one stamp that prints text, and it does it by passing a label
   *             instead of an emoji.
   *   rarity  — the shared ladder, one register for both kinds. Null falls back
   *             to each shape's own untiered paper, and those two fallbacks
   *             differ on purpose; see the styles.
   *   count   — the number to print, or null for none. The THRESHOLD is the
   *             caller's: a badge marks repetition only above one, a stamp
   *             shows its men at one as readily as at four. Two different rules
   *             about what a blank means, so neither belongs in here.
   *
   * It draws a chip and nothing else. Whether it is tappable, what it reveals,
   * and what it announces are `PillSlot`'s. */
  interface Props {
    /** The glyph, when there is one. */
    emoji?: string;
    /** The name, when the chip prints one. */
    label?: string;
    /** Draw `? ? ?` in place of a name — the anonymous silhouette. Enough of a
     * hint to be worth wondering about, not enough to become an errand. */
    placeholder?: boolean;
    /** A string for screen readers only, in the chip's own reading order. What
     * a silhouette IS, which is drawn as an absence and has no text of its
     * own. */
    srLabel?: string;
    /** The number to print, or null for none. */
    count?: number | null;
    /** The shared rarity ladder's rung. Null wears untiered paper. */
    rarity?: Rarity | null;
    shape?: "round" | "rect";
    /** Not yet earned: a shape and a tier, faded, dashed, nameless or named. */
    locked?: boolean;
    /** First time this has ever been collected. Spends the NEW chip. */
    fresh?: boolean;
    /** The thunk-in entrance. A ceremony asks for it; a list does not. */
    animate?: boolean;
    /** Seconds to hold before the entrance plays. The ROW owns the order, so
     * the stagger arrives as a number rather than being read off a position —
     * a selector counting siblings breaks the moment an opened chip inserts its
     * panel into the same row. Ignored with `animate` false. */
    delay?: number;
    /** The pointer's tooltip. Absent on anything whose identity is withheld. */
    title?: string;
  }
  let {
    emoji,
    label,
    placeholder = false,
    srLabel,
    count = null,
    rarity = null,
    shape = "round",
    locked = false,
    fresh = false,
    animate = false,
    delay = 0,
    title,
  }: Props = $props();

  /* The legacy hook rides alongside the new one. `.brag` and `.stamp` are what
   * every surface and every test has always called these two shapes, and this
   * change is about where the code lives rather than about what it draws — so
   * the names that describe the RESULT outlive the split that used to produce
   * it. */
  const hook = $derived(shape === "rect" ? "stamp" : "brag");
</script>

<!-- Every visible part is its own element, and every gap between them is the
     flex `gap` below. The chip carries no markup whitespace at all: inside a
     flex container a run of text and a run of whitespace become one anonymous
     item, so a newline between two bare `{...}` tags renders as a real space
     that `gap` cannot see or control. Wrapping the glyph and the label makes
     each one an item, which is what puts the spacing entirely in CSS. -->
<span
  class="pill {hook} {rarity ?? ''}"
  class:locked
  class:animate
  class:withnew={fresh && !locked}
  style:animation-delay={animate && delay > 0 ? `${delay}s` : null}
  {title}
>{#if fresh && !locked}<span class="newchip">NEW</span>{/if}{#if emoji}<span
      class="ico">{emoji}</span
    >{/if}{#if placeholder}<span aria-hidden="true">? ? ?</span>{:else if label}<span
      class="name">{label}</span
    >{/if}{#if count !== null}<span class="count">×{count}</span>{/if}{#if srLabel}<span
      class="sr">{srLabel}</span
    >{/if}</span
>

<style>
  /* ONE PALE WASH ON AN INK BORDER, and one ladder for both shapes. Which hexes
     the rungs are is app.css's --rarity-fill / --rarity-line pair; this file
     spends that pair and decides only the geometry around it.
     The game runs two color registers and rarity lives entirely in this one:
     WAR tiers are the saturated solid chips (--war-*), collectibles are washes.
     A rare pill and an elite WAR chip can sit inches apart without either
     claiming the other's meaning.
     Green and pink are deliberately absent — green means "found on the dream
     team" and pink means the manager. A rarity ramp that spent either would
     make two unrelated things look related.
     Flex, so the spacing between the chip, the glyph and the label is one
     structural `gap` rather than a mix of margins and rendered markup spaces,
     and so `align-items` centers the parts for real instead of nudging them
     with `vertical-align`. */
  .pill {
    display: inline-flex;
    align-items: center;
    border-width: 2px;
    border-style: solid;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }
  /* ---- THE CAPSULE: a badge ----
     The ladder's pair spent on a 999px shape. Untiered it falls back to what
     the pill already was: the gray wash on the structural line. */
  .pill.brag {
    gap: 5px;
    border-color: var(--rarity-line, var(--line));
    border-radius: 999px;
    background: var(--rarity-fill, var(--gray-bg));
    /* app.css's optical centering rule: badge labels are all caps, so the cap
       band's center is the target, and 0.047 × 10.5 = 0.49px of it has to sit
       above the type rather than below. Split out of the 6px the pill already
       spent (3.25 + 2.75), so the pill's height is exactly what it was. The
       NEW chip rides the same content box, so correcting the pill re-centers
       the chip with it. */
    padding: 3.25px 12px 2.75px;
  }
  /* ---- THE RECTANGLE: a country ----
     A stamp, not a pill. A country wears a small radius because a country is
     not a badge and the two are read side by side in one band; the shape is
     what carries that, which is what frees the fill to carry rarity for both.
     ITS UNTIERED FALLBACK IS NOT THE CAPSULE'S, and the difference is load
     bearing. An untiered BADGE is a badge whose tier simply is not set, so it
     falls back to the pill's own gray wash. An untiered COUNTRY is a country
     the measured table does not know — a data regen adding a fortieth — and it
     must not look like a measured one, so it falls back to plain paper on a
     gray hairline in the quiet --muted-2, which is deliberately QUIETER than
     `common` rather than louder. Two fallbacks, two meanings. */
  .pill.stamp {
    gap: 4px;
    border-color: var(--rarity-line, var(--gray-ink));
    border-radius: 4px;
    background: var(--rarity-fill, var(--card));
    color: var(--rarity-ink, var(--muted-2));
    padding: 3px 7px;
  }
  /* A flag runs a little larger than the type it sits beside: an emoji set at
     the size of small caps reads as a smudge, and the flag is the only part of
     a stamp that has to be identifiable at a glance. Its own line-height, so a
     taller glyph cannot grow the stamp. */
  .pill.stamp .ico {
    font-size: 13px;
    line-height: 1;
  }
  /* When a chip opens with the NEW chip, the chip sits in an even well of paper
     rather than being pushed off the left edge — and "even" here is optical,
     not arithmetic. The pill's height leaves ~7px of paper above and below a
     chip this tall; 6px of padding against the 2px border puts 8px to its left,
     and that unequal pair is what reads as equal. A solid ink shape with a hard
     edge and no side bearing needs a little more clearance than a
     geometrically identical gap, the same reason optically centered type sits
     off the mathematical center. Matching the numbers exactly was tried and
     read as tight.
     The RIGHT side keeps the label's 12px, and that asymmetry is the point: the
     chip is a solid mass, the label is type that carries its own side bearing. */
  .pill.brag.withnew {
    padding-left: 6px;
  }
  /* The type half of LEGENDARY's inversion. The fill and the ring arrive with
     the ladder's pair like every other rung's; the gold TYPE is the part only
     an ink fill needs, so it stays with the shape that has one. No country is
     ever legendary — that rung is the top of a badge axis and a country is not
     an axis — so this is a capsule rule by nature as well as by selector. */
  .pill.brag.legendary {
    color: var(--yellow);
  }
  /* Locked: the tier fill fades back so the row still reads as a rarity band
     while the chip plainly has not been earned. Dashed is reserved for exactly
     this state — the anti-trophies wear a solid brick border precisely so the
     two never look alike. */
  .pill.locked {
    opacity: 0.45;
    border-style: dashed;
    color: var(--muted);
  }
  /* The one inverted pill keeps its own type color while locked. Every other
     rung fades muted type on a pale wash and stays legible; LEGENDARY fades it
     on an ink fill, where muted is close enough to the fill to erase the pill's
     contents rather than quiet them. No new color here — it is the tier's own
     token, held rather than overridden, the same fix the NEW chip needs for the
     same reason. */
  .pill.brag.legendary.locked {
    color: var(--yellow);
  }
  /* First-ever collection, drawn by app.css's `.newchip`. Both shapes have
     already spent their border and their fill on rarity, so an inset chip is
     the one channel either has left — which is why the two shared it even when
     they were two files.
     No animation of its own: the row staggers with `animation-delay` on the
     chip element, and a second animation on the same element would inherit that
     one delay and fight the deal-in.
     LEGENDARY is the one inverted pill — an ink chip on an ink fill is
     invisible, so the chip inverts with it. */
  .pill.brag.legendary .newchip {
    background: var(--yellow);
    color: var(--ink);
  }
  .count {
    opacity: 0.7;
  }
  /* Out of flow, so it is not a flex item: the screen-reader string sits in the
     chip's reading order without taking a seat in the row or a share of the
     gap. */
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* THE ENTRANCE, one keyframe for both shapes — the badge row and the stamp
     row are one continuous deal at the finale, so a stamp lands the way the
     pill before it did.
     An ANIMATION rather than a transition: a keyframe resolves `transform` back
     to `none`, where a transform sitting in the resting rule would make every
     chip its own containing block and re-origin the absolutely positioned panel
     it opens. */
  .animate {
    animation: thunk-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes thunk-in {
    from {
      opacity: 0;
      transform: scale(0.6);
    }
  }
  /* Reduced motion: chips are simply there — no thunk, no stagger. */
  @media (prefers-reduced-motion: reduce) {
    .animate {
      animation: none;
    }
  }
</style>

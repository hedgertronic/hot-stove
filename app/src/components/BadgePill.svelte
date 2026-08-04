<script lang="ts">
  import type { BadgeDef } from "../lib/badges";

  /** One badge, rendered the same on the finale and in the trophy case — the
   * pill a player sees the moment they earn it is the pill that shows up in
   * their case, so the two surfaces can never drift apart.
   *
   * `locked` draws the silhouette: the rarity fill and the pill shape survive,
   * the identity does not. That is the whole point — a locked slot says "an
   * ULTRA exists that you have not found" without pre-spending the surprise
   * the finale exists to deliver. */
  interface Props {
    badge: BadgeDef;
    /** Not yet earned: a shape and a tier, no emoji and no name. */
    locked?: boolean;
    /** Times earned. Only marked above one — on a collection surface the
     * signal is repetition, and existence is already carried by the tile. */
    count?: number;
    /** The finale's thunk-in entrance. The case is a list, not an event. */
    animate?: boolean;
    /** Seconds to hold before the thunk-in entrance plays. The finale's row
     * deals its pills left to right and the order is the ROW's business, so
     * the delay arrives as a number rather than being read off a position —
     * a selector counting siblings breaks the moment an opened badge inserts
     * its panel into the same row, and a wrapper carrying the index breaks
     * BadgeSlot's `btnEl.parentElement` walk to the row it measures against.
     * Ignored with `animate` false, where there is no animation to delay. */
    delay?: number;
    /** First time this badge has ever been earned. Finale only — in the case
     * every badge is already earned, so the flag would mark all of them. */
    fresh?: boolean;
  }
  let {
    badge,
    locked = false,
    count = 1,
    animate = false,
    fresh = false,
    delay = 0,
  }: Props = $props();
</script>

<!-- Every visible part is its own element, and every gap between them is the
     flex `gap` below. The pill carries no markup whitespace at all: inside a
     flex container a run of text and a run of whitespace become one anonymous
     item, so a newline between two bare `{...}` tags renders as a real space
     that `gap` cannot see or control. Wrapping the glyph and the label makes
     each one an item, which is what puts the spacing entirely in CSS. -->
<span
  class="brag {badge.rarity}"
  class:locked
  class:animate
  class:withnew={fresh && !locked}
  style:animation-delay={animate && delay > 0 ? `${delay}s` : null}
  title={locked ? undefined : badge.label}
>
  {#if locked && (badge.ironic || badge.secret)}
    <!-- The anonymous silhouette: glyph kept, name withheld — enough of a hint
         to be worth wondering about, not enough to become an errand. Which
         badges get it is data, not tier: `secret` marks the ones whose name
         would spend something (a discovery, an exact target, the peak of the
         ladder), and every anti-trophy is anonymous because a named 💀 reads
         as a thing to go do. The anti-trophies also stay in the brick band and
         out of the progress fraction, which is the rest of what keeps a 💀
         reading as a hazard sign rather than a target. -->
    <span class="ico">{badge.emoji}</span><span aria-hidden="true">? ? ?</span><span class="sr"
      >An undiscovered badge</span
    >
  {:else if locked}
    <!-- Glyph and name, never the `how`. A name is direction — "COOPERSTOWN
         CLASS" tells you there is a roster of the greats to go build — while
         the trigger behind it stays the reward for earning the badge. That is
         the default, and the branch above is the exception to it. -->
    <span class="ico">{badge.emoji}</span><span class="name">{badge.label}</span><span class="sr"
      >Not yet earned</span
    >
  {:else}
    <!-- Real text, not an icon or a color: "NEW" is read aloud by a screen
         reader in the pill's own reading order, so the cue costs no extra
         aria and survives a player who cannot see the contrast carrying it. -->
    {#if fresh}<span class="newchip">NEW</span>{/if}<span class="ico">{badge.emoji}</span><span
      class="name">{badge.label}</span
    >{#if count > 1}<span class="count">×{count}</span>{/if}
  {/if}
</span>

<style>
  /* One pale wash on an ink border, five rungs deep plus the inverted
     LEGENDARY rung. Which hexes those are is app.css's --rarity-fill /
     --rarity-line ladder, shared with the passport's stamps; the pill spends
     the pair in ONE declaration below and decides only its own shape.
     The game runs two color registers and rarity lives entirely in that one:
     WAR tiers are the saturated solid chips (--war-*), brag pills are washes.
     A rare pill and an elite WAR chip can sit inches apart without either
     claiming the other's meaning.

     Green and pink are deliberately absent — green means "found on the dream
     team" (.qrow.dreamhit) and pink means the manager (.skiprow). A rarity
     ramp that spent either would make two unrelated things look related.

     Flex, so the spacing between the chip, the glyph and the label is one
     structural `gap` rather than a mix of margins and rendered markup spaces,
     and so `align-items` centers the parts for real instead of nudging them
     with `vertical-align`. */
  .brag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    /* The ladder's pair, spent on the capsule. Untiered it falls back to what
       the pill already was: the gray wash on the structural line. */
    border: 2px solid var(--rarity-line, var(--line));
    border-radius: 999px;
    background: var(--rarity-fill, var(--gray-bg));
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    /* app.css's optical centering rule: badge labels are all caps, so the cap
       band's center is the target, and 0.047 × 10.5 = 0.49px of it has to sit
       above the type rather than below. Split out of the 6px the pill already
       spent (3.25 + 2.75), so the pill's height is exactly what it was. The
       NEW chip rides the same content box, so correcting the pill re-centers
       the chip with it. */
    padding: 3.25px 12px 2.75px;
    white-space: nowrap;
  }
  /* When a pill opens with the NEW chip, the chip sits in an even well of paper
     rather than being pushed off the left edge — and "even" here is optical,
     not arithmetic. The pill's height leaves ~7px of paper above and below a
     chip this tall; 6px of padding against the 2px border puts 8px to its left,
     and that unequal pair is what reads as equal. A solid ink shape with a hard
     edge and no side bearing needs a little more clearance than a
     geometrically identical gap, the same reason optically centered type sits
     off the mathematical center. Matching the numbers exactly was tried and
     read as tight.
     The RIGHT side keeps the label's 12px, and that asymmetry is the point: the
     chip is a solid mass, the label is type that carries its own side bearing.
     Matching those two numbers would not match the two gaps either. */
  .brag.withnew {
    padding-left: 6px;
  }
  .animate {
    animation: thunk-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  /* The type half of LEGENDARY's inversion. The fill and the ring arrive with
     the ladder's pair like every other rung's; the gold TYPE is the part only
     an ink fill needs, so it stays with the shape that has one. The
     anti-trophy's border is solid on purpose — dashed is how an UNEARNED badge
     reads, and a citation is something you actually got. */
  .brag.legendary {
    color: var(--yellow);
  }
  /* Locked: the tier fill fades back so the row still reads as a rarity band
     while the pill plainly has not been earned. Dashed is reserved for exactly
     this state — the anti-trophies wear a solid brick border precisely so the
     two never look alike. */
  .brag.locked {
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
  .brag.legendary.locked {
    color: var(--yellow);
  }
  /* First-ever earn, drawn by app.css's `.newchip` — the same chip a passport
     stamp spends, and the reason it is shared is that both shapes have already
     spent their border and their fill on rarity, so an inset chip is the one
     channel either has left.
     No animation of its own, either: the finale staggers the row with
     `animation-delay` on the pill element, and a second animation on the same
     element would inherit that one delay and fight the deal-in.
     LEGENDARY is the one inverted pill — an ink chip on an ink fill is
     invisible, so the chip inverts with it. */
  .brag.legendary .newchip {
    background: var(--yellow);
    color: var(--ink);
  }
  .count {
    opacity: 0.7;
  }
  /* Out of flow, so it is not a flex item: the screen-reader string sits in the
     pill's reading order without taking a seat in the row or a share of the
     gap. */
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @keyframes thunk-in {
    from {
      opacity: 0;
      transform: scale(0.6);
    }
  }
  /* Reduced motion: pills are simply there — no thunk, no stagger. */
  @media (prefers-reduced-motion: reduce) {
    .animate {
      animation: none;
    }
  }
</style>

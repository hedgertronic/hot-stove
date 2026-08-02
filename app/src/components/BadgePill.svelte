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
    /** First time this badge has ever been earned. Finale only — in the case
     * every badge is already earned, so the flag would mark all of them. */
    fresh?: boolean;
  }
  let { badge, locked = false, count = 1, animate = false, fresh = false }: Props = $props();
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
  title={locked ? undefined : badge.label}
>
  {#if locked && (badge.ironic || badge.secret)}
    <!-- A discovery and an anti-trophy both show their glyph and withhold their
         name: enough of a hint to be worth wondering about, not enough to
         become an errand. The anti-trophies stay in the brick band and out of
         the progress fraction, which is what keeps a 💀 reading as a hazard
         sign rather than a target. -->
    <span class="ico">{badge.emoji}</span><span aria-hidden="true">? ? ?</span><span class="sr"
      >An undiscovered badge</span
    >
  {:else if locked}
    <!-- Glyph and name, never the `how`. A name is direction — "MATCHED THE
         2016 CUBS" sends you to look up what they did — while the trigger
         behind it stays the reward for earning the badge. -->
    <span class="ico">{badge.emoji}</span><span class="name">{badge.label}</span><span class="sr"
      >Not yet earned</span
    >
  {:else}
    <!-- Real text, not an icon or a color: "NEW" is read aloud by a screen
         reader in the pill's own reading order, so the cue costs no extra
         aria and survives a player who cannot see the contrast carrying it. -->
    {#if fresh}<span class="fresh">NEW</span>{/if}<span class="ico">{badge.emoji}</span><span
      class="name">{badge.label}</span
    >{#if count > 1}<span class="count">×{count}</span>{/if}
  {/if}
</span>

<style>
  /* One pale wash on an ink border, five rungs deep plus the inverted legend.
     The game runs two color registers and rarity lives entirely in this one:
     WAR tiers are the saturated solid chips (--war-*), brag pills are washes.
     A rare pill and an elite WAR chip can sit inches apart without either
     claiming the other's meaning.

     Green and pink are deliberately absent — green means "found on the dream
     team" (.qrow.dreamhit) and pink means the manager (.skiprow). A rarity
     ramp that spent either would make two unrelated things look related.

     Flex, so the spacing between the chip, the glyph and the label is one
     structural `gap` rather than a mix of margins and rendered markup spaces,
     and so `align-items` centres the parts for real instead of nudging them
     with `vertical-align`. */
  .brag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--gray-bg);
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 3px 12px;
    white-space: nowrap;
  }
  /* When a pill opens with the NEW chip, its left inset matches the chip's own
     top and bottom inset — the chip sits in an even well of paper rather than
     being pushed off the left edge. The pill's height leaves 5.03px above and
     below a chip this tall, so 5px here puts all three within a hundredth of a
     pixel of each other.
     The RIGHT side keeps the label's 12px, and that asymmetry is the point: the
     chip is a solid ink shape with no side bearing, the label is type that
     carries its own. Matching the two numbers would not match the two gaps. */
  .brag.withnew {
    padding-left: 5px;
  }
  .animate {
    animation: thunk-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  /* The floor: paper on a gray hairline, a step below the ink the others get. */
  .brag.common {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
  }
  .brag.uncommon {
    background: var(--sky);
  }
  .brag.rare {
    background: var(--rare-violet);
  }
  /* Gold, and nothing else. The fill alone separates ultra from the washes
     below it — an inset ink ring on top only read as a heavier border. */
  .brag.ultra {
    background: var(--yellow);
  }
  /* Inverted from the entire ladder — ink fill, gold text, gold ring. Legend
     is not a deeper wash than ultra; it is the negative of one, which is what
     makes it read as "off the top" rather than "one more step up". */
  .brag.legend {
    background: var(--ink);
    color: var(--yellow);
    border-color: var(--yellow);
  }
  /* The anti-trophy: a brick wash, the pale-register echo of --war-neg, which
     already means "below replacement" everywhere else in the game. Solid
     border on purpose — dashed is how an UNEARNED badge reads, and these are
     earned. A citation, but a citation you actually got. */
  .brag.ironic {
    background: var(--brick-wash);
    border-color: var(--war-neg);
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
  /* First-ever earn. A filled chip rather than a glow or a ring: the pill
     already spends its border and its fill on rarity, and both are load-
     bearing — a gold ring around a new RARE would read as an ULTRA. An inset
     chip borrows no channel rarity is using.
     No animation of its own, either: the finale staggers the row with
     `animation-delay` on the pill element, and a second animation on the same
     element would inherit that one delay and fight the deal-in. */
  .fresh {
    border-radius: 999px;
    background: var(--ink);
    color: var(--card);
    font-size: 8.5px;
    letter-spacing: 0.1em;
    /* Its own line-height, not the page's 1.55: as a flex item the chip is a
       box, and an inherited factor would size that box off the paragraph
       rhythm rather than off the chip. 1.2 plus symmetric padding is the whole
       height, so the chip clears the pill's inner edge top and bottom. */
    line-height: 1.2;
    padding: 1px 5px;
  }
  /* Legend is the one inverted pill — an ink chip on an ink fill is invisible,
     so the chip inverts with it. */
  .brag.legend .fresh {
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

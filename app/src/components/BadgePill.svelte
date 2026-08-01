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
  }
  let { badge, locked = false, count = 1, animate = false }: Props = $props();
</script>

<span
  class="brag {badge.rarity}"
  class:locked
  class:animate
  title={locked ? undefined : badge.label}
>
  {#if locked}
    <span class="hidden" aria-hidden="true">?</span>
    <span class="sr">Not yet earned</span>
  {:else}
    {badge.emoji}
    {badge.label}{#if count > 1}<span class="count">×{count}</span>{/if}
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
     ramp that spent either would make two unrelated things look related. */
  .brag {
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--gray-bg);
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 3px 12px;
    white-space: nowrap;
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
  /* Gold plus an inset ink ring, so ultra reads as ultra even beside three
     other filled pills. */
  .brag.ultra {
    background: var(--yellow);
    box-shadow: inset 0 0 0 1px var(--ink);
  }
  /* Inverted from the entire ladder — ink fill, gold text, gold ring. Legend
     is not a deeper wash than ultra; it is the negative of one, which is what
     makes it read as "off the top" rather than "one more step up". */
  .brag.legend {
    background: var(--ink);
    color: var(--yellow);
    border-color: var(--yellow);
    box-shadow: inset 0 0 0 1px var(--ink);
  }
  /* The anti-trophy: a brick wash, the pale-register echo of --war-neg, which
     already means "below replacement" everywhere else in the game. Solid
     border on purpose — dashed is how an UNEARNED badge reads, and these are
     earned. A citation, but a citation you actually got. */
  .brag.ironic {
    background: var(--brick-wash);
    border-color: var(--war-neg);
  }
  /* Locked: the fill drops to a tint of its tier so the row still reads as a
     rarity band, and the identity is replaced by a single mark. */
  .brag.locked {
    opacity: 0.4;
    border-style: dashed;
    color: var(--muted);
    min-width: 44px;
    text-align: center;
  }
  .hidden {
    font-weight: 900;
  }
  .count {
    margin-left: 6px;
    opacity: 0.7;
  }
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

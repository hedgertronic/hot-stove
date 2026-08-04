<script lang="ts">
  import type { BadgeDef } from "../lib/badges";
  import PillSlot from "./PillSlot.svelte";

  /** A TAPPABLE BADGE. A thin resolver over `PillSlot`, the way `BadgePill` is
   * one over `Pill`: it turns a `BadgeDef` into a chip's options and a reveal
   * string, and owns nothing else.
   *
   * The panel, its measurement, its placement and the two ways out of it are
   * `PillSlot`'s, shared with the passport's stamps — the two used to be
   * separate implementations of one algorithm sitting inches apart on the same
   * sheet.
   *
   * A badge explains itself wherever it is met: the finale row and the trophy
   * case render this same slot, so a player never has to go find the case to
   * learn what they just earned.
   *
   * Only an EARNED badge is ever given a slot. A locked one has nothing to
   * open, and the trigger string is the reward for earning it — the case
   * renders those as a bare, inert `BadgePill`. */
  interface Props {
    badge: BadgeDef;
    /** Times earned; the chip marks it above one. */
    count?: number;
    /** The finale's thunk-in entrance. */
    animate?: boolean;
    /** Seconds before this chip's entrance plays. */
    delay?: number;
    /** First time this badge has ever been earned. Finale only. */
    fresh?: boolean;
    open: boolean;
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
</script>

<!-- No `ariaLabel`: a badge chip is already text, and an `aria-label` on the
     button would REPLACE the glyph, the name and the count with one string. A
     stamp needs one precisely because it has no text to replace. -->
<PillSlot
  reveal={badge.how}
  emoji={badge.emoji}
  label={badge.label}
  count={count > 1 ? count : null}
  rarity={badge.rarity}
  shape="round"
  {fresh}
  {animate}
  {delay}
  title={badge.name}
  {open}
  {ontoggle}
/>

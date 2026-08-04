<script lang="ts">
  import type { BadgeDef } from "../lib/badges";
  import Pill from "./Pill.svelte";

  /** ONE BADGE, as a chip. A thin resolver over `Pill`: it turns a `BadgeDef`
   * into the chip's options and owns nothing else.
   *
   * What lives here is the badge-shaped POLICY — which parts of a definition
   * reach the chip in which state, and what a badge means by a count — because
   * that policy is about badges and `Pill` is about chips. Everything visual
   * (the rarity ladder, the NEW chip, the silhouette's fade, the entrance) is
   * `Pill`'s, shared with the passport's stamps, so a rung recolored once is
   * recolored for both.
   *
   * The pill a player sees the moment they earn a badge is the pill that shows
   * up in their trophy case, which is why this is one component and not two. */
  interface Props {
    badge: BadgeDef;
    /** Not yet earned: a shape and a tier, no name or no glyph. */
    locked?: boolean;
    /** Times earned. */
    count?: number;
    /** The finale's thunk-in entrance. The case is a list, not an event. */
    animate?: boolean;
    /** Seconds to hold before the entrance plays. */
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

  /** The anonymous silhouette: glyph kept, name withheld. Which badges get it
   * is data, not tier — `secret` marks the ones whose name would spend
   * something (a discovery, an exact target, the peak of the ladder), and every
   * anti-trophy is anonymous because a named 💀 reads as a thing to go do. */
  const anonymous = $derived(locked && (badge.ironic === true || badge.secret === true));

  /** Only marked above one. On a collection surface the signal is REPETITION,
   * and existence is already carried by the chip being there at all. A stamp
   * reads its blank the opposite way, which is exactly why the threshold sits
   * in each caller rather than inside `Pill`. */
  const mark = $derived(!locked && count > 1 ? count : null);
</script>

<!-- A locked badge keeps its glyph and, unless it is anonymous, its name. A
     name is DIRECTION — "COOPERSTOWN CLASS" tells you there is a roster of the
     greats to go build — while the trigger behind it stays the reward for
     earning the badge, so `how` never reaches a locked chip. -->
<Pill
  emoji={badge.emoji}
  label={anonymous ? undefined : badge.label}
  placeholder={anonymous}
  srLabel={anonymous ? "An undiscovered badge" : locked ? "Not yet earned" : undefined}
  count={mark}
  rarity={badge.rarity}
  shape="round"
  {locked}
  fresh={fresh && !locked}
  {animate}
  {delay}
  title={locked ? undefined : badge.name}
/>

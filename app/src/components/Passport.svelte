<script lang="ts">
  import type { PassportItem } from "../lib/settings";
  import PillSlot from "./PillSlot.svelte";
  import { stampReveal, stampLabel } from "../lib/settings";

  /** A ROW OF COUNTRY STAMPS — the finale's passport.
   *
   * It draws stamps and nothing else. Which countries, in what order, with what
   * numbers on them and which are new are all decided by the caller and arrive
   * as `PassportItem`s; `settings.ts` builds the list and that shape is not this
   * component's business.
   *
   * THE STAMP ITSELF IS NO LONGER THIS FILE'S EITHER. A stamp is a `Pill` with
   * `shape="rect"` and its tap-to-reveal is `PillSlot` — the same two components
   * a badge draws through, so a country and a badge wear one rarity ladder, one
   * NEW chip and one entrance by construction rather than by two files agreeing.
   * This file used to carry its own copy of the reveal panel, identical to
   * BadgeSlot's down to the notch trigonometry; that copy is gone.
   *
   * WHAT IS LEFT HERE IS THE ROW: the box the panels are fenced inside, and the
   * "only one open at a time" rule. Both are genuinely a row's business — a
   * single slot cannot know that a sibling is open, so one `string | null` here
   * is the entire rule.
   *
   * THE TROPHY CASE DOES NOT USE THIS COMPONENT. Its stamps sit inline among the
   * badges of their own rarity band, so the band's row is their row and
   * `TrophyModal` renders `PillSlot`s directly into it. This is the finale's
   * row, where the passport is a strip of its own and needs a box to be fenced
   * in. One stamp, two rows, no second stamp implementation. */
  interface Props {
    stamps: PassportItem[];
    label: string;
    /** Deal the row in, one stamp at a time, instead of showing it whole. The
     * finale asks for it — the stamps are the last beat of a ceremony, and a
     * row that arrives all at once is an appearance rather than a beat. */
    animate?: boolean;
    /** Seconds between stamps as the row deals, and the same number the finale
     * spends between badge pills — the two rows are one deal, so they run at
     * one cadence. Ignored with `animate` false. */
    step?: number;
  }
  let { stamps, label, animate = false, step = 0.12 }: Props = $props();

  /** The one open stamp, by country. A badge panel and a stamp panel still
   * cannot both be open: each closes on a `pointerdown` outside itself, and a
   * tap on the other one is outside. */
  let open = $state<string | null>(null);
</script>

<!-- The row wraps and centers like a badge band, so the passport shares the
     rhythm of whatever column it sits in rather than reading as a different
     screen bolted on.
     A group rather than a list: a stamp is a button, and `role="listitem"` on a
     button REPLACES the button — assistive tech would announce a list of items
     that cannot be pressed. Wrapping each button in a listitem is worse still;
     it puts a box between the button and this row, which is the box the panel
     is measured against. -->
<div class="stamps" role="group" aria-label={label}>
  {#each stamps as s, i (s.country)}
    <PillSlot
      reveal={stampReveal(s)}
      ariaLabel={stampLabel(s)}
      emoji={s.flag || undefined}
      label={s.flag ? undefined : s.country}
      count={s.count !== null && s.count > 1 ? s.count : null}
      rarity={s.rarity}
      shape="rect"
      fresh={s.fresh}
      {animate}
      delay={i * step}
      title={s.country}
      open={open === s.country}
      ontoggle={() => (open = open === s.country ? null : s.country)}
    />
  {/each}
</div>

<style>
  /* No box of its own: each stamp is a flex item of whatever row the caller
     puts this component in (the finale's .badge-strip), so stamps flow inline
     with badge pills and wrap mid-passport when the row runs out. An open
     stamp's panel positions against that row too — PillSlot measures its
     offsetParent, and the caller's row carries `position: relative` as its
     side of the contract. */
  .stamps {
    display: contents;
  }
</style>

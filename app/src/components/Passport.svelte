<script lang="ts">
  import type { PassportItem } from "../lib/settings";

  /** A row of country stamps, rendered the same in the trophy case and at the
   * finale — the stamp a player sees the moment a country lands is the stamp
   * that shows up in their passport, so the two surfaces cannot drift apart.
   * Exactly the reason BadgePill is one component rather than two.
   *
   * It draws stamps and nothing else. Which countries, in what order, with what
   * numbers on them, which are new and which are still empty slots are all
   * decided by the caller and arrive as `PassportItem`s — `settings.ts` builds
   * both lists, and neither shape is this component's business.
   *
   * A locked stamp is the same object with its ink drained: same size, same
   * flag, same name, no number and no color. It has to stay the same size,
   * because a board of thirty-nine is read as a field and a shrunken slot would
   * make the collected ones look like a different kind of thing rather than the
   * same thing filled in. */
  let { stamps, label }: { stamps: PassportItem[]; label: string } = $props();
</script>

<!-- The row wraps and centers like a badge band, so the passport shares the
     rhythm of whatever sheet or column it sits in rather than reading as a
     different screen bolted on. -->
<div class="stamps" role="list" aria-label={label}>
  {#each stamps as s (s.country)}
    <!-- No markup whitespace anywhere inside the stamp: in a flex container a
         run of text and a run of whitespace collapse into one anonymous item,
         so a newline between two tags renders as a real space that `gap`
         cannot see. Every visible part is its own element and every gap
         between them is the flex `gap` below — BadgePill's rule, for
         BadgePill's reason. -->
    <span
      class="stamp {s.locked ? 'locked' : (s.rarity ?? '')}"
      role="listitem"
      title={s.title ?? undefined}
    >{#if s.fresh}<span class="new">NEW</span>{/if}{#if s.flag}<span
          class="flag">{s.flag}</span
        >{/if}<span class="name">{s.country}</span>{#if s.count !== null}<span
          class="count">×{s.count}</span
        >{/if}</span
    >
  {/each}
</div>

<style>
  .stamps {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }
  /* A stamp, not a pill. The badge pills are 999px capsules; a country wears a
     small radius and a smaller type size, because a country is not a badge and
     the two are read inches apart. The SHAPE is what carries that distinction,
     which is what frees the fill to carry something else. */
  .stamp {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 2px solid var(--gray-ink);
    border-radius: 4px;
    background: var(--card);
    color: var(--muted-2);
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: 3px 8px;
    white-space: nowrap;
  }
  /* The four tier fills are BadgePill's own token pairs, rung for rung — the
     game runs one rarity register and a second ramp would mean a rare stamp and
     a rare pill were different kinds of rare. Only the four middle rungs exist
     here: `legendary` is the top of a badge axis and a country is not an axis,
     and `ironic` is an anti-trophy, which no birthplace is.
     A stamp whose country the table does not know keeps the plain-paper base
     above. It is the one state with no tier to wear, and it is deliberately
     quieter than `common` rather than louder — an unmeasured country must not
     look like a measured one. */
  .stamp.common {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
    color: var(--ink);
  }
  .stamp.uncommon {
    background: var(--sky);
    border-color: var(--blue-8);
    color: var(--ink);
  }
  .stamp.rare {
    background: var(--rare-violet);
    border-color: var(--violet-8);
    color: var(--ink);
  }
  .stamp.ultra {
    background: var(--yellow);
    border-color: var(--gold-8);
    color: var(--ink);
  }
  /* Never been here. It keeps the paper base above — no tier fill, because the
     tier is a fact about a stamp you HOLD — and loses the rest of its ink to a
     dashed line and a faded flag.
     Dashed is the app's own word for "not filled in yet": an empty roster seat
     is dashed, an armed one is dashed, a locked badge slot is dashed. Reusing
     it here costs nothing to learn.
     The name stays at full strength and only the flag is desaturated, which is
     what keeps a board of twenty-eight slots readable — grayscale on a two-
     letter regional-indicator pair leaves a legible shape, and dropping the
     text with it would leave a field of unlabeled gray rectangles. */
  .stamp.locked {
    border-style: dashed;
    border-color: var(--dash);
    background: transparent;
    color: var(--gray-ink);
  }
  .stamp.locked .flag {
    filter: grayscale(1);
    opacity: 0.5;
  }
  /* The flag runs a little larger than the name it sits beside: an emoji set at
     the type size of small caps reads as a smudge, and the flag is the only
     part of a stamp that has to be identifiable at a glance. Its own
     line-height, so a taller glyph cannot grow the stamp. */
  .flag {
    font-size: 13px;
    line-height: 1;
  }
  .count {
    opacity: 0.7;
  }
  /* First time ever fielded, and the same chip the finale's badge pills spend —
     real text rather than a glow or a ring, so a screen reader reads "NEW" in
     the stamp's own order and the cue costs no extra aria. The fill and the
     border are both spent on rarity here exactly as they are on a pill, so a
     chip is the one channel left that borrows nothing. */
  .new {
    border-radius: 999px;
    background: var(--ink);
    color: var(--card);
    font-size: 8.5px;
    letter-spacing: 0.1em;
    /* Its own line-height for the reason the flag has one: as a flex item the
       chip is a box, and an inherited factor would size that box off the
       paragraph rhythm rather than off the chip. */
    line-height: 1.2;
    padding: 1.2px 5px 0.8px;
  }
</style>

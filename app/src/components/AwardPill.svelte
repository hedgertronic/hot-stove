<script lang="ts">
  import { awardFamily, awardLabel } from "../lib/awards";
  import { gridsnap } from "../lib/gridsnap";

  /** One award pill, shared by the market rows, the finale squads, and the
   * finale ledger. What a code is CALLED and which hue family it wears are
   * lib/awards.ts's business — the same registry format.ts sorts a pill row
   * by — so this file draws pills and holds no table of its own.
   * `small` is the market-row size; `n` renders a ×N multiplier (ledger). */
  let { code, n = 1, small = false }: { code: string; n?: number; small?: boolean } = $props();

  const text = $derived(awardLabel(code));
  /** The label split at its leading medal. 🥇MVP is an emoji glyph and a
   * cap-band word in one string, and app.css trims a `.chiplbl` to the cap
   * band — a run holding both would be measured as one. Two flex items sit
   * exactly where the single run did: `.qb` states no `gap`. */
  const medal = $derived(/^[^\u0000-\u007f]/u.test(text) ? [...text][0] : "");
  const word = $derived(text.slice(medal.length));
</script>

<!-- gridsnap rides the SMALL cut only: the gameplay rows' stacked half-pixel
     offsets shave the 1.5px ring's top arc at 3× (the action's own note); the
     finale's full-size chips already sit clean and stay untouched. -->
<span class="chipbox qb {awardFamily(code)}" class:small use:gridsnap={small}
  >{#if medal}<span>{medal}</span>{/if}<span class="chiplbl">{word}</span>{#if n > 1}<span
      class="mult chiplbl">×{n}</span
    >{/if}</span
>

<style>
  /* Centered by the box, not by the line box — app.css's `.chipbox`, which states
     the height, the leading and the typeface so none of the three arrives from
     whatever surface the pill was dropped onto. Left to inline layout the text
     sits wherever two fonts' metrics put the baseline, and PILL_TEXT mixes
     them, since 🥇🥈🥉 come from the emoji face and MVP/CY from the display
     one. That made a medal pill and a plain one different heights and their
     caps land at different depths.
     16px and 15px are the measured 15.5 / 14.75 taken to whole pixels. The
     half-pixel is what the "cut off" outline was: at 15.5px the BORDER BOX's
     own top and bottom edges land on half of a device pixel at 2× and 3×, so
     the ring was painted across a split pixel and faded there instead of
     drawing. It is the box edge that has to sit on the grid, not the ring's
     width — 1.5px of stroke is a design decision and rounding it to 2 would
     make these pills heavier than the market rows they sit in. The surfaces
     built against these heights — PlayerList's reserved row, the finale's
     wrapping squad rows — move by a quarter pixel.
     A whole-pixel BOX still needs a whole-pixel OFFSET, and the gameplay rows
     can't promise one — that half is lib/gridsnap's, riding the small cut in
     the markup above. */
  .qb {
    --chip-h: 16px;
    font-size: 9px;
    font-weight: 800;
    border: 1.5px solid var(--line);
    border-radius: 999px;
    padding-inline: 6px;
  }
  .qb.small {
    --chip-h: 15px;
    font-size: 8.5px;
    padding-inline: 5px;
  }
  /* One hue per award, each on its own line rung — the same pairing the WAR
     chips and the rarity pills wear. */
  .qb.mvp {
    background: var(--yellow);
    border-color: var(--gold-8);
  }
  /* MVP is the one award whose day fill (--yellow) stays bright at night —
     the token holds the cue-capsule seat and doesn't move — so the chip needs
     the same re-cut the ULTRA rarity got: deep gold wash, the bright yellow
     promoted to the ring. Keeps MVP the loudest gold (AS sits on the dim
     --amber) without cream-on-yellow type. */
  :global([data-theme="dark"]) .qb.mvp {
    background: #63490d;
    border-color: var(--yellow);
  }
  .qb.cy {
    background: var(--sky);
    border-color: var(--blue-8);
  }
  .qb.gg {
    background: var(--green-wash);
    border-color: var(--green-8);
  }
  .qb.ss {
    background: var(--lilac);
    border-color: var(--violet-8);
  }
  .qb.roy {
    background: var(--pink);
    border-color: var(--red-8);
  }
  .qb.as {
    background: var(--amber);
    border-color: var(--gold-8);
  }
  /* Manager of the Year wears the skipper's pink — manager surfaces (the
     Skipper row, the MGR seat) are pink throughout; the text tells it apart
     from ROY, which only ever sits on player rows. */
  .qb.moy {
    background: var(--pink);
    border-color: var(--red-8);
  }
  /* A flex item of its own, so the multiplier is centered on the pill's axis
     rather than hung off the label's baseline — at 8px inside a 9px pill the
     baseline drop is most of what made the ×N look like it was falling out.
     Being an item is what makes it take the chip's centering for free: the 8px
     box and the 9px one are both centered in the same content box, and at
     `line-height: 1` each box is exactly its own type, so the two cap bands
     land within a fifth of a pixel of each other. The ledger's "🥇MVP ×5"
     reads as one line of type rather than a label with a superscript sliding
     off it.
     "×5" is measured as a unit: the multiplication sign alone rides the math
     axis, but the digit beside it spans the full cap band and sets the eye's
     line. */
  .mult {
    font-size: 8px;
    margin-left: 2px;
  }
</style>

<script lang="ts">
  import { awardFamily, awardLabel } from "../lib/awards";

  /** One award pill, shared by the market rows, the finale squads, and the
   * finale ledger. What a code is CALLED and which hue family it wears are
   * lib/awards.ts's business — the same registry format.ts sorts a pill row
   * by — so this file draws pills and holds no table of its own.
   * `small` is the market-row size; `n` renders a ×N multiplier (ledger). */
  let { code, n = 1, small = false }: { code: string; n?: number; small?: boolean } = $props();
</script>

<span class="qb {awardFamily(code)}" class:small
  >{awardLabel(code)}{#if n > 1}<span class="mult">×{n}</span>{/if}</span
>

<style>
  /* Centered by the box, not by the line box. Left to inline layout the text
     sits wherever two fonts' metrics put the baseline — and PILL_TEXT mixes
     them, since 🥇🥈🥉 come from the emoji face and MVP/CY from the display
     one. That made a medal pill and a plain one different heights and their
     caps land at different depths. A pinned height with the content centered in
     it takes both off the font's hands.
     The heights are the ones these pills already occupy (15.5px / 14.75px as
     measured), because the surfaces around them are built against exactly
     that: PlayerList reserves the WAR chip's row height so a SIGN confirm
     cannot make a row twitch, and the finale's squad rows wrap award pills
     under long names. Changing the centering must not move either. */
  .qb {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 15.5px;
    font-size: 9px;
    font-weight: 800;
    border: 1.5px solid var(--line);
    border-radius: 999px;
    /* The asymmetry is app.css's optical centering rule, nothing more: the
       label and the ×N are all-caps and digits, so the target is the cap band's
       center, and Nunito puts that 0.0235em above the middle of its own line
       box. 0.047 × 9px = 0.42px of extra clearance up top, which the fixed
       height absorbs, so neither pill changes size.
       The medal pills are the case that decides the rounding. 🥇🥈🥉 come from
       Apple Color Emoji, whose ascent/descent (1.0 / 0.3125em) differ from
       Nunito's, so a medal label's line box stands 9.133px rather than 9px and
       its Nunito baseline sits 0.133px lower inside it. That works out to
       0.066px of disagreement between a 🥇MVP pill and a bare GG one — small
       enough that one number serves both, and the reason the number is 0.4
       rather than the plain-text 0.42. */
    padding: 0.4px 6px 0;
    line-height: 1;
    white-space: nowrap;
  }
  .qb.small {
    height: 14.75px;
    font-size: 8.5px;
    /* Same rule, and 0.047 × 8.5 = 0.40 rounds to the same figure. */
    padding: 0.4px 5px 0;
  }
  /* Where the engine can trim a line box to the cap band, centering stops
     being font arithmetic at all: trim-both cuts the box at the caps' top and
     the baseline, so `align-items: center` centers the visible letters
     themselves. That retires the 0.4px estimate above (it double-corrects
     once the box is exact) AND the cross-engine drift the estimate could
     never fix — Chrome and Safari disagree on which ascent/descent metrics a
     line box uses, which is why these pills sat a hair differently per
     browser. The emoji medals keep painting outside the trimmed box, exactly
     as they overhang the em box today. Engines without text-box keep the
     0.4px path. */
  @supports (text-box: trim-both cap alphabetic) {
    .qb,
    .qb.small {
      text-box: trim-both cap alphabetic;
      padding-top: 0;
    }
  }
  /* One hue per award, each on its own line rung — the same pairing the WAR
     chips and the rarity pills wear. */
  .qb.mvp {
    background: var(--yellow);
    border-color: var(--gold-8);
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
     Being an item is also what makes it inherit the fix above for free:
     `align-items: center` centers it in the same content box the label sits in,
     and the correction the box carries is 0.047 × 9 while the ×N would want
     0.047 × 8, a 0.024px difference. So the ledger's "🥇MVP ×5" now reads as
     one line of type rather than a label with a superscript sliding off it.
     "×5" is measured as a unit: the multiplication sign alone rides the math
     axis, but the digit beside it spans the full cap band and sets the eye's
     line. */
  .mult {
    font-size: 8px;
    margin-left: 2px;
  }
</style>

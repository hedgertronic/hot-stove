<script lang="ts">
  /** The Hot Stove lockup, shared by the home masthead, in-game HUD, and
   * rendered share card. Every cut is a logotype with fire inside the word:
   * the masthead and OG put the letter-fitted boiler in as STOVE's O, and
   * the HUD puts the flame in as HOT's O — the O-boiler doesn't survive
   * 15px, the flame does (alt "O" keeps each word intact for screen
   * readers). */
  let { big = false, og = false }: { big?: boolean; og?: boolean } = $props();
</script>

<span
  class="hs-logo"
  class:hs-logo--home={big && !og}
  class:hs-logo--game={!big && !og}
  class:hs-logo--og={og}
>
  {#if big || og}
    <span class="hs-logo__wordmark"
      ><span class="hs-logo__hot">HOT</span>ST<img
        class="hs-logo__o"
        src="./brand/o-boiler.svg"
        alt="O"
      />VE</span
    >
  {:else}
    <!-- INLINE svg, not an <img>: engines rasterize an SVG image to a
         size-snapped bitmap before compositing, and at the lockup's
         fractional offsets that shaved the flame's bottom arc — the same
         geometry read as floating while the artifact's inline-svg cut sat
         flush. Inline, the path renders in-page as vectors at the exact
         fractional geometry the type beside it gets. The path IS
         public/brand/flame.svg's (logo.dom.test pins the two together). -->
    <!-- role="img" on the WORDMARK: one utterance ("Hot Stove") instead of
         the H-pause-O-pause-T a per-glyph alt produces — the role makes the
         children presentational, so the split word never reaches a screen
         reader. -->
    <span class="hs-logo__wordmark" role="img" aria-label="Hot Stove"
      ><span class="hs-logo__hot">H<span class="hs-logo__oflame"
          ><svg viewBox="19.5 -0.5 61 81" aria-hidden="true"><path
              d="M50 6c7 15 24 21 24 44a24 24 0 0 1-48 0c0-9.4 4.2-16 8.6-21.4-.4 8.8 2.6 13.6 7.6 14.7C38.6 30 43.3 14.8 50 6Z"
              fill="#fcc419"
              stroke="#e8590c"
              stroke-width="7.5"
              stroke-linejoin="round"
            /></svg
          ><span class="hs-logo__ocopy">O</span></span
        >T</span
      >STOVE</span
    >
  {/if}
</span>

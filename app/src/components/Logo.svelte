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
    <!-- The O is an empty span painted by brand.css's data-URI background
         (see .hs-logo__o there): no fetch to race first paint, and every
         surface — this cut, the static boot card, the 404 — draws it by the
         one recipe. role/aria-label keep the word whole for screen readers,
         as the old <img alt="O"> did. -->
    <span class="hs-logo__wordmark"
      ><span class="hs-logo__hot">HOT</span>ST<span
        class="hs-logo__o"
        role="img"
        aria-label="O"
      ></span>VE</span
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
          ><!-- viewBox IS the ink's bounding box (the orange band's extremes;
             the yellow curve sits inside it), zero air on any side — so the
             CSS seat in brand.css can equate "bottom of the box" with
             "bottom of the flame's ink" and align it to the O's overshoot
             row with a single term. --><svg
            viewBox="22.25 2.25 55.49 75.5"
            aria-hidden="true"
          ><path
              d="M50 6c7 15 24 21 24 44a24 24 0 0 1-48 0c0-9.4 4.2-16 8.6-21.4-.4 8.8 2.6 13.6 7.6 14.7C38.6 30 43.3 14.8 50 6Z"
              fill="#fcc419"
            /><path d="M37.73 26.56L37.43 26.16L37.18 25.9L36.83 25.6L36.52 25.4L36.12 25.19L35.76 25.05L35.31 24.94L34.95 24.88L34.21 24.88L33.76 24.96L33.4 25.06L32.97 25.23L32.65 25.4L32.34 25.61L31.99 25.91L31.68 26.25L30.85 27.29L29.35 29.27L28.15 31.02L27.09 32.71L26.14 34.4L25.32 36.08L24.59 37.77L23.96 39.46L23.5 40.95L23.11 42.46L22.79 43.97L22.55 45.49L22.38 47.06L22.28 48.63L22.25 50.24L22.3 51.72L22.43 53.16L22.64 54.62L22.91 56.04L23.27 57.47L23.7 58.85L24.21 60.24L24.77 61.56L25.41 62.86L26.07 64.05L26.81 65.24L27.58 66.36L28.41 67.44L29.29 68.47L30.22 69.47L31.2 70.41L32.23 71.31L33.29 72.16L34.4 72.95L35.54 73.69L36.72 74.37L37.93 74.99L39.17 75.55L40.44 76.05L41.73 76.49L43.04 76.86L44.36 77.17L45.7 77.41L47.05 77.59L48.41 77.7L49.77 77.75L51.13 77.73L52.49 77.64L53.84 77.48L55.19 77.26L56.52 76.97L57.83 76.62L59.13 76.21L60.4 75.73L61.65 75.19L62.87 74.58L64.17 73.86L65.42 73.07L66.62 72.22L67.79 71.3L68.9 70.32L69.96 69.28L70.93 68.22L71.88 67.07L72.76 65.88L73.57 64.65L74.32 63.37L74.99 62.06L75.6 60.7L76.14 59.32L76.6 57.92L76.98 56.49L77.28 55.07L77.51 53.61L77.67 52.14L77.74 50.69L77.74 48.88L77.66 47.04L77.51 45.25L77.3 43.52L77.03 41.89L76.7 40.28L76.3 38.72L75.84 37.17L75.31 35.64L74.72 34.15L74.06 32.66L73.33 31.19L72.31 29.36L71.18 27.55L69.92 25.72L68.52 23.87L67.25 22.28L65.8 20.58L61.16 15.38L59.6 13.59L58.2 11.89L56.98 10.32L55.92 8.82L54.97 7.34L54.12 5.86L53.27 4.17L52.97 3.71L52.47 3.18L51.87 2.75L51.2 2.45L50.49 2.28L50.12 2.25L49.67 2.26L49.21 2.33L48.77 2.46L48.43 2.59L48.03 2.81L47.65 3.07L47.31 3.38L47.02 3.73L46.41 4.54L45.23 6.28L44.18 8L43.2 9.77L42.23 11.71L41.34 13.69L40.52 15.75L39.8 17.82L39.16 19.92L38.61 22.02L38.17 24.02ZM32.26 39.53L32.82 40.68L33.46 41.76L34.18 42.76L34.96 43.65L35.82 44.47L36.74 45.19L37.73 45.82L38.78 46.36L39.94 46.82L41.18 47.17L41.91 47.29L42.69 47.27L43.17 47.18L43.55 47.06L44 46.87L44.34 46.68L44.66 46.45L45.02 46.13L45.52 45.52L45.85 44.92L46.05 44.37L46.16 43.79L46.19 43.21L46.12 42.51L45.68 40.67L45.36 38.96L45.15 37.35L45.01 35.67L44.96 33.84L44.99 31.93L45.12 30.03L45.33 28.13L45.62 26.3L46 24.43L46.46 22.59L47 20.73L47.62 18.9L48.3 17.14L49.07 15.38L49.88 13.71L51.36 15.74L53.09 17.89L55.01 20.12L60.42 26.21L62 28.12L63.35 29.86L64.84 32.01L65.48 33.04L66.08 34.09L66.63 35.11L67.14 36.16L67.61 37.24L68.03 38.3L68.53 39.76L68.95 41.23L69.29 42.69L69.57 44.23L69.78 45.81L69.92 47.43L69.99 49.18L69.99 50.76L69.9 51.97L69.74 53.23L69.49 54.48L69.19 55.65L68.79 56.85L68.34 57.98L67.8 59.13L67.21 60.19L66.69 61.02L66.13 61.82L65.53 62.6L64.89 63.35L64.22 64.06L63.52 64.74L62.78 65.39L62.01 66L61.21 66.56L60.38 67.09L59.53 67.58L58.66 68.03L57.76 68.43L56.85 68.79L55.92 69.1L54.98 69.37L54.02 69.59L53.05 69.77L52.08 69.89L51.1 69.97L50.12 70L49.14 69.98L48.16 69.92L47.19 69.8L46.22 69.64L45.26 69.43L44.32 69.18L43.38 68.87L42.46 68.53L41.57 68.13L40.69 67.7L39.83 67.22L39.05 66.73L38.24 66.18L37.46 65.58L36.71 64.95L35.99 64.28L35.35 63.61L34.7 62.88L34.12 62.16L33.54 61.37L33.01 60.55L32.54 59.75L32.08 58.88L31.67 57.99L31.3 57.08L30.97 56.16L30.71 55.27L30.47 54.32L30.29 53.42L30.15 52.45L30.05 51.47L30.01 50.49L30 49.53L30.04 48.44L30.12 47.42L30.24 46.43L30.41 45.4L30.61 44.41L30.87 43.38L31.16 42.38L31.49 41.4L31.88 40.4Z" fill="#e8590c" fill-rule="evenodd" /></svg
          ><span class="hs-logo__ocopy">O</span></span
        >T</span
      >STOVE</span
    >
  {/if}
</span>

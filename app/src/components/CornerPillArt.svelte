<script lang="ts">
  /** The corner pill's entire resting face — capsule fill, 2px ring, and
   * glyph — drawn by ONE svg in one coordinate system.
   *
   * Why one svg: the previous arrangement drew the ring with a CSS border,
   * the marks with standalone svgs, and the ? with a font glyph — three
   * rasterizers that every engine seats by different rules. A whole round of
   * constant-tuning (13→14px boxes, equal-ink viewBoxes, a +0.5px optical
   * lift reverted the same day) proved no shared constant exists across
   * engines. Welding ring to ink in a single vector scene means any
   * fractional screen offset moves both together — the engines have nothing
   * left to disagree about.
   *
   * The host button stays a native <button>/<a> and keeps its events, focus
   * outline, cue ::after ring, press transforms, and armed text states
   * ("QUIT?"/"UNDO?" are live text with the CSS capsule restored — an armed
   * pill is orange and wider, and nobody is comparing its seat to a
   * neighbour's). Resting, the host's border-color and background go
   * transparent (the 2px border WIDTH stays, so ::after geometry and box
   * metrics are untouched) and this art pins over the border box.
   *
   * State colors flow in, not down: --pill-fill / --pill-ring for the
   * capsule (cue gold, lens ink), currentColor for the mark — the same
   * channels the CSS capsule used.
   *
   * Each mark rides in a nested <svg> (equal-ink 15.077 boxes, per-glyph
   * recentering origins — see the round-32 history in
   * tests/round32-polish.test.ts). Nested viewports are mapped by SVG's own
   * exact arithmetic, not CSS layout, so the whole-pixel-seat gymnastics
   * those origins performed against flex rounding now simply preserve the
   * tuned ink scale.
   *
   * PAINTED INK sits on two grounds (owner call): the compact marks — ✕, ?,
   * funnel — paint 8.0px tall, and the pictorial marks — trophy, undo,
   * bug — paint 10.0px. Painted = (ink height + stroke) × nested scale;
   * each path is drawn (or was rescaled about its ink center) to land on
   * its ground, with the viewBox origin recentered where the center moved. */
  let {
    glyph,
  }: {
    glyph: "close" | "help" | "trophy" | "undo" | "filter" | "bug";
  } = $props();

  /** THE family-wide optical seat, and the only number allowed to become
   * one. If the whole set ever needs to ride a hair high or low, it happens
   * here, once, for every pill on every engine — never as a per-glyph or
   * per-engine constant (that road was walked and reverted; the doctrine is
   * pinned in round32-polish.test.ts). */
  const MARK_DY = 0;
</script>

<!-- Ring centerline at 1..27/1..21 with a 2-unit stroke paints 0..28/0..22 —
     byte-identical coverage to the 2px CSS border on the 28×22 pill it
     replaces, capsule radius included (border-radius 999px clamps to 11
     outer = 10 centerline = rx 10).

     The viewBox runs 2 units PAST the ink on every side (-2..30 × -2..24)
     and the CSS box grows to match, because ink flush to an svg's raster
     edge gets SHAVED in real Safari: at the HUD's fractional offsets its
     compositor rounds the buffer bounds and the owner watched the ring's
     bottom stroke cut to a flat chord (the brand flame lost its right AA
     column to the same rounding). overflow stays visible as the second
     belt; the margin is the suspenders — no ink within 2 units of any
     edge, so a rounded-down boundary only ever crops transparent air. -->
<svg class="art" viewBox="-2 -2 32 26" aria-hidden="true">
  <rect class="capsule" x="1" y="1" width="26" height="20" rx="10" />
  {#if glyph === "close"}
    <svg
      x="7"
      y={4 + MARK_DY}
      width="14"
      height="14"
      viewBox="-0.538 -0.538 15.077 15.077"
      overflow="visible"
      stroke-width="1.6"><path d="M3.49 3.49l7.02 7.02M10.51 3.49l-7.02 7.02" /></svg
    >
  {:else if glyph === "help"}
    <!-- The ? finally joins the family's line-art voice — it was the one
         FONT glyph among five drawn marks, correct-looking for the wrong
         reason (text-box cap trim rode the engine's font machinery while
         its siblings rode CSS layout). Hook-and-dot at the conventional
         proportions, ink measured by getBBox and recentered by the origin
         exactly as the trophy and undo arrow were: ink bbox center is
         (6.310, 6.576), origin = center − 15.077/2. Paints 8.0px — the
         compact ground it shares with the ✕ and the funnel. -->
    <svg
      x="7"
      y={4 + MARK_DY}
      width="14"
      height="14"
      viewBox="-1.228 -0.963 15.077 15.077"
      overflow="visible"
      stroke-width="1.6"
      ><path d="M4.26 4.47a2.11 2.11 0 0 1 4.1.7c0 1.4-2.11 2.11-2.11 2.11M6.3 10.08v.01" /></svg
    >
  {:else if glyph === "trophy"}
    <svg
      x="7"
      y={4 + MARK_DY}
      width="14"
      height="14"
      viewBox="-0.538 -0.584 15.077 15.077"
      overflow="visible"
      stroke-width="1.3"
      ><path
        d="M4.13 2.22h5.74v3.06a2.87 2.87 0 0 1-5.74 0V2.22Z M4.13 2.98H2.5v1.05a1.91 1.91 0 0 0 1.82 1.91 M9.87 2.98h1.63v1.05a1.91 1.91 0 0 1-1.82 1.91 M7 8.34v2.1 M4.7 11.69h4.59"
      /></svg
    >
  {:else if glyph === "undo"}
    <!-- The tail runs longer past the arc than the first drawing's did — the
         owner read the short terminus as cut off — then the whole arrow is
         rescaled about its ink center onto the 10.0px pictorial ground and
         the origin recentered (ink center 6.75, 7.10). -->
    <svg
      x="7"
      y={4 + MARK_DY}
      width="14"
      height="14"
      viewBox="-0.789 -0.439 15.077 15.077"
      overflow="visible"
      stroke-width="1.3"
      ><path d="M10.7 11.83V8.4A3.71 3.71 0 0 0 6.98 4.69H2.81 M5.59 2.37 2.81 4.69l2.78 2.32" /></svg
    >
  {:else if glyph === "filter"}
    <svg
      x="7"
      y={4 + MARK_DY}
      width="14"
      height="14"
      viewBox="-0.538 -0.538 15.077 15.077"
      overflow="visible"
      stroke-width="1.6"><path d="M2.4 3.49h9.21M4.7 7h4.6M6.23 10.51h1.53" /></svg
    >
  {:else}
    <!-- The beetle's ink bbox center is (8, 8.1) — the drawing rides 0.1
         units low in its own coordinates, so the origin drops by the same
         amount to hold it at the viewBox center. -->
    <svg
      x="7"
      y={4 + MARK_DY}
      width="14"
      height="14"
      viewBox="0 0.1 16 16"
      overflow="visible"
      stroke-width="1.6"
      ><path
        d="M6.2 5a1.8 1.8 0 0 1 3.6 0M5 6h6v3a3 3 0 0 1-6 0V6Zm3 0v6M2 6l3 1M11 7l3-1M2 9h3M11 9h3M3 13l2.5-2M10.5 11 13 13"
      /></svg
    >
  {/if}
</svg>

<style>
  .art {
    /* Pinned over the host's BORDER box plus the 2-unit air margin: every
       host keeps a 2px (now transparent) resting border, so the padding box
       this absolute child anchors to sits 2px inside the pill's 28×22 —
       inset −4 reaches 2px past the border box on every side, matching the
       viewBox's −2..30/−2..24 so one svg unit stays one CSS px. */
    position: absolute;
    inset: -4px;
    width: 32px;
    height: 26px;
    display: block;
    overflow: visible;
    /* The tap belongs to the button underneath. */
    pointer-events: none;
  }
  .capsule {
    fill: var(--pill-fill, var(--card));
    stroke: var(--pill-ring, var(--line));
    stroke-width: 2;
    /* The hosts' dim states (undo's disabled, both pushed ghosts) ride the
       --pill-fill/--pill-ring channels so element opacity stays a constant
       1 (the .undo:disabled doctrine). fill/stroke transitioning at the
       hosts' own 0.12s is what lets those channel flips FADE — a paint-only
       animation that repaints in place, never a compositor layer. The cue's
       gold arrival shares the fade; at 0.12s it reads as the same flat
       state change. app.css kills every transition for reduced-motion
       readers. */
    transition:
      fill 0.12s ease,
      stroke 0.12s ease;
  }
  .art svg {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>

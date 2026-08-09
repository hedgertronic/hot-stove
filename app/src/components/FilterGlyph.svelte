<script lang="ts">
  // No props and no state — the block exists so svelte-check emits a typed
  // module for the importers (a script-less .svelte file resolves as `any`).
</script>

<!-- The filter mark, drawn rather than typed for CloseGlyph's reason: no
     funnel glyph survives font fallback identically across engines, and the
     corner pills speak in one line-art voice (✕, trophy, undo arrow). Three
     shrinking bars — the conventional "narrowing" mark — stroked in
     currentColor so it inherits the pill's resting/lens ink.

     14px box, 13px-scale ink — CloseGlyph's whole-pixel seat: a 13px svg in
     the 24×18 content box sat on 2.5px of air and Chromium rounded it 0.5px
     off center. The viewBox is 14 × 14⁄13 = 15.077 so one unit still paints
     at the tuned scale, origin backed up so the ink center (7,7) holds the
     viewBox center. Geometric center on purpose — no optical constants
     (CloseGlyph carries the why and the reverted-lift history). -->
<svg viewBox="-0.538 -0.538 15.077 15.077" aria-hidden="true"
  ><path d="M2.8 3.8h8.4M4.9 7h4.2M6.3 10.2h1.4" /></svg
>

<style>
  svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    /* CloseGlyph's weight: bare strokes need it to match the drawn cup. */
    stroke-width: 1.6;
    stroke-linecap: round;
  }
</style>

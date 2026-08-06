<script lang="ts">
  // No props and no state — the block exists so svelte-check emits a typed
  // module for the importers (a script-less .svelte file resolves as `any`).
</script>

<!-- The filter mark, drawn rather than typed for CloseGlyph's reason: no
     funnel glyph survives font fallback identically across engines, and the
     corner pills speak in one line-art voice (✕, trophy, undo arrow). Three
     shrinking bars — the conventional "narrowing" mark — stroked in
     currentColor so it inherits the pill's resting/lens ink. -->
<svg viewBox="0 0 14 14" aria-hidden="true"
  ><path d="M2.8 3.8h8.4M4.9 7h4.2M6.3 10.2h1.4" /></svg
>

<style>
  svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    /* CloseGlyph's weight: bare strokes need it to match the drawn cup. */
    stroke-width: 1.6;
    stroke-linecap: round;
  }
</style>

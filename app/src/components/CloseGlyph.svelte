<script lang="ts">
  // No props and no state — the block exists so svelte-check emits a typed
  // module for the importers (a script-less .svelte file resolves as `any`).
</script>

<!-- The dismissal ✕, drawn rather than typed. U+2715 is not in bundled
     Nunito, so as text every engine substituted its own fallback face —
     Chrome and Safari showed visibly different marks in the same pill. Line
     art is the same fix CornerButtons applies to the trophy and the undo
     arrow: one path, identical everywhere, stroked in currentColor so it
     inherits each pill's resting/armed ink. Sized against its siblings: the
     ? is a 12px text glyph (~8px of ink) and the trophy a 13px drawing, so a
     7.2px X in the trophy's 13px box reads as their twin. -->
<svg viewBox="0 0 14 14" aria-hidden="true"
  ><path d="M3.4 3.4l7.2 7.2M10.6 3.4l-7.2 7.2" /></svg
>

<style>
  svg {
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    /* Matches the ~1.6px stems Nunito 800 draws at the ?'s 12px, a shade
       heavier than the trophy's 1.3 — an X of two bare strokes needs the
       extra weight to hold the same presence as a drawn cup. */
    stroke-width: 1.6;
    stroke-linecap: round;
  }
</style>

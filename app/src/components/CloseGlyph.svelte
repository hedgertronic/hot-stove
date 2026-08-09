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
     7.2px X in the trophy's 13px box reads as their twin. (A geometric
     ink-height match was tried in round eight — X to 10 units, ? to 13px —
     and reverted the same round: the tuned sizes read better.)

     The BOX is 14px while the ink keeps the tuned 13px scale: a 13px svg in
     the pill's 24×18 content box gets 2.5px of air — a half-pixel seat that
     Chromium rounds away (the X painted 0.5px high and 0.5px right of true
     center; WebKit half-honored it, so the two engines also disagreed). At
     14px the air is whole on every side and both engines measured the ink
     dead-center. The viewBox grows by the same 14/13 ratio (14 × 14⁄13 =
     15.077) so one unit still paints at the old 13px scale, and its origin
     backs up half the growth so the ink's bbox center (7,7) stays at the
     viewBox center.

     GEOMETRIC CENTER, DELIBERATELY — a +0.5px "optical lift" lived here for
     part of one day and was reverted the same day: tuned against the
     cap-trimmed ? on one engine, it read too high on every other
     engine/surface. The lesson stands as the rule: no per-glyph optical
     constants. The planned cure for the residual ±0.3px per-engine
     perception drift is structural (one shared svg drawing ring AND glyph
     in a single coordinate system, any family-wide optical decision as a
     single MARK_DY in that one component), not another number here. -->
<svg viewBox="-0.538 -0.538 15.077 15.077" aria-hidden="true"
  ><path d="M3.4 3.4l7.2 7.2M10.6 3.4l-7.2 7.2" /></svg
>

<style>
  svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    /* Matches the ~1.6px stems Nunito 800 draws at the ?'s 12px, a shade
       heavier than the trophy's 1.3 — an X of two bare strokes needs the
       extra weight to hold the same presence as a drawn cup. */
    stroke-width: 1.6;
    stroke-linecap: round;
  }
</style>

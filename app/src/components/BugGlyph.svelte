<script lang="ts">
  // Stateless on purpose: a shared, typed line-art mark for report controls.
</script>

<!-- A compact beetle rather than an emoji. Its outer strokes occupy a
     symmetric 12×12 box around the exact 8,8 center of the viewBox, so the
     mark sits geometrically centered inside the shared 28×22 corner pill. -->
<svg viewBox="0 0 16 16" aria-hidden="true">
  <path d="M6.2 5a1.8 1.8 0 0 1 3.6 0M5 6h6v3a3 3 0 0 1-6 0V6Zm3 0v6M2 6l3 1M11 7l3-1M2 9h3M11 9h3M3 13l2.5-2M10.5 11 13 13" />
</svg>

<style>
  svg {
    display: block;
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>

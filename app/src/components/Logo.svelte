<script lang="ts">
  /** The Hot Stove lockup is shared by the home masthead, in-game HUD, and
   * rendered share card. The named OG cut changes only the shared CSS size;
   * mark, wordmark, spacing, and optical lift remain the same component. */
  let { big = false, og = false }: { big?: boolean; og?: boolean } = $props();
</script>

<span
  class="hs-logo"
  class:hs-logo--home={big && !og}
  class:hs-logo--game={!big && !og}
  class:hs-logo--og={og}
>
  <img
    class="hs-logo__mark"
    src={big || og ? "./brand/boiler.svg" : "./brand/flame.svg"}
    alt=""
    aria-hidden="true"
  />
  <span class="hs-logo__wordmark"><span class="hs-logo__hot">HOT</span>STOVE</span>
</span>

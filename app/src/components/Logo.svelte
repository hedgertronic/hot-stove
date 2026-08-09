<script lang="ts">
  /** The Hot Stove lockup, shared by the home masthead, in-game HUD, and
   * rendered share card. The masthead and OG cuts are a logotype — the
   * letter-fitted boiler serves as STOVE's O (alt "O" keeps the word intact
   * for screen readers). The HUD cut keeps plain type with the flame mark:
   * the O-boiler doesn't survive 15px, the flame does. */
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
    <img class="hs-logo__mark" src="./brand/flame.svg" alt="" aria-hidden="true" />
    <span class="hs-logo__wordmark"><span class="hs-logo__hot">HOT</span>STOVE</span>
  {/if}
</span>

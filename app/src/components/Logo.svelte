<script lang="ts">
  /** The HOT STOVE wordmark plus the BETA tag — one source for the home
   * masthead (big) and the in-game HUD (small), so the tag can't drift. */
  let { big = false }: { big?: boolean } = $props();
</script>

<span class="logo" class:big>
  <span>HOT<em>STOVE</em></span>
  <span class="beta">BETA</span>
</span>

<style>
  .logo {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-weight: 800;
    font-size: 15px;
  }
  .logo.big {
    font-size: 34px;
    letter-spacing: 0.01em;
    gap: 10px;
  }
  em {
    font-style: normal;
    color: var(--orange);
  }
  .beta {
    border: 1.5px solid var(--gold-8);
    border-radius: 999px;
    background: var(--yellow);
    font-size: 7.5px;
    font-weight: 800;
    letter-spacing: 0.1em;
    line-height: 1;
    padding: 2.5px 6px;
  }
  .logo.big .beta {
    border-width: 2px;
    font-size: 9.5px;
    padding: 3.5px 8px;
  }
</style>

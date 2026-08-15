<script lang="ts">
  /** Dev-only (?endgame): the dream solve's own time, on screen.
   *
   * A phone has no console to read, and the phone is the device whose number
   * decides whether the TAKING THE FIELD card still earns its place — a
   * desktop harness cannot answer that, because CPU throttling does not reach
   * worker threads. So the device reports on itself.
   *
   * Its own component, dynamically imported, for the reason Lab.svelte is:
   * markup behind a DEV check still leaves its scoped CSS in the production
   * stylesheet. A chunk nothing imports in a build takes its styles with it. */
  import type { Game } from "../lib/engine.svelte";

  const { game }: { game: Game } = $props();
</script>

{#if game.solveMs !== null}
  <div class="devsolve">
    {game.solveMs}ms solve{game.solveBlocked ? " · MAIN THREAD" : ""}
  </div>
{/if}

<style>
  /* Above the finale it reports on, and deliberately plain: an instrument, not
     a part of the game. No letter-spacing — it is centered ink, and the
     tracking-leak doctrine (app.css, .warchip .unit) applies to instruments
     too. */
  .devsolve {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 80;
    padding: 2px 8px;
    border-radius: 0 0 6px 6px;
    background: var(--ink);
    color: var(--ground);
    font: 600 11px/1.6 ui-monospace, monospace;
    pointer-events: none;
  }
</style>

<script lang="ts">
  import { accentFor } from "../lib/data";
  import type { Game } from "../lib/engine.svelte";
  import type { Colors } from "../lib/types";

  let { game, colors, onclose }: { game: Game; colors: Colors; onclose: () => void } = $props();

  const teams = $derived(game.card ? game.teamsForYear(game.card.year) : []);

  function pick(team: string) {
    onclose();
    game.relocate(team);
  }
</script>

<div class="backdrop" onclick={onclose} role="presentation">
  <div
    class="sheet disp"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && onclose()}
    role="dialog"
    aria-label="Pick a team"
    tabindex="-1"
  >
    <div class="sheet-h">🚚 RELOCATE — ANY {game.card?.year ?? ""} CLUB</div>
    <div class="grid">
      {#each teams as t (t.team)}
        <button
          class="teambtn"
          disabled={t.team === game.card?.team}
          style:color={accentFor(colors, t.franchise)}
          onclick={() => pick(t.team)}
        >
          {t.name}
        </button>
      {/each}
    </div>
    <button class="btn cancel" onclick={onclose}>Cancel</button>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(36, 34, 28, 0.45);
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .sheet {
    background: var(--ground);
    border: 3px solid var(--ink);
    border-bottom: 0;
    border-radius: 18px 18px 0 0;
    padding: 14px 14px calc(14px + env(safe-area-inset-bottom));
    width: 100%;
    max-width: 480px;
    max-height: 70vh;
    max-height: 70dvh;
    overflow-y: auto;
  }
  .sheet-h {
    text-align: center;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    margin-bottom: 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 7px;
    margin-bottom: 12px;
  }
  .teambtn {
    border: 2px solid var(--ink);
    border-radius: 9px;
    background: var(--card);
    font-family: inherit;
    font-weight: 800;
    font-size: 12px;
    line-height: 1.2;
    padding: 8px 6px;
    cursor: pointer;
    transition: transform 0.08s;
  }
  .teambtn:active {
    transform: translateY(1.5px);
  }
  .teambtn:disabled {
    opacity: 0.32;
    cursor: default;
  }
  .cancel {
    width: 100%;
    font-size: 13px;
    padding: 8px;
  }
</style>

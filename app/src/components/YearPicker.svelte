<script lang="ts">
  import type { Game } from "../lib/engine.svelte";

  let { game, onclose }: { game: Game; onclose: () => void } = $props();

  const years = $derived(game.card ? game.yearsForFranchise(game.card.franchise) : []);
  // Box Score gets the franchise's October history on the grid; Eye Test
  // stays a bare list of years.
  const ped = $derived(
    game.card && game.showAwards
      ? game.yearPedigree(game.card.franchise)
      : ({} as Record<number, "ws" | "pen">),
  );

  function pick(y: number) {
    onclose();
    game.seasonTicket(y);
  }
</script>

<div class="backdrop" onclick={onclose} role="presentation">
  <div
    class="sheet disp"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && onclose()}
    role="dialog"
    aria-label="Pick a season"
    tabindex="-1"
  >
    <div class="sheet-h">🎟️ SEASON TICKET — {game.card?.name ?? ""}</div>
    <div class="grid">
      {#each years as y (y)}
        <button class="yearbtn" disabled={y === game.card?.year} onclick={() => pick(y)}>
          {y}{#if ped[y]}<span class="pedi">{ped[y] === "ws" ? "💍" : "🚩"}</span>{/if}
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
    grid-template-columns: repeat(5, 1fr);
    gap: 7px;
    margin-bottom: 12px;
  }
  .yearbtn {
    border: 2px solid var(--ink);
    border-radius: 9px;
    background: var(--card);
    font-family: inherit;
    font-weight: 800;
    font-size: 13px;
    padding: 9px 0;
    cursor: pointer;
    transition: transform 0.08s;
  }
  /* October pedigree sits inline right after the year, small enough that
     the year stays the dominant glyph. */
  .pedi {
    margin-left: 3px;
    font-size: 9px;
    line-height: 1;
  }
  .yearbtn:active {
    transform: translateY(1.5px);
  }
  .yearbtn:disabled {
    opacity: 0.32;
    cursor: default;
  }
  .cancel {
    width: 100%;
    font-size: 13px;
    padding: 8px;
  }
</style>

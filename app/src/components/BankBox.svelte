<script lang="ts">
  import type { Game } from "../lib/engine.svelte";
  import { money } from "../lib/format";

  let { game }: { game: Game } = $props();

  const spend = $derived(game.spend);
  const cap = $derived(game.effectiveBudget);
  const over = $derived(spend > cap);
  const pct = $derived(cap > 0 ? Math.min((spend / cap) * 100, 100) : 100);
</script>

<div class="bankbox">
  <div class="bankmath disp">
    {#if game.config.bank === "moneyball"}
      <span class="chip eff">⚾ {money(cap)} HARD CAP</span>
    {:else if game.config.bank === "blankcheck"}
      <span class="chip eff">💸 {money(cap)} BLANK CHECK</span>
    {:else}
      {#if game.owner}
        <span class="chip">💰 {money(game.owner.budget)}</span>
      {:else}
        <span class="chip ghost">💰</span>
      {/if}
      <span class="op">×</span>
      {#if game.stadium}
        <span class="chip stad">🏟️ {game.stadium.mult.toFixed(2)}</span>
      {:else}
        <span class="chip ghost">🏟️</span>
      {/if}
      <span class="op">=</span>
      {#if game.owner}
        <span class="chip eff">{money(cap)}</span>
      {:else}
        <span class="chip ghost">{money(cap)} floor</span>
      {/if}
    {/if}
  </div>
  <div class="meter">
    <div class="fill" class:floorover={over} style:width="{over ? 100 : pct}%"></div>
  </div>
  <div class="meter-lbl disp">
    <span>SPENT {money(spend)}</span>
    {#if over}
      <span class="warn"
        >⚠ {money(spend - cap)} OVER {game.owner || game.fixedCap ? "CAP" : "FLOOR"}</span
      >
    {:else}
      <span>{money(cap - spend)} LEFT</span>
    {/if}
  </div>
</div>

<style>
  .bankbox {
    border: 2.5px solid var(--ink);
    border-radius: 12px;
    background: var(--card);
    padding: 8px 10px 10px;
    margin-bottom: 12px;
  }
  .bankmath {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    flex-wrap: wrap;
  }
  .chip {
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 1px 8px;
    background: var(--card);
  }
  .chip.stad {
    background: var(--green-wash);
    color: var(--green-deep);
  }
  .chip.eff {
    background: var(--yellow);
  }
  .chip.ghost {
    border-style: dashed;
    color: var(--gray-ink);
    background: transparent;
  }
  .op {
    color: var(--muted);
  }
  .meter {
    margin-top: 8px;
    border: 2.5px solid var(--ink);
    border-radius: 999px;
    height: 17px;
    overflow: hidden;
    background: var(--card);
  }
  .fill {
    height: 100%;
    background: var(--green);
    border-right: 2.5px solid var(--ink);
    transition: width 0.3s;
  }
  .fill.floorover {
    background: repeating-linear-gradient(
      -45deg,
      var(--orange) 0 8px,
      var(--orange-deep) 8px 16px
    );
    border-right: 0;
  }
  .meter-lbl {
    display: flex;
    justify-content: space-between;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
    margin-top: 4px;
  }
  .warn {
    color: var(--orange);
  }
</style>

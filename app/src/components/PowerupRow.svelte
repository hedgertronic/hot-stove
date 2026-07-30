<script lang="ts">
  import type { Game } from "../lib/engine.svelte";

  let { game, onSeasonTicket }: { game: Game; onSeasonTicket: () => void } = $props();

  // Two-tap confirm for Relocate — a single tap must never spend a reroll.
  let relocateArmed = $state(false);
  let relocateTimer: ReturnType<typeof setTimeout> | undefined;

  const preChoice = $derived(game.phase === "landed" && game.choicesUsed === 0);
  const p = $derived(game.powerups);

  const tdLabel = $derived(
    p.tradeDeadline !== "armed"
      ? "🔁 TRADE DEADLINE"
      : game.releasePick
        ? "🔁 RELEASE WHO?"
        : "🔁 PICK A SWAP…",
  );

  function tapRelocate(e: MouseEvent) {
    e.stopPropagation();
    if (p.relocate !== "ready" || !preChoice) return;
    if (relocateArmed) {
      relocateArmed = false;
      clearTimeout(relocateTimer);
      game.relocate();
    } else {
      relocateArmed = true;
      clearTimeout(relocateTimer);
      relocateTimer = setTimeout(() => (relocateArmed = false), 2500);
    }
  }
</script>

<div class="pprow disp">
  <button
    class="pp"
    class:spent={p.seasonTicket === "spent"}
    class:off={p.seasonTicket === "ready" && !preChoice}
    onclick={(e) => {
      e.stopPropagation();
      if (p.seasonTicket === "ready" && preChoice) onSeasonTicket();
    }}>🎟️ SEASON TICKET</button
  >
  <button
    class="pp"
    class:spent={p.relocate === "spent"}
    class:off={p.relocate === "ready" && !preChoice}
    class:armed={relocateArmed}
    onclick={tapRelocate}>{relocateArmed ? "🚚 REROLL TEAM?" : "🚚 RELOCATE"}</button
  >
  <button
    class="pp"
    class:spent={p.doublePlay === "spent"}
    class:off={p.doublePlay === "ready" && !preChoice}
    class:armed={p.doublePlay === "armed"}
    onclick={(e) => {
      e.stopPropagation();
      game.toggleDoublePlay();
    }}>{p.doublePlay === "armed" ? "✌️ PICK TWO…" : "✌️ DOUBLE PLAY"}</button
  >
  <button
    class="pp"
    class:spent={p.tradeDeadline === "spent"}
    class:armed={p.tradeDeadline === "armed"}
    onclick={(e) => {
      e.stopPropagation();
      game.toggleTradeDeadline();
    }}>{tdLabel}</button
  >
</div>

<style>
  .pprow {
    display: flex;
    justify-content: center;
    gap: 7px;
    margin: 6px 0 10px;
    flex-wrap: wrap;
  }
  .pp {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--card);
    padding: 5px 11px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: transform 0.08s;
    font-family: inherit;
    position: relative;
  }
  /* Invisible extension keeps the visual pill small but the tap target ≥44px. */
  .pp::after {
    content: "";
    position: absolute;
    inset: -9px 0;
  }
  .pp:active {
    transform: translateY(1.5px);
  }
  .pp.spent {
    opacity: 0.32;
    cursor: default;
  }
  .pp.spent:active {
    transform: none;
  }
  .pp.off {
    opacity: 0.55;
    cursor: default;
  }
  .pp.armed {
    background: var(--orange);
    color: var(--card);
  }
</style>

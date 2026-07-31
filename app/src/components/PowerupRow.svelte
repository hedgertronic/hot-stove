<script lang="ts">
  import type { Game } from "../lib/engine.svelte";

  let {
    game,
    onSeasonTicket,
    onRelocate,
  }: { game: Game; onSeasonTicket: () => void; onRelocate: () => void } = $props();

  const preChoice = $derived(game.phase === "landed" && game.choicesUsed === 0);
  const p = $derived(game.powerups);

  const tdLabel = $derived(
    p.tradeDeadline !== "armed"
      ? "🔁 TRADE DEADLINE"
      : game.releasePick
        ? "🔁 RELEASE WHO?"
        : "🔁 PICK A SWAP…",
  );

  const canAct = $derived(game.phase === "landed" && game.choicesLeft > 0);
  const primeLabel = $derived(p.prime === "armed" ? "⭐ TAP A PLAYER…" : "⭐ PRIME TIME");
</script>

<div class="pprow disp">
  <button
    class="pp"
    class:spent={p.seasonTicket === "spent"}
    class:off={p.seasonTicket === "ready" && !preChoice}
    onclick={(e) => {
      e.stopPropagation();
      if (p.seasonTicket === "ready" && preChoice) onSeasonTicket();
    }}><span class="lb">🎟️ SEASON TICKET</span></button
  >
  <button
    class="pp"
    class:spent={p.relocate === "spent"}
    class:off={p.relocate === "ready" && !preChoice}
    onclick={(e) => {
      e.stopPropagation();
      if (p.relocate === "ready" && preChoice) onRelocate();
    }}><span class="lb">🚚 RELOCATE</span></button
  >
  <button
    class="pp"
    class:spent={p.doublePlay === "spent"}
    class:off={p.doublePlay === "ready" && !preChoice}
    class:armed={p.doublePlay === "armed"}
    onclick={(e) => {
      e.stopPropagation();
      game.toggleDoublePlay();
    }}><span class="lb">{p.doublePlay === "armed" ? "✌️ PICK 2 — UNDO" : "✌️ DOUBLE PLAY"}</span></button
  >
  <button
    class="pp"
    class:spent={p.tradeDeadline === "spent"}
    class:armed={p.tradeDeadline === "armed"}
    onclick={(e) => {
      e.stopPropagation();
      game.toggleTradeDeadline();
    }}><span class="lb">{tdLabel}</span></button
  >
  <button
    class="pp"
    class:spent={p.prime === "spent"}
    class:off={p.prime === "ready" && !canAct}
    class:armed={p.prime === "armed"}
    onclick={(e) => {
      e.stopPropagation();
      if (p.prime !== "ready" || canAct) game.togglePrime();
    }}><span class="lb">{primeLabel}</span></button
  >
</div>

<style>
  /* A fixed 3+2 lattice (six tracks: top pills span 2, bottom span 3) — the
     rows stay balanced no matter how a pill's label changes when armed;
     free-wrapping flex could strand one pill alone on the second row. */
  .pprow {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 7px;
    margin: 6px 0 10px;
  }
  .pp {
    display: block;
    min-width: 0;
    text-align: center;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--card);
    padding: 5px 4px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: transform 0.08s;
    font-family: inherit;
    position: relative;
  }
  /* The label clips inside the pill; the ::after tap extension stays outside
     it, unclipped. */
  .lb {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pp:nth-child(-n + 3) {
    grid-column: span 2;
  }
  .pp:nth-child(n + 4) {
    grid-column: span 3;
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
  /* Wide: the market column has room — let the pills breathe again. */
  @media (min-width: 760px) {
    .pp {
      padding: 5px 8px;
      font-size: 10.5px;
      letter-spacing: 0.04em;
    }
  }
</style>

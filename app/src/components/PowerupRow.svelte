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
    class:spent={p.prime === "spent"}
    class:off={p.prime === "ready" && !canAct}
    class:armed={p.prime === "armed"}
    onclick={(e) => {
      e.stopPropagation();
      if (p.prime !== "ready" || canAct) game.togglePrime();
    }}><span class="lb">{primeLabel}</span></button
  >
  <span class="brk"></span>
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
    class:off={p.tradeDeadline === "ready" && !canAct}
    class:armed={p.tradeDeadline === "armed"}
    onclick={(e) => {
      e.stopPropagation();
      game.toggleTradeDeadline();
    }}><span class="lb">{tdLabel}</span></button
  >
</div>

<style>
  /* Content-hugging pills in two centered rows, 3 + 2 — the forced break
     after the third pill is what keeps the rows balanced; free wrapping
     could strand one pill alone under four. */
  .pprow {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    /* The zero-height .brk is its own flex line, so row-gap lands twice
       (above and below it) — 4px row-gap reads as ~8px between pill rows. */
    gap: 4px 7px;
    margin: 6px 0 10px;
  }
  .brk {
    flex-basis: 100%;
    height: 0;
  }
  .pp {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    text-align: center;
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
  /* If an armed label ever outgrows its row, the pill shrinks and the label
     ellipsizes inside it; the ::after tap extension stays unclipped. */
  .lb {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Invisible extension grows the tap target without growing the pill. Capped
     at half the ~8px row spacing so the two rows' targets meet but never
     overlap (a later pill's extension would otherwise cover the pill above). */
  .pp::after {
    content: "";
    position: absolute;
    inset: -4px 0;
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

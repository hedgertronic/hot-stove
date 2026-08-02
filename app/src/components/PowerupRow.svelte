<script lang="ts">
  import type { Game } from "../lib/engine.svelte";

  let {
    game,
    onSeasonTicket,
    onRelocate,
  }: { game: Game; onSeasonTicket: () => void; onRelocate: () => void } = $props();

  const preChoice = $derived(game.phase === "landed" && game.choicesUsed === 0);
  const p = $derived(game.powerups);

  // Armed labels all speak in one voice: instruct the next tap, trailing "…".
  // No meta-UI words (UNDO, DONE) — tapping an armed pill again disarms it,
  // unlabeled, the same toggle gesture that armed it.
  const tdLabel = $derived(
    p.tradeDeadline !== "armed"
      ? "🔁 TRADE DEADLINE"
      : game.releasePick
        ? "🔁 WHO GOES?"
        : "🔁 PICK A TRADE…",
  );

  const canAct = $derived(game.phase === "landed" && game.choicesLeft > 0);
  const primeLabel = $derived(p.prime === "armed" ? "⭐ TAP A PLAYER…" : "⭐ PRIME TIME");
  const hdLabel = $derived(p.hometown === "armed" ? "🏠 SIGN FOR $1M…" : "🏠 HOMEGROWN");
  const dpLabel = $derived(
    p.doublePlay !== "armed"
      ? "✌️ DOUBLE PLAY"
      : game.choicesUsed > 0
        ? "✌️ PICK ONE MORE…"
        : "✌️ PICK TWO…",
  );
</script>

<div class="pprow disp">
  <div class="row">
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
  </div>
  <div class="row">
    <button
      class="pp"
      class:spent={p.doublePlay === "spent"}
      class:off={p.doublePlay === "ready" && !preChoice}
      class:armed={p.doublePlay === "armed"}
      onclick={(e) => {
        e.stopPropagation();
        game.toggleDoublePlay();
      }}><span class="lb">{dpLabel}</span></button
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
    <button
      class="pp"
      class:spent={p.hometown === "spent"}
      class:off={p.hometown === "ready" && !canAct}
      class:armed={p.hometown === "armed"}
      onclick={(e) => {
        e.stopPropagation();
        game.toggleHometown();
      }}><span class="lb">{hdLabel}</span></button
    >
  </div>
</div>

<style>
  /* Two explicit pill rows (ST/RELO/PT and DP/TD/HD) stacked in a column.
     The column gap and each row's own wrap gap are the same 8px, so the
     vertical rhythm is uniform at EVERY wrap count — forced 3+3, or a
     natural three-line wrap at narrow widths. (This replaces a zero-height
     flex-break element whose doubled row-gap needed magic-number halving.) */
  .pprow {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 6px 0 10px;
    container-type: inline-size;
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 7px;
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
     at half the 8px row spacing so adjacent lines' targets meet but never
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
    background: var(--orange-2);
    border-color: var(--orange-8);
    color: var(--ink);
  }
  /* The six ready labels need ~393px at the base type size — just over a
     390px phone's 362px content box. One modest type tier, keyed to the
     row's ACTUAL width (container query, not viewport), keeps the 3+3
     lattice on standard phones. Armed labels are longer and may still wrap;
     the two-row structure keeps every wrap's spacing uniform. (This block
     must sit after the base .pp rule — equal specificity, source order
     decides.) */
  @container (max-width: 400px) {
    .pp {
      font-size: 10px;
      padding: 5px 8px;
      letter-spacing: 0.02em;
    }
  }
</style>

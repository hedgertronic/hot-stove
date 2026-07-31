<script lang="ts">
  import type { Game } from "../lib/engine.svelte";
  import { money } from "../lib/format";

  let { game }: { game: Game } = $props();

  const spend = $derived(game.spend);
  const cap = $derived(game.effectiveBudget);
  // Before an owner is hired the engine's budget is only the minBudget floor —
  // a data artifact, not a real cap. Don't render it as one.
  const capKnown = $derived(game.capKnown);
  const over = $derived(capKnown && spend > cap);
  const pct = $derived(!capKnown ? 0 : cap > 0 ? Math.min((spend / cap) * 100, 100) : 100);
</script>

<div class="bankbox">
  <div class="bankmath disp">
    {#if game.config.bank === "moneyball"}
      <span class="chip eff">⚾ {money(cap)} BANKROLL</span>
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
        <span class="chip ghost">$???</span>
      {/if}
    {/if}
  </div>
  {#if game.config.bank === "classic"}
    <div class="hires disp">
      <span class="hire" class:tbd={!game.owner}>💰 {game.owner ? game.owner.name : "no owner yet"}</span>
      <span class="hsep">·</span>
      <span class="hire" class:tbd={!game.stadium}>🏟️ {game.stadium ? game.stadium.park : "no stadium yet"}</span>
    </div>
  {:else}
    <!-- Fixed-cap modes have no hires; the same line carries the cap's team
         identity instead, so the box keeps one height across all modes. -->
    <div class="hires disp">
      <span class="hire">💰 {game.config.bank === "moneyball" ? "OAK 2002" : "NYY 2005"}</span>
    </div>
  {/if}
  <div class="meter">
    {#if !capKnown}
      <!-- No owner yet ⇒ no denominator: the bar can't show a share of an
           unknown bankroll, so it reads as pure uncertainty instead. -->
      <div class="fill unknown"><span class="qs">? ? ? ? ? ? ? ?</span></div>
    {:else}
      <div class="fill" class:floorover={over} class:zero={spend <= 0} style:width="{over ? 100 : pct}%"></div>
    {/if}
  </div>
  <div class="meter-lbl disp">
    <span>SPENT {money(spend)}</span>
    {#if !capKnown}
      <span class="nocap">$??? LEFT</span>
    {:else if over}
      <span class="warn">⚠ {money(spend - cap)} OVER BANKROLL</span>
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
  .hires {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 5px;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
  }
  .hire {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 46%;
  }
  .hire.tbd {
    color: var(--gray-ink);
    font-style: italic;
    font-weight: 600;
  }
  .hsep {
    color: var(--gray-ink);
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
  /* At $0 the bar's own right border would still paint a sliver — hide it all. */
  .fill.zero {
    border-right: 0;
    background: transparent;
  }
  .fill.floorover {
    background: repeating-linear-gradient(
      -45deg,
      var(--orange) 0 8px,
      var(--orange-deep) 8px 16px
    );
    border-right: 0;
  }
  /* Unknown bankroll: a soft drifting hatch + question marks — a loading bar
     that admits it doesn't know where it ends. */
  .fill.unknown {
    width: 100%;
    border-right: 0;
    background: repeating-linear-gradient(
      -45deg,
      var(--gray-bg) 0 10px,
      transparent 10px 20px
    );
    background-size: 28.3px 100%;
    display: grid;
    place-content: center;
    animation: drift 2.6s linear infinite;
  }
  .qs {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.28em;
    color: var(--gray-ink);
    line-height: 1;
  }
  @keyframes drift {
    to {
      background-position: 28.3px 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .fill.unknown {
      animation: none;
    }
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
  /* Same size/weight/color as the SPENT label; italic alone marks the unknown. */
  .nocap {
    color: var(--muted);
    font-style: italic;
    font-weight: 700;
  }
  /* Wide: the box owns a 350–380px column — scale the math, meter, and labels
     up a notch so the bank reads at column size instead of phone size. */
  @media (min-width: 760px) {
    .bankbox {
      padding: 10px 12px 12px;
    }
    .bankmath {
      font-size: 13px;
    }
    .hires {
      font-size: 11.5px;
    }
    .meter {
      height: 22px;
    }
    .meter-lbl {
      font-size: 11.5px;
    }
  }
</style>

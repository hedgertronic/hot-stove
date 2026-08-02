<script lang="ts">
  import type { Game } from "../lib/engine.svelte";
  import { ownerFor } from "../lib/data";
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
      <span class="chip eff">⚾ {money(cap)} PAYROLL</span>
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
    <!-- Fixed-cap modes have no hires; the same line carries the real owner
         whose club sets the cap (owners.json), exactly as classic would show
         a hired owner, so the box keeps one height across all modes. -->
    <div class="hires disp">
      <span class="hire solo"
        >💰 {game.config.bank === "moneyball"
          ? ownerFor(game.owners, "OAK", 2002)
          : ownerFor(game.owners, "NYY", 2005)}</span
      >
    </div>
  {/if}
  <div class="meter">
    {#if !capKnown}
      <!-- No owner yet ⇒ no denominator: the bar can't show a share of an
           unknown payroll, so a drifting hatch reads as pure uncertainty. -->
      <div class="fill unknown"></div>
    {:else}
      <div class="fill" class:floorover={over} class:zero={spend <= 0} style:width="{over ? 100 : pct}%"></div>
    {/if}
  </div>
  <div class="meter-lbl disp">
    <span class="spent">SPENT <span class="amt">{money(spend)}</span></span>
    {#if !capKnown}
      <span class="nocap">$??? LEFT</span>
    {:else if over}
      <span class="warn"><span class="amt">{money(spend - cap)}</span> OVER PAYROLL</span>
    {:else}
      <span class="left"><span class="amt">{money(cap - spend)}</span> LEFT</span>
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
  /* A lone owner line (fixed-cap modes) owns the whole row. */
  .hire.solo {
    max-width: 100%;
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
  /* Unknown payroll: a soft drifting hatch — a loading bar that admits it
     doesn't know where it ends. */
  .fill.unknown {
    width: 100%;
    border-right: 0;
    background: repeating-linear-gradient(
      -45deg,
      var(--gray-bg) 0 10px,
      transparent 10px 20px
    );
    background-size: 28.3px 100%;
    animation: drift 2.6s linear infinite;
  }
  @keyframes drift {
    to {
      background-position: 28.3px 0;
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
  /* The two directions money travels, in the two colours the meter above
     already spends on them: what has gone out is the bar's orange, what is
     still there is the bar's green. The row becomes a legend for the fill
     rather than a caption under it.

     Orange here cannot be confused with the over-payroll warning that spends
     the same hue. That warning REPLACES the green figure — the two never
     render together — so orange on the right always means trouble while
     orange on the left always means outflow, and an over-payroll box turning
     entirely orange is the correct reading of an over-payroll box.

     The colour lands on the amounts alone. "SPENT" and "LEFT" are constants
     and the figures are the variables, so only the variables carry the
     signal. Size and weight stay on the label row's scale: before an owner is
     hired the opposite end of this row is an unknown, and a figure that
     outgrew it would be shouting at a question mark. */
  .spent .amt {
    color: var(--orange);
  }
  .left .amt {
    color: var(--green-deep);
  }
  /* The overrun follows the row's own rule: the figure carries the colour and
     the words stay a label. "OVER PAYROLL" is the constant here — the only
     thing that varies is how far over. */
  .warn .amt {
    color: var(--orange);
  }
  /* The one half of this row with no figure in it, so there is nothing for the
     colour rule to land on; italic alone marks the unknown. */
  .nocap {
    color: var(--muted);
    font-style: italic;
    font-weight: 700;
  }
  /* Wide: the box owns a 350–380px column — scale the math, meter, and labels
     up a notch so the bank reads at column size instead of phone size. */
  @media (min-width: 760px) {
    .bankbox {
      padding: 12px 14px 14px;
    }
    .bankmath {
      font-size: 13.5px;
      gap: 8px;
    }
    .chip {
      padding: 2px 10px;
    }
    .hires {
      font-size: 12px;
      margin-top: 7px;
    }
    .meter {
      height: 24px;
      margin-top: 10px;
    }
    .meter-lbl {
      font-size: 11.5px;
      margin-top: 5px;
    }
  }
</style>

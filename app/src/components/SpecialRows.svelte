<script lang="ts">
  import type { Game, SpecialKey } from "../lib/engine.svelte";
  import { money, signed } from "../lib/format";

  let {
    game,
    confirmKey,
    setConfirm,
  }: { game: Game; confirmKey: string | null; setConfirm: (k: string | null) => void } = $props();

  const tdArmed = $derived(game.powerups.tradeDeadline === "armed");
  const canAct = $derived(game.phase === "landed" && game.choicesLeft > 0);

  interface Row {
    key: SpecialKey;
    cls: string;
    ic: string;
    who: string;
    what: string;
    val: string;
    verb: string;
  }

  const rows = $derived.by((): Row[] => {
    const c = game.card;
    if (!c) return [];
    const out: Row[] = [];
    if (!game.fixedCap) {
      out.push(
        {
          key: "owner",
          cls: "",
          ic: "💰",
          who: game.ownerName,
          what: "Owner",
          val: money(c.budget),
          verb: "HIRE",
        },
        {
          key: "stadium",
          cls: "stad",
          ic: "🏟️",
          who: c.park,
          what: "Stadium",
          val: `×${c.stadiumMult.toFixed(2)}`,
          verb: "BUY",
        },
      );
    }
    if (c.manager != null) {
      out.push({
        key: "skipper",
        cls: "skip",
        ic: "🧢",
        who: c.manager,
        what: "Skipper",
        val: signed((c.wins - c.losses) * 0.1),
        verb: "HIRE",
      });
    }
    return out;
  });

  function commit(key: SpecialKey) {
    setConfirm(null);
    if (key === "owner") game.hireOwner();
    else if (key === "stadium") game.buyStadium();
    else game.hireSkipper();
  }

  function commitSwap(key: SpecialKey) {
    setConfirm(null);
    game.tdTapSpecial(key);
  }

  function tap(row: Row, e: MouseEvent) {
    e.stopPropagation();
    if (!canAct) return;
    const taken = game.specialTaken(row.key);
    if (!taken) setConfirm(confirmKey === `s:${row.key}` ? null : `s:${row.key}`);
    else if (tdArmed) setConfirm(confirmKey === `w:${row.key}` ? null : `w:${row.key}`);
  }
</script>

{#if rows.length > 0}
  <div class="psep">FRONT OFFICE</div>
{/if}
<div class="special disp">
  {#each rows as row (row.key)}
    {@const taken = game.specialTaken(row.key)}
    {@const swappable = taken && tdArmed && canAct}
    <button
      class="srow {row.cls}"
      class:taken={taken && !swappable}
      class:swap={swappable}
      onclick={(e) => tap(row, e)}
    >
      <span class="ic">{row.ic}</span>
      <span class="mid">
        <span class="who">{row.who}</span>
        <span class="what">{row.what}</span>
      </span>
      {#if confirmKey === `s:${row.key}` && !taken}
        <span class="confirm" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); commit(row.key); }} onkeydown={(e) => e.key === "Enter" && commit(row.key)}>{row.verb} {row.val}</span>
      {:else if confirmKey === `w:${row.key}` && swappable}
        <span class="confirm" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); commitSwap(row.key); }} onkeydown={(e) => e.key === "Enter" && commitSwap(row.key)}>🔁 SWAP IN</span>
      {:else}
        <span class="val">{row.val}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .special {
    display: grid;
    gap: 7px;
    margin-bottom: 10px;
  }
  .srow {
    display: flex;
    align-items: center;
    gap: 9px;
    border: 2.5px solid var(--ink);
    border-radius: 11px;
    background: var(--yellow);
    padding: 7px 10px;
    cursor: pointer;
    transition: transform 0.08s;
    font-family: inherit;
    color: inherit;
    text-align: left;
    width: 100%;
    min-height: 48px;
  }
  .srow:active {
    transform: translate(-1px, -1px);
  }
  .srow .ic {
    font-size: 19px;
  }
  .mid {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .who {
    font-weight: 800;
    font-size: 13.5px;
    line-height: 1.2;
  }
  .what {
    font-size: 11px;
    color: var(--muted-2);
    font-weight: 600;
  }
  .val {
    margin-left: auto;
    font-weight: 800;
    font-size: 14px;
    white-space: nowrap;
  }
  .srow.stad {
    background: var(--sky);
  }
  .srow.skip {
    background: var(--pink);
  }
  .srow.taken {
    background: var(--gray-bg);
    color: var(--gray-ink);
    cursor: default;
    filter: grayscale(1);
  }
  .srow.taken:active {
    transform: none;
  }
  .srow.taken .what,
  .srow.taken .val {
    color: var(--gray-ink);
  }
  .srow.swap {
    background: var(--amber);
    border-style: dashed;
    color: var(--ink);
    filter: none;
  }
  .srow.swap .what {
    color: var(--muted-2);
  }
  .confirm {
    margin-left: auto;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--ink);
    color: var(--card);
    font-weight: 800;
    font-size: 12px;
    padding: 4px 12px;
    white-space: nowrap;
  }
</style>

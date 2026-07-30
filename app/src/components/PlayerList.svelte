<script lang="ts">
  import type { Game } from "../lib/engine.svelte";
  import { costTier, money, warTier } from "../lib/format";
  import type { CardPlayer } from "../lib/types";

  let {
    game,
    confirmKey,
    setConfirm,
  }: { game: Game; confirmKey: string | null; setConfirm: (k: string | null) => void } = $props();

  const COLLAPSED = 9;
  let expanded = $state(false);

  // Reset the expander per card.
  $effect(() => {
    void game.card;
    expanded = false;
  });

  const sorted = $derived.by(() =>
    game.card ? [...game.card.players].sort((a, b) => b.cost - a.cost) : [],
  );
  // Collapsed view keeps salary order but guarantees signable rows are visible:
  // late-game (one slot open) the eligible players are cheap and would otherwise
  // all hide behind the expander, leaving a wall of gray.
  const visible = $derived.by(() => {
    if (expanded) return sorted;
    const out = sorted.slice(0, COLLAPSED);
    let open = out.filter((p) => game.playerState(p) === "open").length;
    for (const p of sorted.slice(COLLAPSED)) {
      if (open >= 3) break;
      if (game.playerState(p) === "open") {
        out.push(p);
        open++;
      }
    }
    return out;
  });

  const tdArmed = $derived(game.powerups.tradeDeadline === "armed");
  const canAct = $derived(game.phase === "landed" && game.choicesLeft > 0);

  function tap(p: CardPlayer, e: MouseEvent) {
    e.stopPropagation();
    if (!canAct) return;
    const state = game.playerState(p);
    if (state === "open") {
      setConfirm(confirmKey === `p:${p.id}` ? null : `p:${p.id}`);
    } else if (tdArmed) {
      setConfirm(confirmKey === `t:${p.id}` ? null : `t:${p.id}`);
    }
  }

  function commitSign(p: CardPlayer) {
    setConfirm(null);
    game.signPlayer(p);
  }

  function commitTrade(p: CardPlayer) {
    setConfirm(null);
    game.tdTapPlayer(p);
  }
</script>

<div class="plist disp">
  {#each visible as p (p.id)}
    {@const state = game.playerState(p)}
    {@const dead = state === "dead"}
    {@const swappable = dead && tdArmed && canAct && !game.isRostered(p)}
    {@const hero = game.heroEligible(p)}
    {@const price = game.priceFor(p)}
    <button
      class="prow"
      class:dead={dead && !swappable}
      class:swap={swappable}
      onclick={(e) => tap(p, e)}
    >
      <span class="war {warTier(p.war)}">{p.war.toFixed(1)}<i>WAR</i></span>
      <span class="mid">
        <span class="pname">{p.name}</span>
        <span class="ppos">{p.pos}{hero ? " · 🏠 hometown" : ""}</span>
      </span>
      <span class="right">
        {#if confirmKey === `p:${p.id}` && state === "open"}
          <span class="confirm" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); commitSign(p); }} onkeydown={(e) => e.key === "Enter" && commitSign(p)}>SIGN {money(price)}</span>
        {:else if confirmKey === `t:${p.id}` && swappable}
          <span class="confirm" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); commitTrade(p); }} onkeydown={(e) => e.key === "Enter" && commitTrade(p)}>🔁 {money(price)}</span>
        {:else}
          <span class="cost {hero ? 'cheap' : costTier(price)}">{money(price)}</span>
        {/if}
      </span>
    </button>
  {/each}
  {#if !expanded && sorted.length > visible.length}
    <button class="more" onclick={(e) => { e.stopPropagation(); expanded = true; }}>
      show {sorted.length - visible.length} more ▾
    </button>
  {/if}
</div>

<style>
  .plist {
    display: grid;
    gap: 6px;
    padding-bottom: 10px;
  }
  .prow {
    display: flex;
    align-items: center;
    gap: 9px;
    background: var(--card);
    border: 2.5px solid var(--ink);
    border-radius: 11px;
    padding: 6px 10px;
    cursor: pointer;
    transition: transform 0.08s;
    font-family: inherit;
    color: inherit;
    text-align: left;
    width: 100%;
    min-height: 54px;
  }
  .prow:active {
    transform: translate(-1px, -1px);
  }
  .war {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--war-high);
    color: var(--card);
    border: 2px solid var(--ink);
    display: grid;
    place-content: center;
    text-align: center;
    font-weight: 800;
    font-size: 13px;
    line-height: 1;
    flex: none;
  }
  .war i {
    font-style: normal;
    display: block;
    font-size: 7.5px;
    font-weight: 700;
  }
  .war.low {
    background: var(--war-low);
  }
  .war.mid {
    background: var(--war-mid);
  }
  .war.elite {
    background: var(--war-elite);
    color: var(--ink);
  }
  .mid {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .pname {
    font-weight: 800;
    font-size: 14px;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ppos {
    font-size: 10.5px;
    color: var(--muted);
  }
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 7px;
    flex: none;
  }
  .cost {
    font-weight: 800;
    font-size: 14px;
    white-space: nowrap;
  }
  .cost.cheap {
    color: var(--green);
  }
  .cost.spendy {
    color: var(--orange);
  }
  .prow.dead {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
    opacity: 0.55;
    cursor: default;
    filter: grayscale(1);
  }
  .prow.dead:active {
    transform: none;
  }
  .prow.dead .war {
    background: var(--gray-ink);
  }
  .prow.swap {
    background: var(--amber);
    border: 2.5px dashed var(--ink);
    opacity: 1;
    filter: none;
  }
  .confirm {
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--ink);
    color: var(--card);
    font-weight: 800;
    font-size: 12px;
    padding: 4px 12px;
    white-space: nowrap;
  }
  .more {
    text-align: center;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--muted);
    padding: 8px 0;
    cursor: pointer;
    background: none;
    border: 0;
    font-family: inherit;
  }
</style>

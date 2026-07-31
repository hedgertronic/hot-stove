<script lang="ts">
  import { loadCard, loadPlayers } from "../lib/data";
  import type { Game } from "../lib/engine.svelte";
  import { money, statLine, warTier } from "../lib/format";
  import type { CardPlayer } from "../lib/types";

  let { game, onclose }: { game: Game; onclose: () => void } = $props();

  const playerId = $derived(game.primePick);
  const listed = $derived.by((): CardPlayer | null => {
    if (playerId === null || !game.card) return null;
    return game.card.players.find((p) => p.id === playerId) ?? null;
  });

  interface Season {
    team: string;
    year: number;
    teamName: string;
    p: CardPlayer;
    /** Season fits an open roster seat → signable. */
    fits: boolean;
    /** This is the landed card's own season — just sign him the normal way. */
    here: boolean;
  }
  let seasons = $state<Season[] | null>(null);
  let failed = $state(false);
  let busy = $state(false);

  // The whole career loads up front (cards are ~10KB each and cached); rows
  // that fit no open seat render grayed rather than vanishing.
  $effect(() => {
    const id = playerId;
    seasons = null;
    failed = false;
    if (id === null) return;
    void (async () => {
      try {
        const index = await loadPlayers();
        const refs = index[id] ?? [];
        const cards = await Promise.all(refs.map(([t, y]) => loadCard(t, y)));
        seasons = cards
          .map((card) => {
            const p = card.players.find((pl) => pl.id === id);
            return p
              ? {
                  team: card.team,
                  year: card.year,
                  teamName: card.name,
                  p,
                  fits: game.openSlotsFor(p).length > 0,
                  here: card.team === game.card?.team && card.year === game.card?.year,
                }
              : null;
          })
          .filter((x): x is Season => x !== null)
          .sort((a, b) => a.year - b.year);
      } catch {
        failed = true;
      }
    })();
  });

  async function pick(sea: Season) {
    if (busy || !sea.fits || sea.here) return;
    busy = true;
    await game.applyPrime(sea.team, sea.year);
    busy = false;
    onclose();
  }
</script>

<div class="backdrop" onclick={onclose} role="presentation">
  <div
    class="sheet disp"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && onclose()}
    role="dialog"
    aria-label="Pick a season of this player's career"
    tabindex="-1"
  >
    <div class="sheet-h">⭐ PRIME TIME — {listed?.name ?? ""}</div>
    <div class="sheet-sub">Sign any year of the career, at that year's price</div>
    {#if failed}
      <div class="note">Couldn't load the career. Try again.</div>
    {:else if seasons === null}
      <div class="note">Pulling the card file…</div>
    {:else if seasons.length === 0}
      <div class="note">One-season wonder — no other years to visit.</div>
    {:else}
      <div class="list">
        {#each seasons as sea ((sea.team + sea.year))}
          <button class="srow" disabled={!sea.fits || sea.here} onclick={() => pick(sea)}>
            <span class="pos" class:pit={sea.p.pos.startsWith("SP") || sea.p.pos === "RP"}
              >{sea.p.pos.split("/")[0]}</span>
            <span class="mid">
              <span class="yr">{sea.year} {sea.teamName}</span>
              {#if sea.here}<span class="sub">that's this card — just sign him</span>
              {:else if !sea.fits}<span class="sub">no open seat fits this season</span>
              {:else if game.showWar && statLine(sea.p)}<span class="sub">{statLine(sea.p)}</span>{/if}
            </span>
            <span class="right">
              {#if game.showWar}<span class="warchip {warTier(sea.p.war)}">{sea.p.war.toFixed(1)}</span>{/if}
              {#if game.showCost}<span class="cost">{money(sea.p.cost)}</span>{/if}
            </span>
          </button>
        {/each}
      </div>
    {/if}
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
  }
  .sheet-sub {
    text-align: center;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
    margin: 2px 0 10px;
  }
  .note {
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
    padding: 18px 0;
  }
  .list {
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  }
  .srow {
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
    min-height: 48px;
  }
  .srow:active {
    transform: translate(-1px, -1px);
  }
  .srow:disabled {
    opacity: 0.45;
    filter: grayscale(1);
    cursor: default;
  }
  .srow:disabled:active {
    transform: none;
  }
  .pos {
    width: 38px;
    border-radius: 7px;
    background: var(--card);
    color: var(--ink);
    border: 2px solid var(--ink);
    display: grid;
    place-content: center;
    text-align: center;
    font-weight: 800;
    font-size: 9.5px;
    letter-spacing: 0.03em;
    line-height: 1;
    padding: 4px 0;
    flex: none;
  }
  .pos.pit {
    background: var(--ink);
    color: var(--card);
  }
  .mid {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .yr {
    font-weight: 800;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub {
    font-size: 10px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 7px;
    flex: none;
  }
  .warchip {
    display: inline-block;
    min-width: 42px;
    text-align: center;
    border: 2px solid var(--ink);
    border-radius: 9px;
    font-weight: 800;
    font-size: 13.5px;
    line-height: 1.65;
    padding: 0 5px;
    color: var(--card);
  }
  .warchip.neg {
    background: var(--war-neg);
  }
  .warchip.low {
    background: var(--war-low);
  }
  .warchip.mid {
    background: var(--war-mid);
  }
  .warchip.high {
    background: var(--war-high);
  }
  .warchip.elite {
    background: var(--war-elite);
    color: var(--ink);
  }
  .cost {
    font-weight: 800;
    font-size: 13px;
    white-space: nowrap;
    min-width: 48px;
    text-align: right;
  }
  .cancel {
    width: 100%;
    font-size: 13px;
    padding: 8px;
  }
</style>

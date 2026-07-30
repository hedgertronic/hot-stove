<script lang="ts">
  import { loadCard, loadPlayers } from "../lib/data";
  import { SLOT_TYPES, type Game } from "../lib/engine.svelte";
  import { eligibleTypes } from "../lib/eligibility";
  import { money, statLine, warTier } from "../lib/format";
  import type { CardPlayer } from "../lib/types";

  let { game, onclose }: { game: Game; onclose: () => void } = $props();

  const slotIdx = $derived(game.primePick);
  const signed = $derived(slotIdx !== null ? game.slots[slotIdx] : null);

  interface Season {
    team: string;
    year: number;
    teamName: string;
    p: CardPlayer;
    eligible: boolean;
  }
  let seasons = $state<Season[] | null>(null);
  let failed = $state(false);

  // The whole career loads up front (cards are ~10KB each and cached); rows
  // that no longer fit the slot render grayed rather than vanishing.
  $effect(() => {
    const idx = slotIdx;
    const s = signed;
    seasons = null;
    failed = false;
    if (idx === null || !s) return;
    void (async () => {
      try {
        const index = await loadPlayers();
        const refs = (index[s.id] ?? []).filter(([t, y]) => !(t === s.team && y === s.year));
        const cards = await Promise.all(refs.map(([t, y]) => loadCard(t, y)));
        seasons = cards
          .map((card) => {
            const p = card.players.find((pl) => pl.id === s.id);
            return p
              ? {
                  team: card.team,
                  year: card.year,
                  teamName: card.name,
                  p,
                  eligible: eligibleTypes(p).includes(SLOT_TYPES[idx]),
                }
              : null;
          })
          .filter((x): x is Season => x !== null);
      } catch {
        failed = true;
      }
    })();
  });

  async function pick(sea: Season) {
    if (slotIdx === null || !sea.eligible) return;
    await game.applyPrime(slotIdx, sea.team, sea.year);
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
    <div class="sheet-h">⭐ PRIME — {signed?.name ?? ""}</div>
    {#if failed}
      <div class="note">Couldn't load the career. Try again.</div>
    {:else if seasons === null}
      <div class="note">Pulling the card file…</div>
    {:else if seasons.length === 0}
      <div class="note">One-season wonder — no other years to visit.</div>
    {:else}
      <div class="list">
        {#each seasons as sea ((sea.team + sea.year))}
          <button class="srow" disabled={!sea.eligible} onclick={() => pick(sea)}>
            {#if game.showWar}
              <span class="war {warTier(sea.p.war)}">{sea.p.war.toFixed(1)}<i>WAR</i></span>
            {:else}
              <span class="war pos">{sea.p.pos.split("/")[0]}</span>
            {/if}
            <span class="mid">
              <span class="yr">’{String(sea.year).slice(2)} {sea.teamName}</span>
              {#if game.showStats && statLine(sea.p)}<span class="sub">{statLine(sea.p)}</span
                >{:else if !sea.eligible}<span class="sub">doesn't fit the {SLOT_TYPES[slotIdx ?? 0]} slot</span>{/if}
            </span>
            {#if game.showCost}
              <span class="cost">{money(sea.p.cost)}</span>
            {/if}
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
    margin-bottom: 10px;
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
  .war.pos {
    background: var(--card);
    color: var(--ink);
    font-size: 11px;
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
  }
  .cost {
    margin-left: auto;
    font-weight: 800;
    font-size: 13px;
    white-space: nowrap;
  }
  .cancel {
    width: 100%;
    font-size: 13px;
    padding: 8px;
  }
</style>

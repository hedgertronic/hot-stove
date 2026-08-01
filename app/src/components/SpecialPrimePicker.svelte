<script lang="ts">
  import { loadSpecials } from "../lib/data";
  import type { Game } from "../lib/engine.svelte";
  import { signed } from "../lib/format";
  import { MANAGER_PER_NET_WIN } from "../lib/scoring";
  import type { SpecialSeason } from "../lib/types";
  import AwardPill from "./AwardPill.svelte";
  import Sheet from "./Sheet.svelte";

  let { game, onclose }: { game: Game; onclose: () => void } = $props();

  /** The card's skipper, whose cross-franchise career fills the sheet. The
   * manager is Prime's only front-office target — owner and stadium tiles
   * never reach this picker. */
  const skipper = $derived(game.primeSpecial !== null ? (game.card?.manager ?? "") : "");

  interface Row {
    team: string;
    year: number;
    /** Muted record ("93–69"; empty in Eye Test). */
    rec: string;
    /** Manager of the Year season (award visibility: Box Score only). */
    moty: boolean;
    /** Right-edge win value ("+4.8 W"; empty in Eye Test). */
    val: string;
    /** The landed card's own season — hire it the normal way. */
    here: boolean;
  }
  let rows = $state<Row[] | null>(null);
  let failed = $state(false);
  let busy = $state(false);

  $effect(() => {
    const name = skipper;
    const c = game.card;
    rows = null;
    failed = false;
    if (!name || !c) return;
    void (async () => {
      try {
        // A manager's career crosses franchises; scan the whole index.
        const specials = await loadSpecials();
        const picks: SpecialSeason[] = [];
        for (const list of Object.values(specials))
          for (const s of list) if (s.mgr === name) picks.push(s);
        rows = picks
          .sort((a, b) => a.year - b.year || a.team.localeCompare(b.team))
          .map((s) => ({
            team: s.team,
            year: s.year,
            rec: game.scout ? "" : `${s.w}–${s.l}`,
            moty: game.showAwards && s.moty === true,
            val: game.scout ? "" : `${signed((s.w - s.l) * MANAGER_PER_NET_WIN)} W`,
            here: s.team === c.team && s.year === c.year,
          }));
      } catch {
        failed = true;
      }
    })();
  });

  async function pick(row: Row) {
    if (busy || row.here) return;
    busy = true;
    await game.applyPrimeSpecial(row.team, row.year);
    busy = false;
    onclose();
  }
</script>

<Sheet {onclose} label="Pick a season of this manager's career">
  <div class="sheet-h">⭐ PRIME TIME — 🧢 {skipper}</div>
  <div class="sheet-sub">Hire any season of the career, at that season's record</div>
  {#if failed}
    <div class="note">Couldn't load the career. Try again.</div>
  {:else if rows === null}
    <div class="note">Pulling the file…</div>
  {:else if rows.length <= 1}
    <div class="note">One-year wonder — no other seasons to visit.</div>
  {:else}
    <div class="list">
      {#each rows as row ((row.team + row.year))}
        <!-- One line per season, market-row anatomy like the player career
             sheet: fixed-width 🧢 tag, year + team code, then the season's
             real metric — muted W–L and the win value — at the right edge.
             Every season fits (this sheet only opens on an open manager
             seat), so only the landed card's own year grays out. -->
        <button class="srow" disabled={row.here} onclick={() => pick(row)}>
          <span class="tag">🧢</span>
          <span class="yr"
            >{row.year} {row.team}{#if row.moty}&nbsp;<AwardPill code="MOY" small />{/if}</span
          >
          <span class="right">
            {#if row.rec}<span class="rec">{row.rec}</span>{/if}
            {#if row.val}<span class="val">{row.val}</span>{/if}
          </span>
        </button>
      {/each}
    </div>
  {/if}
  <button class="btn cancel" onclick={onclose}>Cancel</button>
</Sheet>

<style>
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
  /* Same faded-tier idiom as the player career sheet's dead rows: identity
     goes monochrome, the metric keeps a washed but readable presence. */
  .srow:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .srow:disabled .tag {
    filter: grayscale(1);
  }
  .srow:disabled .rec,
  .srow:disabled .val {
    filter: saturate(0.7);
  }
  .srow:disabled:active {
    transform: none;
  }
  /* Fixed-width leading tag, same geometry as the player rows' position
     chip; the 🧢 IS the type label, on the skipper's pink. */
  .tag {
    width: 38px;
    border-radius: 7px;
    background: var(--pink);
    border: 2px solid var(--ink);
    display: grid;
    place-content: center;
    text-align: center;
    font-size: 14px;
    line-height: 1;
    padding: 4px 0;
    flex: none;
  }
  .yr {
    font-weight: 800;
    font-size: 13px;
    min-width: 0;
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
  .rec {
    font-size: 11px;
    color: var(--muted-2);
    font-weight: 600;
    white-space: nowrap;
  }
  /* Structural right-alignment like the player rows' price column, wide
     enough that "+14.0 W" and "−4.2 W" line up. */
  .val {
    display: inline-flex;
    justify-content: flex-end;
    font-weight: 800;
    font-size: 13px;
    white-space: nowrap;
    min-width: 56px;
  }
  .cancel {
    width: 100%;
    font-size: 13px;
    padding: 8px;
  }
</style>

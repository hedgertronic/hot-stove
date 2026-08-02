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
        <!-- The card's own manager row, one field swapped: the FRONT OFFICE
             row leads with the skipper's name, and here the person is fixed
             while the season varies, so the lead is year + team code. Every
             other beat matches SpecialRows' skipper row — full pink card,
             bare 🧢 in the fixed-width type column, muted W–L riding right
             beside the label, MOY pill after it, win value at the right edge.
             Every season fits (this sheet only opens on an open manager
             seat), so only the landed card's own year grays out. -->
        <button class="srow" disabled={row.here} onclick={() => pick(row)}>
          <span class="ic">🧢</span>
          <span class="mid">
            <span class="who">{row.year} {row.team}</span>
            {#if row.rec}<span class="meta">{row.rec}</span>{/if}
            {#if row.moty}<AwardPill code="MOY" small />{/if}
          </span>
          {#if row.val}<span class="val">{row.val}</span>{/if}
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
  /* The whole card carries the skipper's pink, exactly like the FRONT OFFICE
     manager row — the tint is what makes a manager row read as a manager row,
     and a lone tinted tag on a white card broke that language. */
  .srow {
    display: flex;
    align-items: center;
    gap: 9px;
    background: var(--pink);
    border: 2.5px solid var(--red-8);
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
  /* Unavailable rows speak the taken-tile language from the draft screen:
     the whole card drops to gray and goes monochrome. There is no hidden
     tier to whisper here — a manager season is a record, not a WAR chip. */
  .srow:disabled {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
    color: var(--gray-ink);
    cursor: default;
    filter: grayscale(1);
  }
  .srow:disabled .meta,
  .srow:disabled .val {
    color: var(--gray-ink);
  }
  .srow:disabled:active {
    transform: none;
  }
  /* The emoji IS the type label — fixed width like the player rows' position
     chip, so both career sheets align their labels on the same column. */
  .ic {
    width: 38px;
    text-align: center;
    font-size: 19px;
    /* line-height 1 keeps the emoji's line box from outgrowing the row. */
    line-height: 1;
    flex: none;
  }
  .mid {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
  }
  .who {
    font-weight: 800;
    font-size: 14px;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The record rides beside the season label, the way the FRONT OFFICE row
     puts "84–78" beside the skipper's name. */
  .meta {
    font-size: 11px;
    color: var(--muted-2);
    font-weight: 600;
    flex: none;
  }
  .val {
    margin-left: auto;
    font-weight: 800;
    font-size: 14px;
    white-space: nowrap;
  }
  .cancel {
    width: 100%;
    font-size: 13px;
    padding: 8px;
  }
</style>

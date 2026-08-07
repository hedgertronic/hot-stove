<script lang="ts">
  import { loadSpecials } from "../lib/data";
  import type { Game } from "../lib/engine.svelte";
  import { statValue, warTier } from "../lib/format";
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
    /** October pedigree glyph ("💍" champ, "🚩" pennant, "" neither; Box Score
     * only). Follows the MOY pill — the finale manager row's own order
     * (award hardware, then the club's October). */
    pedi: string;
    /** Manager of the Year season (award visibility: Box Score only). */
    moty: boolean;
    /** Right-edge win value, bare ("4.8", "−8.4"; empty in Eye Test). The chip
     * appends its WINS unit in the markup, the way the player market chips
     * append WAR — positive values drop the plus because the unit now says
     * which scale this is, and a negative keeps its minus. */
    val: string;
    /** Rung of the WAR ladder this season's win value lands on as a bare word
     * (`elite`, `mid`, …), or "" when the mode hides it. One field, spelled two
     * ways in the markup, which is app.css's own split: the CHIP wears the bare
     * word every WAR chip in the game wears, and the ROW wears the prefixed
     * `war-elite` because the rung is a fact about the season rather than about
     * the chip drawn on it. The prefix matches the roster rail's, and for the
     * same reason: a test can assert Eye Test emits no `war-` token at all. */
    tier: string;
    /** The landed card's own season — hire it the normal way. */
    here: boolean;
  }
  let rows = $state<Row[] | null>(null);
  let failed = $state(false);
  let busy = $state(false);
  /** Key of the season row awaiting confirm tap, `null` when no row is armed. */
  let armed = $state<string | null>(null);

  $effect(() => {
    const name = skipper;
    const c = game.card;
    rows = null;
    failed = false;
    armed = null;
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
            pedi: game.showAwards ? (s.ws ? "💍" : s.pen ? "🚩" : "") : "",
            moty: game.showAwards && s.moty === true,
            // One mapping, imported, never re-derived: net wins × the scoring
            // module's own per-win rate, read through format.ts's warTier —
            // the exact expression the roster rail's MGR seat uses. A skipper's
            // contribution is measured in wins and the ladder is the game's one
            // scale for "how good is this", which is why the share string has
            // always printed the manager cell in the players' own six hues.
            val: game.scout ? "" : statValue((s.w - s.l) * MANAGER_PER_NET_WIN),
            tier: game.showWar ? warTier((s.w - s.l) * MANAGER_PER_NET_WIN) : "",
            here: s.team === c.team && s.year === c.year,
          }));
      } catch {
        failed = true;
      }
    })();
  });

  /** First tap arms the row; a second tap on the same row disarms it.
   * Tapping a different row arms that row instead. */
  function arm(row: Row) {
    if (row.here) return;
    const key = `${row.team}:${row.year}`;
    armed = armed === key ? null : key;
  }

  /** Second tap: commit the armed season via the prime special apply path.
   * try/finally for PrimePicker's reason exactly: the apply awaits a
   * network load, and a throw would latch `busy` — rows grayed for the
   * sheet's life. Close on success only; re-enable on any failure. */
  async function commit(row: Row) {
    if (busy) return;
    busy = true;
    try {
      await game.applyPrimeSpecial(row.team, row.year);
      onclose();
    } catch {
      /* offline mid-tap: stay open, rows re-enable */
    } finally {
      busy = false;
    }
  }
</script>

<Sheet
  {onclose}
  label="Pick a season of this manager's career"
  title="⭐ PRIME TIME: {skipper}"
  confirmLabel="CANCEL"
>
  {#if failed}
    <div class="picker-note">Couldn't load the career. Try again.</div>
  {:else if rows === null}
    <div class="picker-note">Pulling the file…</div>
  {:else if rows.length === 0}
    <div class="picker-note">No seasons on file for this manager.</div>
  {:else}
    <div class="picker-list">
      {#each rows as row ((row.team + row.year))}
        {@const key = `${row.team}:${row.year}`}
        {@const isArmed = armed === key}
        <!-- The card's own manager row, one field swapped: the FRONT OFFICE
             row leads with the skipper's name, and here the person is fixed
             while the season varies, so the lead is year + team code. Every
             other beat matches SpecialRows' skipper row — bare 🧢 in the
             fixed-width type column, muted W–L riding right beside the label,
             MOY pill after it, win value at the right edge in a WAR chip.
             Every season fits (this sheet only opens on an open manager
             seat), so only the landed card's own year grays out. -->
        <div
          class="srow {row.tier ? `war-${row.tier}` : ''}"
          class:dead={row.here}
        >
          <button class="srow-btn" disabled={row.here} onclick={() => arm(row)}>
            <span class="ic">🧢</span>
            <span class="mid">
              <span class="who">{row.year} {row.team}</span>
              {#if row.rec}<span class="meta">{row.rec}</span>{/if}
              {#if row.moty}<AwardPill code="MOY" small />{/if}
              {#if row.pedi}<span class="pedi">{row.pedi}</span>{/if}
            </span>
            {#if !isArmed && row.val}<span class="val warchip {row.tier}">{row.val}<span class="unit">WINS</span></span>{/if}
          </button>
          {#if isArmed}
            <button
              type="button"
              class="confirm"
              disabled={busy}
              onclick={(e) => { e.stopPropagation(); void commit(row); }}
            ><span class="chiplbl">HIRE MGR</span></button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</Sheet>

<style>
  /* The .picker-note and .picker-list chrome shared with PrimePicker
     lives in app.css. No bottom margin on .picker-list: the shell owns the
     gap between the scrolling body and the CANCEL button it draws. */
  /* ---------- a market row, so: white cardstock in --line ----------
     This sheet is a MARKET — the whole point of it is comparing 23 seasons of
     one career and choosing one — and app.css's rule is that a row still being
     chosen between stays plain and puts its value in a chip. The chips then
     align in a column and the eye runs down them, which is exactly what a wall
     of six competing washes prevents. The rung a season earns is not withheld;
     it moves to where it can be read against its neighbours.
     The row carries `war-{tier}` all the same, because the rung is a fact about
     the season and the sheet's test reads it there — but that class sets
     app.css's --rung pair and paints nothing on its own, so the row spends
     neither half of it. Eye Test emits no token at all, and a career of
     identical blank rows is the honest picture of what that mode knows. */
  .srow {
    display: flex;
    align-items: center;
    background: var(--card);
    border: 2.5px solid var(--line);
    border-radius: 11px;
    padding: 6px 10px;
    cursor: pointer;
    transition: transform 0.08s;
    font-family: inherit;
    color: inherit;
    text-align: left;
    min-height: 48px;
  }
  .srow:active {
    transform: translate(-1px, -1px);
  }
  /* Unavailable rows speak the taken-tile language from the draft screen: the
     whole card drops to gray and goes monochrome, its own chip included. The
     tier is not whispered through the way a dead market row keeps its chip's
     hue — there is exactly one unavailable season here, the landed card's own,
     and it is the season already on offer in the FRONT OFFICE row at full
     color. */
  .srow.dead {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
    color: var(--gray-ink);
    cursor: default;
    filter: grayscale(1);
  }
  .srow.dead .meta,
  .srow.dead .val {
    color: var(--gray-ink);
  }
  .srow.dead:active {
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
  /* `mid` is also the WAR ladder's middle rung, and on this row the chip is the
     season label's SIBLING — so the child combinator that fences the same
     collision in PlayerList and PrimePicker cannot fence it here, and a
     mid-rung chip would be turned into a wrapping flex box with no 42px floor.
     The name collision is the whole bug; excluding the chip is the whole fix. */
  .srow-btn > .mid:not(.warchip) {
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
  /* MarketRow's medal recipe: whole-box glyph, line-height 1 so the emoji's
     taller line box can't set the row's. Same size the player sheet's
     ring/medal wear — the two career sheets read as one surface. */
  .pedi {
    font-size: 12px;
    line-height: 1;
    flex: none;
  }
  /* The record rides beside the season label, the way the FRONT OFFICE row
     puts "84–78" beside the skipper's name. */
  .meta {
    font-size: 11px;
    color: var(--muted-2);
    font-weight: 600;
    flex: none;
  }
  /* The chip owns its own type, border and wash — everything the row adds is
     the right edge and a promise not to wrap "−8.4 WINS" across two lines. */
  .val {
    margin-left: auto;
    flex: none;
    white-space: nowrap;
  }
  /* The confirm stops at the row's full padding, the same edge the value
     it replaces holds (the chip inset rule is retired). */
  .srow > .confirm {
    flex: none;
  }
  @media (min-width: 760px) {
    /* The market rows' desktop padding, matching PrimePicker. */
    .srow {
      padding: 8px 10px;
    }
  }
</style>

<script lang="ts">
  import { loadSpecials } from "../lib/data";
  import type { Game } from "../lib/engine.svelte";
  import { signed, warTier } from "../lib/format";
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
    /** Rung of the WAR ladder this season's win value lands on, or "" when the
     * mode hides it. One class drives the row's wash AND the value's color, so
     * the two can never disagree about which rung a season is. The `war-`
     * prefix matches the roster rail's, and for the same reason: a test can
     * assert Eye Test emits no `war-` token at all. */
    tier: string;
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
            // One mapping, imported, never re-derived: net wins × the scoring
            // module's own per-win rate, read through format.ts's warTier —
            // the exact expression the roster rail's MGR seat uses. A skipper's
            // contribution is measured in wins and the ladder is the game's one
            // scale for "how good is this", which is why the share string has
            // always printed the manager cell in the players' own six hues.
            val: game.scout ? "" : `${signed((s.w - s.l) * MANAGER_PER_NET_WIN)} W`,
            tier: game.showWar ? `war-${warTier((s.w - s.l) * MANAGER_PER_NET_WIN)}` : "",
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

<Sheet
  {onclose}
  label="Pick a season of this manager's career"
  title="⭐ PRIMETIME — 🧢 {skipper}"
  subtitle="Hire any season of the career, at that season's record"
  confirmLabel="CANCEL"
>
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
             other beat matches SpecialRows' skipper row — bare 🧢 in the
             fixed-width type column, muted W–L riding right beside the label,
             MOY pill after it, win value at the right edge.
             Every season fits (this sheet only opens on an open manager
             seat), so only the landed card's own year grays out. -->
        <button class="srow {row.tier}" disabled={row.here} onclick={() => pick(row)}>
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
</Sheet>

<style>
  .note {
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
    padding: 18px 0;
  }
  /* No bottom margin: the shell owns the gap between the scrolling body and
     the CANCEL button it draws, so a margin here would double it. */
  .list {
    display: grid;
    gap: 6px;
  }
  /* Card-white is the resting state and the Eye Test state: with the win value
     withheld there is no rung to draw, and a career of identical blank rows is
     the honest picture of what that mode knows. The tinting rule's pair paints
     over it below. */
  .srow {
    display: flex;
    align-items: center;
    gap: 9px;
    background: var(--card);
    border: 2.5px solid var(--line);
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
  /* A season is worth a number of wins and the game has exactly one scale for
     that, so every row here is the tinting rule's pair at the rung its own
     record earns: the hue's wash for the card, the hue's line for the border,
     and the same line color on the win value at the right edge. This is the
     roster rail's hired-manager seat, one screen earlier — browse the career in
     the same colors the chair will wear once the season is hired, and a 108-win
     year is legible as gold before the number is read.
     THE ROW, NOT THE VALUE, CARRIES THE WASH. Coloring "+9.2 W" alone was the
     smaller change and it does not survive contrast: the rung-8 hues on the old
     pink card run 1.93:1 at the low rung. Against their own rung-2 wash the
     same six run 2.17–3.77:1, which is the register the rail's WAR numerals
     have always used, and the wash does most of the reading anyway.
     Pink is gone from this sheet for the same reason it left the MGR seat: it
     was saying "manager", and 🧢 in the type column plus a header reading
     "⭐ PRIMETIME — 🧢 {name}" already say it on every row.
     Placed above the :disabled block on purpose — the two weigh the same, and
     the landed card's own season must gray out whatever rung it earned. */
  .srow.war-neg {
    background: var(--war-neg-fill);
    border-color: var(--war-neg);
  }
  .srow.war-low {
    background: var(--war-low-fill);
    border-color: var(--war-low);
  }
  .srow.war-mid {
    background: var(--war-mid-fill);
    border-color: var(--war-mid);
  }
  .srow.war-high {
    background: var(--war-high-fill);
    border-color: var(--war-high);
  }
  .srow.war-star {
    background: var(--war-star-fill);
    border-color: var(--war-star);
  }
  .srow.war-elite {
    background: var(--war-elite-fill);
    border-color: var(--war-elite);
  }
  /* Ink, on every rung. app.css's rule for type on a rung-2 fill is ink, and
     these rows are that fill: the numeral used to be tinted to match its own
     wash, which runs 2.17:1 to 3.77:1 where ink runs 9.52:1 at worst. The rung
     is already said twice on the row, by the fill and by the frame. Same
     correction the finale's seats and the ballpark chip took. */
  .srow[class*="war-"] .val {
    color: var(--ink);
  }
  .srow:active {
    transform: translate(-1px, -1px);
  }
  /* Unavailable rows speak the taken-tile language from the draft screen: the
     whole card drops to gray and goes monochrome, rung and all. The tier is not
     whispered through the way a dead market row keeps its WAR chip's hue —
     there is exactly one unavailable season here, the landed card's own, and it
     is the season already on offer in the FRONT OFFICE row at full color. */
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
</style>

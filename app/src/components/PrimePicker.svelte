<script lang="ts">
  import { loadCard, loadPlayers } from "../lib/data";
  import { isPitcher } from "../lib/eligibility";
  import type { Game } from "../lib/engine.svelte";
  import { costTier, money, posLabel, sortAwards, warTier } from "../lib/format";
  import type { CardPlayer } from "../lib/types";
  import AwardPill from "./AwardPill.svelte";
  import Sheet from "./Sheet.svelte";

  let { game, onclose }: { game: Game; onclose: () => void } = $props();

  const playerId = $derived(game.primePick);
  const listed = $derived.by((): CardPlayer | null => {
    if (playerId === null || !game.card) return null;
    return game.card.players.find((p) => p.id === playerId) ?? null;
  });

  interface Season {
    team: string;
    year: number;
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
                  p,
                  // The engine decides, because reachability is now two rules:
                  // an open seat, or an armed 🔁 with an occupied one it may
                  // vacate. A second copy here would gray the seasons the
                  // swap branch is able to sign.
                  fits: game.primeFits(p),
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

  /** Award pills follow the market rows' rule exactly: hardware is Box Score
   * knowledge. Eye Test hides which season was the MVP year — that hidden
   * edge is the mode, and the career sheet is the one screen where leaking it
   * would hand over the whole answer at once. */
  const hasBadges = (p: CardPlayer) => game.showAwards && p.awards.length > 0;

  async function pick(sea: Season) {
    if (busy || !sea.fits || sea.here) return;
    busy = true;
    await game.applyPrime(sea.team, sea.year);
    busy = false;
    onclose();
  }
</script>

<Sheet
  {onclose}
  label="Pick a season of this player's career"
  title="⭐ PRIMETIME — {listed?.name ?? ''}"
  subtitle="Sign any year of the career, at that year's price"
  confirmLabel="CANCEL"
>
    {#if failed}
      <div class="note">Couldn't load the career. Try again.</div>
    {:else if seasons === null}
      <div class="note">Pulling the card file…</div>
    {:else if seasons.length === 0}
      <div class="note">One-season wonder — no other years to visit.</div>
    {:else}
      <div class="list">
        {#each seasons as sea ((sea.team + sea.year))}
          {@const plabel = posLabel(sea.p)}
          <button class="srow" disabled={!sea.fits || sea.here} onclick={() => pick(sea)}>
            <span class="pos" class:pit={isPitcher(sea.p)} class:long={plabel.length > 5}
              >{plabel}</span
            >
            <!-- The market row with one field swapped: the list leads with the
                 player's NAME, and here the player is fixed while the season
                 varies, so the lead is year + team code. Award pills follow it
                 inline and wrap to a second line on narrow phones, the same
                 badges-wrap-names-don't idiom the market rows use. Unsignable
                 rows (current card's own season, no fitting open seat) just
                 gray — no explanatory copy, same as every other gray row. -->
            <span class="mid">
              <span class="yr">{sea.year} {sea.team}</span>
              {#if hasBadges(sea.p)}<span class="badges"
                  >{#each sortAwards(sea.p.awards) as a}<AwardPill code={a} small />{/each}</span
                >{/if}
            </span>
            <span class="right">
              {#if game.showWar}<span class="warchip {warTier(sea.p.war)}">{sea.p.war.toFixed(1)}<span class="unit">WAR</span></span>{/if}
              <span class="cost {costTier(sea.p.cost)}">{money(sea.p.cost)}</span>
            </span>
          </button>
        {/each}
      </div>
    {/if}
</Sheet>

<style>
  /* Header, subtitle, ✕ and the CANCEL button all belong to Sheet — a picker
     is a thing you back out of, so its bottom button says CANCEL rather than
     CLOSE. */
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
    cursor: default;
  }
  /* Same faded-tier idiom as the market's dead rows: identity goes
     monochrome, the WAR chip and price keep a washed but recognizable hue. */
  .srow:disabled > .pos,
  .srow:disabled > .mid {
    filter: grayscale(1);
  }
  .srow:disabled .warchip,
  .srow:disabled .cost {
    filter: saturate(0.7);
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
  /* Multi-group labels ("C/IF/OF") shrink to keep the fixed-width column. */
  .pos.long {
    font-size: 7.5px;
    letter-spacing: 0.01em;
  }
  /* Season label and hardware share a line when they fit; the pills wrap to a
     second line when they don't. The label never shrinks to make room for
     pills — same rule as the market rows, where the pills are the scannable
     signal and the name holds its size.
     Scoped to the row's own child: `mid` is also the WAR ladder's middle rung,
     and a bare `.mid` here reached into the row's mid-tier chip and made it a
     flex container with this rule's gap and no min-width. */
  .srow > .mid {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 6px;
    min-width: 0;
    overflow: hidden;
  }
  .yr {
    font-weight: 800;
    font-size: 13px;
    flex: none;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badges {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: none;
  }
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 7px;
    flex: none;
  }
  /* The WAR chip is one ladder in app.css — this sheet used to carry a second
     copy of it, which is how two markets drift apart. */
  /* Structural right-alignment and tint tiers, same as the market rows'
     price column. */
  .cost {
    display: inline-flex;
    justify-content: flex-end;
    font-weight: 800;
    font-size: 13px;
    white-space: nowrap;
    min-width: 56px;
  }
  .cost.cheap {
    color: var(--green);
  }
  .cost.spendy {
    color: var(--orange);
  }
</style>

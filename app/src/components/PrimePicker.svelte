<script lang="ts">
  import { loadCard, loadPlayers } from "../lib/data";
  import { isPitcher } from "../lib/eligibility";
  import type { Game } from "../lib/engine.svelte";
  import { costTier, money, posLabel, sortAwards, warTier } from "../lib/format";
  import type { CardPlayer } from "../lib/types";
  import { wrapnudge } from "../lib/wrapnudge";
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
    /** Franchise id of the season's card — the value 🏠 pricing compares
     * against `p.debut`. Team codes drift across renames (CAL → ANA); the
     * franchise id is the stable one. */
    franchise: string;
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
  /** Key of the season row awaiting confirm tap, `null` when no row is armed. */
  let armed = $state<string | null>(null);

  // The whole career loads up front (cards are ~10KB each and cached); rows
  // that fit no open seat render grayed rather than vanishing.
  $effect(() => {
    const id = playerId;
    seasons = null;
    failed = false;
    armed = null;
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
                  franchise: card.franchise,
                  year: card.year,
                  p,
                  // The engine decides, because reachability is now three
                  // rules: an open seat, an armed 🔁 with an occupied one it
                  // may vacate, and — with 🏠 armed — the intersection rule,
                  // which keeps only the debut franchise's $1M seasons live.
                  // A second copy here would drift from all three.
                  fits: game.primeFits(p, card.franchise),
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
   * would hand over the whole answer at once. The WBC medal rides the same
   * gate, MarketRow's own hardware-or-medal rule. */
  const hasBadges = (p: CardPlayer) =>
    game.showAwards &&
    (p.awards.length > 0 || p.wbc !== undefined || p.ws === true || p.pen === true);

  /** First tap arms the row; a second tap on the same row disarms it.
   * Tapping a different row arms that row instead. */
  function arm(sea: Season) {
    if (!sea.fits || sea.here) return;
    const key = `${sea.team}:${sea.year}`;
    armed = armed === key ? null : key;
  }

  /** Second tap: commit the armed season via the prime apply path.
   * try/finally, not sequential: applyPrime awaits a card fetch, and a
   * fetch that throws mid-tap would otherwise latch `busy` forever — every
   * row grayed, no error, no retry. The close belongs to success only; a
   * failed tap re-enables the rows so the next tap can try again. */
  async function commit(sea: Season) {
    if (busy) return;
    busy = true;
    try {
      await game.applyPrime(sea.team, sea.year);
      // A two-way season with more than one open seat type hands off to the
      // rail's pick-a-slot flow: the engine has already closed this sheet and
      // is holding ⭐ armed for the seat tap, so `onclose` — which disarms —
      // must not run.
      if (game.primeSlotPending) return;
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
  label="Pick a season of this player's career"
  title="⭐ PRIME TIME: {listed?.name ?? ''}"
  confirmLabel="CANCEL"
>
    {#if failed}
      <div class="picker-note">Couldn't load the career. Try again.</div>
    {:else if seasons === null}
      <!-- The notice register (☔ RAIN DELAY, 🥶 COLD STOVE): emoji + caps.
           Same string in SpecialPrimePicker — the two loading beats are one
           moment and must never drift apart. -->
      <div class="picker-note busy">🔎 CHECKING THE BACK OF THE CARD…</div>
    {:else}
      <!-- No empty state: players.json indexes every card player and every
           entry includes the card's own season, so a loaded list always has
           at least the grayed `here` row. A one-season wonder shows exactly
           that — one row, already visited. -->
      <div class="picker-list">
        {#each seasons as sea ((sea.team + sea.year))}
          {@const plabel = posLabel(sea.p)}
          {@const price = game.primePriceFor(sea.p, sea.franchise)}
          {@const key = `${sea.team}:${sea.year}`}
          {@const isArmed = armed === key}
          <div class="srow" class:dead={!sea.fits || sea.here}>
            <button class="srow-btn" disabled={!sea.fits || sea.here} onclick={() => arm(sea)}>
              <span class="pos chipbox" class:pit={isPitcher(sea.p)} class:long={plabel.length > 5}
                ><span class="chiplbl">{plabel}</span></span
              >
              <!-- The market row with one field swapped: the list leads with the
                   player's NAME, and here the player is fixed while the season
                   varies, so the lead is year + team code. Award pills follow it
                   inline and wrap to a second line on narrow phones, the same
                   badges-wrap-names-don't idiom the market rows use. Unsignable
                   rows (current card's own season, no fitting open seat) just
                   gray — no explanatory copy, same as every other gray row. -->
              <!-- wrapnudge: the market rows' wrapped-pills rebalance, at this
                   label's own 13px (1.3px = half of 0.199em at 13px).
                   freeze while armed, for the market rows' reason: arming
                   swaps the .right column (price + WAR chip) for the SIGN
                   pill, and the widths differ — unfrozen, a wrapped badge
                   line snapped back to one line for exactly the life of the
                   pill (Ichiro's decorated seasons on a phone). The clamp
                   pins .mid at its pre-arm width so the row keeps its shape
                   under the tap. -->
              <!-- The season's hardware in the FINALE SQUAD ROW'S exact order:
                   award pills → 💍/🚩 → WBC medal, all inside .badges so the
                   group wraps as one unit (Box Score only). The ring used to
                   ride the year label at the relocate tiles' 9px, which read
                   too small beside the pills and put October before the
                   awards — the finale is the order of record. -->
              <span class="mid" use:wrapnudge={{ px: 1.3, freeze: isArmed }}>
                <span class="yr">{sea.year} {sea.team}</span>
                {#if hasBadges(sea.p)}<span class="badges"
                    >{#each sortAwards(sea.p.awards) as a}<AwardPill code={a} small />{/each}{#if sea.p.ws}<span
                      class="pedi">💍</span
                    >{:else if sea.p.pen}<span class="pedi">🚩</span>{/if}{#if sea.p.wbc}<span
                      class="wbc"
                      role="img"
                      aria-label="World Baseball Classic {sea.p.wbc === 2 ? 'champion' : 'finalist'}"
                      >{sea.p.wbc === 2 ? "🥇" : "🥈"}</span
                    >{/if}</span
                  >{/if}
              </span>
              {#if !isArmed}
                <span class="right" class:lone={!game.showWar}>
                  <span class="cost {costTier(price)}">{money(price)}</span>
                  {#if game.showWar}<span class="warchip {warTier(sea.p.war)}">{sea.p.war.toFixed(1)}<span class="unit">WAR</span></span>{/if}
                </span>
              {/if}
            </button>
            {#if isArmed}
              <button
                type="button"
                class="confirm"
                disabled={busy}
                onclick={(e) => { e.stopPropagation(); void commit(sea); }}
              ><span class="chiplbl">SIGN FOR {money(price)}</span></button>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
</Sheet>

<style>
  /* Header, subtitle, ✕ and the CANCEL button all belong to Sheet — a picker
     is a thing you back out of, so its bottom button says CANCEL rather than
     CLOSE. The .picker-note and .picker-list chrome shared with
     SpecialPrimePicker lives in app.css. */
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
  .srow.dead {
    opacity: 0.45;
    cursor: default;
  }
  /* Same faded-tier idiom as the market's dead rows: identity goes
     monochrome, the WAR chip and price keep a washed but recognizable hue. */
  .srow.dead > .srow-btn > .pos,
  .srow.dead > .srow-btn > .mid {
    filter: grayscale(1);
  }
  .srow.dead .warchip,
  .srow.dead .cost {
    filter: saturate(0.7);
  }
  .srow.dead:active {
    transform: none;
  }
  /* Chipbox recipe, PlayerList's .pos exactly — see its comment. */
  .pos {
    width: 38px;
    --chip-h: 22px;
    border-radius: 7px;
    background: var(--card);
    color: var(--ink);
    border: 2px solid var(--line);
    font-weight: 800;
    font-size: 9.5px;
    letter-spacing: 0.03em;
    flex: none;
  }
  /* Filled ink, ring to match, for MarketRow's reason — the two markets'
     tags are twins. */
  .pos.pit {
    background: var(--ink);
    border-color: var(--ink);
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
     Scoped to the button's own child: `mid` is also the WAR ladder's middle
     rung, and a bare `.mid` here reached into the row's mid-tier chip and
     made it a flex container with this rule's gap and no min-width. */
  .srow-btn > .mid {
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
    /* Whole-pixel line box (13px type would inherit a fractional one), so a
       wrapped pill line below starts on the pixel grid — the pills' pinned
       whole-pixel edges are only whole if the line above them is too. */
    line-height: 16px;
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
  /* The ring/pennant wears the WBC medal's own recipe below — it sits in the
     same .badges group at the same rank, so it reads at the same size. */
  .pedi {
    font-size: 12px;
    line-height: 1;
    flex: none;
  }
  /* MarketRow's own medal recipe: whole-box glyph under the label's cap band,
     line-height 1 so the emoji's taller line box can't set the row's. */
  .wbc {
    font-size: 12px;
    line-height: 1;
    flex: none;
  }
  /* PlayerList's CHIP INSET RULE, copied whole: 10px of type-against-box air
     between salary and chip, and the chip pulled to 6px inside the row's 10px
     padding because box-against-box wants less. */
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    flex: none;
  }
  @media (min-width: 760px) {
    /* The market rows' desktop padding, so this sheet's right edge lands
       where the market's does (the chip inset rule is retired — every chip
       stops at the row's full padding, PlayerList's .right documents it). */
    .srow {
      padding: 8px 10px;
    }
  }
  /* The WAR chip is one ladder in app.css — this sheet used to carry a second
     copy of it, which is how two markets drift apart.
     Salary sits inboard; WAR chip is flush right, matching the market rows.
     Same pinned min-inline-size as PlayerList: the chip is rightmost, so its
     right edge must be consistent across values. Text stays centered in the
     box — the outer margins are the inset rule's job, not the type's. */
  .right .warchip {
    min-inline-size: 64px;
  }
  /* Structural right-alignment and tint tiers, same as the market rows' price
     column. Sits inboard of the WAR chip now (salary before WAR). */
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
  /* The confirm stops at the row's full padding, the same edge the .right
     column it replaces holds (the chip inset rule is retired). */
  .srow > .confirm {
    flex: none;
  }
</style>

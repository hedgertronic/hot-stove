<script lang="ts" module>
  import type { SpecialKey } from "../lib/engine.svelte";

  /** Compact attendance: 2,169,811 → "2.17M fans". Module-level so a caller
   * building specimen rows renders attendance through the same words. */
  export function fans(n: number): string {
    return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M fans` : `${Math.round(n / 1e3)}K fans`;
  }

  /** One tile's plain values — what a `specimen` caller supplies per row. */
  export interface SpecimenRow {
    key: SpecialKey;
    cls: string;
    ic: string;
    who: string;
    /** Inline muted meta after the name — the icon already names the type. */
    meta: string;
    val: string;
    /** Small unit after the value ("WINS" on the skipper), styled like the WAR
     * unit on the player market chips. Empty for the unitless values. */
    unit?: string;
    /** The WAR ladder's rung for this value as a bare word (`elite`, `mid`, …),
     * which turns the value into a chip. Only the skipper carries one: an owner's
     * budget and a stadium's multiplier are not on that scale. Empty draws the
     * plain right-edge value the other two tiles use. */
    tier?: string;
  }
</script>

<script lang="ts">
  import type { Game } from "../lib/engine.svelte";
  import { money, statValue, warTier } from "../lib/format";
  import { MANAGER_PER_NET_WIN } from "../lib/scoring";
  import AwardPill from "./AwardPill.svelte";

  let {
    game = null,
    confirmKey = null,
    setConfirm = () => {},
    specimen = null,
  }: {
    game?: Game | null;
    confirmKey?: string | null;
    setConfirm?: (k: string | null) => void;
    /** Plain rows for a help-sheet diagram: the same tiles, hues and anatomy,
     * rendered `inert` — no section header, no confirm flow, no taps. When
     * set, `game` is not consulted at all. */
    specimen?: SpecimenRow[] | null;
  } = $props();

  const tdArmed = $derived(game?.powerups.tradeDeadline === "armed");
  /* The intersection rule's front-office arm, mirrored from the engine's
     frontOfficeBlocks: 🏠 has no front-office targets, so while it is armed
     every tile here grays — hires, 🔁 swaps and ⭐ browsing included. */
  const hgArmed = $derived(game?.powerups.hometown === "armed");
  const canAct = $derived(game != null && game.phase === "landed" && game.choicesLeft > 0);

  interface Row extends SpecimenRow {
    /** Manager of the Year pill (award visibility: Box Score only). */
    moty?: boolean;
    /** Word on the confirm pill. Absent on specimen rows, whose confirm
     * flow never opens. */
    verb?: string;
  }

  const rows = $derived.by((): Row[] => {
    if (specimen) return specimen;
    const c = game?.card;
    if (!c || !game) return [];
    const out: Row[] = [];
    if (!game.fixedCap) {
      out.push(
        {
          key: "owner",
          cls: "",
          ic: "💰",
          who: game.ownerName,
          meta: "",
          val: money(c.budget),
          verb: "HIRE",
        },
        {
          key: "stadium",
          cls: "stad",
          ic: "🏟️",
          who: c.park,
          meta: fans(c.attendance),
          val: `×${c.stadiumMult.toFixed(2)}`,
          verb: "BUY",
        },
      );
    }
    if (c.manager != null) {
      // Eye Test withholds the record and win value entirely — they're
      // exactly the quantified signals the mode hides, and a "?" placeholder
      // would just advertise the hole. The stadium ×mult stays: it's
      // mechanical (it sets your payroll), not a scouting stat.
      // The win value reads "7.2 WINS" in a rung-colored chip — the same
      // value-then-unit-in-a-chip shape as the player market's "5.2 WAR", down
      // to the six hues. The unit says which scale this is, so a positive drops
      // the plus and a negative keeps its minus.
      // ONE MAPPING, NEVER RE-DERIVED: net wins × the scoring module's own
      // per-win rate, read through format.ts's `warTier` — the exact expression
      // the roster rail's MGR seat and the manager career sheet already use. A
      // skipper's contribution is measured in wins and the ladder is the game's
      // one scale for "how good is this", which is why the share string has
      // always printed the manager cell in the players' own six hues. Inventing
      // wins-specific breakpoints would put three ladders on one number.
      const wins = (c.wins - c.losses) * c.prorated * MANAGER_PER_NET_WIN;
      out.push({
        key: "manager",
        cls: "skip",
        ic: "🧢",
        who: c.manager,
        meta: game.scout ? "" : `${c.wins}–${c.losses}`,
        moty: game.showAwards && c.managerMoty === true,
        val: game.scout ? "" : statValue(wins),
        unit: game.scout ? "" : "WINS",
        tier: game.showWar ? warTier(wins) : "",
        verb: "HIRE",
      });
    }
    return out;
  });

  function commit(key: SpecialKey) {
    if (!game) return;
    setConfirm(null);
    if (key === "owner") game.hireOwner();
    else if (key === "stadium") game.buyStadium();
    else game.hireManager();
  }

  function commitSwap(key: SpecialKey) {
    if (!game) return;
    setConfirm(null);
    game.tdTapSpecial(key);
  }

  // Discard any live confirm when the market's shape changes — i.e., when any
  // powerup is armed or disarmed. armVersion bumps in each toggle; the effect
  // runs once on mount (no-op: confirmKey is already null) and then on each
  // subsequent bump, so powerup taps clear any open hire/swap pill.
  $effect(() => {
    if (!game) return;
    void game.armVersion;
    setConfirm(null);
  });

  function tap(row: Row, e: MouseEvent) {
    e.stopPropagation();
    if (!game || !canAct) return;
    const taken = game.specialTaken(row.key);
    // THE INTERSECTION RULE reaches the front office too: an armed 🔁 narrows
    // these tiles to its own targets (taken chairs it can trade), so an
    // untaken tile's plain hire is off the table until 🔁 disarms — the same
    // gray the market's non-candidates wear.
    if (!taken && tdArmed) return;
    // 🏠's arm of the same rule: no front-office move at all while armed —
    // the engine's frontOfficeBlocks refuses these anyway; the return keeps
    // the confirm pill from opening over a refusal.
    if (hgArmed) return;
    // ⭐ browses managers only — an armed Prime never claims the owner or
    // stadium tap, so those tiles keep their plain hire confirm.
    if (!taken && game.primeArmed) {
      if (row.key === "manager") game.primeTapSpecial(row.key);
      // Owner and stadium are grayed while Prime is armed; the tap is dead
      // even if a browser ever delivers one through the disabled button.
      return;
    }
    if (!taken) setConfirm(confirmKey === `s:${row.key}` ? null : `s:${row.key}`);
    else if (tdArmed) setConfirm(confirmKey === `w:${row.key}` ? null : `w:${row.key}`);
  }
</script>

{#if rows.length > 0 && !specimen}
  <div class="psep">FRONT OFFICE</div>
{/if}
<div class="special disp">
  {#each rows as row (row.key)}
    {@const taken = game != null && game.specialTaken(row.key)}
    <!-- A taken manager tile is only a real 🔁 target when the CARD has a
         skipper to trade in — tdTapSpecial refuses the swap otherwise, and a
         TRADE IN confirm on a tile the engine will no-op is a lie. -->
    {@const swappable =
      taken && tdArmed && !hgArmed && canAct &&
      (row.key !== "manager" || game?.card?.manager != null) &&
      !(row.key !== "manager" && game?.primeArmed === true)}
    {@const primeable =
      !taken && row.key === "manager" && game?.primeArmed === true && !tdArmed && !hgArmed && canAct}
    <!-- ⭐ browses managers only. While Prime is armed, an unhired owner or
         stadium has no move at all, so it wears the same gray the taken rows
         wear — availability is binary, and the affordance must match. A TAKEN
         owner/stadium under 🔁+⭐ grays the same way (the primeArmed clause in
         `swappable` above): a prime browse cannot take either chair, so an
         orange TRADE IN on one mid-browse is an invitation to spend 🔁 on a
         tile ⭐ was aimed at — the exact one-orange-channel ambiguity the
         market's intersection rule exists to prevent. Disarm ⭐ and the swap
         path lights again. Derived from the live primeArmed getter, so
         disarming restores the rows.
         tdBlocked is the intersection rule's front-office arm: an armed 🔁
         narrows these tiles to the taken chairs it can trade, so an untaken
         tile (whose only move is a plain hire) grays until 🔁 disarms. -->
    {@const primeBlocked = !taken && row.key !== "manager" && game?.primeArmed === true}
    {@const tdBlocked = tdArmed && canAct && !swappable}
    {@const hgBlocked = hgArmed && canAct}
    {@const sSignConfirm = confirmKey === `s:${row.key}` && !taken && !primeBlocked}
    {@const sSwapConfirm = confirmKey === `w:${row.key}` && swappable}
    <div
      class="srow {row.cls}"
      class:taken={(taken && !swappable) || primeBlocked || tdBlocked || hgBlocked}
      class:swap={swappable}
      class:prime={primeable}
      inert={specimen != null}
    >
      <button
        type="button"
        class="srow-btn"
        disabled={primeBlocked || tdBlocked || hgBlocked}
        inert={specimen != null}
        onclick={(e) => tap(row, e)}
      >
        <span class="ic">{row.ic}</span>
        <span class="mid">
          <span class="who">{row.who}</span>
          {#if row.meta}<span class="meta">{row.meta}</span>{/if}
          {#if row.moty}<AwardPill code="MOY" small />{/if}
        </span>
        {#if !sSignConfirm && !sSwapConfirm}
          <span class="val {row.tier ? `warchip ${row.tier}` : ''}">{row.val}{#if row.val && row.unit}<span class="unit">{row.unit}</span>{/if}</span>
        {/if}
      </button>
      {#if sSignConfirm}
        <button type="button" class="confirm" onclick={(e) => { e.stopPropagation(); commit(row.key); }}><span class="chiplbl">{row.val ? `${row.verb} ${row.val}${row.unit ? ` ${row.unit}` : ""}` : row.verb}</span></button>
      {:else if sSwapConfirm}
        <button type="button" class="confirm" onclick={(e) => { e.stopPropagation(); commitSwap(row.key); }}><span class="chiplbl">TRADE IN</span></button>
      {/if}
    </div>
  {/each}
</div>

<style>
  /* minmax(0, …) is the whole fix for the long-name blowout, and it is the same
     one the finale's `.ledger` carries for the same reason. An `auto` grid track
     takes its MINIMUM from its items' min-content contribution, a row's
     min-content runs through `.who`, and `.who` is `white-space: nowrap` — so
     the track's floor is the entire owner name set on one line, and the track
     grew past the screen and took every FRONT OFFICE row with it.
     The corpus decides how far past. The longest name the game can DISPLAY is
     Kansas City's 1993–2000 owner, "Greater Kansas City Community Foundation",
     which measures 291.5px in the row's own 14px/800 Nunito (the stored string
     runs 24 characters longer; `ownerFor` drops the trailing parenthetical, so
     the display form is the one that sets the floor). Montreal's 2003–04 park,
     "Stade Olympique/Hiram Bithorn Stadium", is 273.4px and carries a fans
     count beside it. Add the 38px icon column, two 9px gaps, 20px of padding
     and 5px of border and the resting owner row floors at 410px against the
     347px a 375px phone has to spend; open its confirm pill and "HIRE $203.2M"
     takes the floor to 482px, past even the 452px interior of the 480px shell.
     That is the "occasionally" in the report — the wide state is one tap away
     from the rest state.
     A floor of zero lets the track take the width it is given instead. Nothing
     downstream changes: `.mid` already carries `min-width: 0`, so once the row
     is the shell's width the name shrinks and ellipsizes as designed. That
     min-width was never the missing piece — clamping by a MINIMUM of zero can
     only raise a size, never lower an intrinsic contribution, so it governs how
     the row divides a width it has and says nothing about what width it asks
     for. The ask is a track question and it is answered here. */
  .special {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 7px;
    margin-bottom: 10px;
  }
  /* Same anatomy as the player rows (.prow): one line, fixed-width type
     column left, name that ellipsizes first, value at the right edge. */
  .srow {
    display: flex;
    align-items: center;
    gap: 9px;
    border: 2.5px solid var(--line);
    border-radius: 11px;
    background: var(--teal-2);
    border-color: var(--teal-8);
    padding: 6px 10px;
    cursor: pointer;
    transition: transform 0.08s;
    font-family: inherit;
    color: inherit;
    text-align: left;
    width: 100%;
    min-height: 46px;
  }
  @media (min-width: 760px) {
    .srow {
      /* The market rows' desktop frame — 10px horizontal, the phone's own,
         so the value column's air matches the chip gap (PlayerList's .prow
         documents the one-number rule). */
      padding: 8px 10px;
      gap: 12px;
      /* Same arithmetic as PlayerList's .prow: the manager tile's 26.275px WAR
         chip + 16px desktop padding + 5px border = 47.275px, which exceeds the
         46px floor, so the unarmed skipper row sits at 47.275px. Armed, the
         chip hides and the 24px confirm pill + 16 + 5 = 45px clamps back to
         46px — a 1.275px shrink on the manager row only (owner/stadium carry
         no chip, so their unarmed height stays below 46px and never shrinks).
         48px covers both states at the same floor. */
      min-height: 48px;
    }
  }
  .srow:active {
    transform: translate(-1px, -1px);
  }
  /* A specimen tile is a diagram: inert on the outer div blocks the active
     transform; the cursor withdraws the offer of interaction. */
  .srow[inert] {
    cursor: default;
  }
  .srow[inert]:active {
    transform: none;
  }
  /* The row tap surface (.srow-btn) reset lives in app.css: one shared rule
     for PlayerList and SpecialRows. Only the child-combinator .mid scoping
     stays here because the `mid` rung token shares the name. */
  /* The icon IS the type label — fixed width like .pos so front-office
     names align vertically with the player names below them. */
  .srow .ic {
    width: 38px;
    text-align: center;
    font-size: 19px;
    /* line-height 1 keeps the emoji's line box from outgrowing the row —
       without it the wide tier sat ~3px taller than the player rows. */
    line-height: 1;
    flex: none;
  }
  /* `mid` is also the WAR ladder's middle rung, and the skipper's chip wears
     the bare tier token — so on any manager from roughly 86–76 to 91–71 the
     value span reads `val warchip mid` and this rule would claim it. Scoped, it
     outranks the global `.warchip`, and the chip would become a flex box: a
     6px gap opening between the value and its WINS unit, the unit's baseline
     ride dropped (flex items ignore `vertical-align`), and the 42px floor gone
     to `min-width: 0`. The child combinator alone does not fence it — the chip
     is the name span's SIBLING, both direct children of the row — so excluding
     the chip by name is the fix, exactly as the manager career sheet fences the
     same collision on the same token. */
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
  .meta {
    font-size: 11px;
    /* Own leading: the body's 1.55 rhythm would size this line's box and
       float it off the row's vertical center beside .who's 1.15. */
    line-height: 1;
    color: var(--muted-2);
    font-weight: 600;
    flex: none;
  }
  /* The fans count and the skipper's record are DIGITS — they sit in the cap
     band (the optical rule in app.css), so line-box centering rides them high
     by an amount WebKit and Blink disagree on: centered on desktop Chrome,
     visibly high on an iPhone. The trim is the same measurement the chips use;
     the span is a flex item (blockified), so it lands. No fallback constant:
     on a non-trim engine the line-box centering above stands as it always has. */
  @supports (text-box: trim-both cap alphabetic) {
    .meta {
      text-box: trim-both cap alphabetic;
    }
  }
  /* `flex: none` is what makes the price column structural rather than
     incidental, matching the market rows' `.right`. Once a long name pushes the
     row to its limit, flex hands the shortfall to whichever items can shrink;
     the value is the one thing on the row that must not, or a 64-character
     owner would buy back its own space out of "$203.2M" and the FRONT OFFICE
     column would stop lining up with the PLAYERS column below it. The name
     absorbs all of it, which is the right trade — it ellipsizes and the price
     cannot. */
  .val {
    margin-left: auto;
    flex: none;
    font-weight: 800;
    white-space: nowrap;
  }
  /* The owner's budget and the stadium's multiplier are plain right-edge type
     at the row's own size. The skipper's value is not: it is a `.warchip`, and
     a chip owns its type, border, wash and 13.5px scale the way it does on
     every other row in the game. Excluding it here is what lets it — the same
     collision, and the same fix, as the career sheet's `.mid:not(.warchip)`. */
  .val:not(.warchip) {
    font-size: 14px;
  }
  /* No inset pull on the skipper's chip: it stops at the row's full
     padding, the same edge the owner's and stadium's plain-type values hold
     — one right edge down the whole front office (the chip inset rule is
     retired; PlayerList's .right documents it). */
  /* Stadium is pink, owner is teal, and neither is a WAR-chip rung color
     (the ladder runs red/gray/green/blue/violet/gold) — so neither full-row
     fill can be mistaken for a giant high-WAR chip the way the stadium's old
     sky blue could. Pink replaced a one-round orange: orange is the ARMED
     voice (armed pills, hints, and the browsable rows below), and a resting
     stadium in the action color read as something asking to be tapped. Teal
     is banknote color on the money man; it replaced a bright saturated gold
     that shouted over the whole board and crowded the --gold-2 chips. */
  .srow.stad {
    background: var(--pink-2);
    border-color: var(--pink-8);
  }
  /* The manager tile is white cardstock in --line, matching every other player
     row in the game. The wins chip is the color carrier — same six-rung ladder
     as a player's WAR, one chip per row, the chip says WHAT and HOW GOOD.
     Owner (gold) and stadium (orange) keep their identity hues because those are
     categorical: the budget and the multiplier are not on the talent scale and
     cannot be compared through a WAR chip. The skipper's contribution IS
     measurable as net wins, so the chip carries the entire color read and the
     row itself stays white. */
  .srow.skip {
    background: var(--card);
    border-color: var(--line);
  }
  /* Already gone: the market's dead-row recipe, part for part — gray card,
     0.55 opacity, identity bits (icon, name, meta) to monochrome — so the
     FRONT OFFICE and PLAYERS sections speak one "you can't have this" state.
     The skipper's wins chip keeps its hue at the same saturate(0.7) the dead
     players' WAR chips wear: a rung you already banked still reads as its
     rung. A row-level grayscale(1) here once took the chip with it, which is
     exactly the mismatch the split filters exist to prevent. */
  .srow.taken {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
    opacity: 0.55;
    cursor: default;
  }
  .srow.taken:active {
    transform: none;
  }
  .srow.taken .ic,
  .srow.taken .mid {
    filter: grayscale(1);
  }
  .srow.taken .meta,
  .srow.taken .val:not(.warchip) {
    color: var(--gray-ink);
  }
  .srow.taken .val.warchip {
    filter: saturate(0.7);
  }
  /* Armed Prime marks the open manager tile browsable with the same
     orange-dashed look the player rows use — one "tappable for a powerup"
     language, and the same orange pair the armed pill itself wears (fill and
     dash alike), so the armed control and its targets read as one flow.
     Owner and stadium tiles are never Prime targets. */
  .srow.swap,
  .srow.prime {
    background: var(--orange-2);
    border: 2.5px dashed var(--orange-8);
    color: var(--ink);
    filter: none;
  }
  .srow.swap .meta,
  .srow.prime .meta {
    color: var(--muted-2);
  }
  /* The confirm pill base recipe (border, background, padding, etc.) lives in
     app.css. Position deltas only: margin-left: auto pushes the pill to the
     right edge of the flex row and stops at the row's full padding — the
     same edge the skipper's wins chip and PlayerList's confirms hold (the
     chip inset rule is retired). */
  .confirm {
    margin-left: auto;
    flex: none;
  }
</style>

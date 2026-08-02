<script lang="ts">
  import type { Game, SpecialKey } from "../lib/engine.svelte";
  import { money, signed } from "../lib/format";
  import { MANAGER_PER_NET_WIN } from "../lib/scoring";
  import AwardPill from "./AwardPill.svelte";

  let {
    game,
    confirmKey,
    setConfirm,
  }: { game: Game; confirmKey: string | null; setConfirm: (k: string | null) => void } = $props();

  const tdArmed = $derived(game.powerups.tradeDeadline === "armed");
  const canAct = $derived(game.phase === "landed" && game.choicesLeft > 0);

  /** Compact attendance: 2,169,811 → "2.17M fans". */
  function fans(n: number): string {
    return n >= 1e6 ? `${(n / 1e6).toFixed(2)}M fans` : `${Math.round(n / 1e3)}K fans`;
  }

  interface Row {
    key: SpecialKey;
    cls: string;
    ic: string;
    who: string;
    /** Inline muted meta after the name — the icon already names the type. */
    meta: string;
    /** Manager of the Year pill (award visibility: Box Score only). */
    moty?: boolean;
    val: string;
    verb: string;
  }

  const rows = $derived.by((): Row[] => {
    const c = game.card;
    if (!c) return [];
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
      out.push({
        key: "manager",
        cls: "skip",
        ic: "🧢",
        who: c.manager,
        meta: game.scout ? "" : `${c.wins}–${c.losses}`,
        moty: game.showAwards && c.managerMoty === true,
        val: game.scout ? "" : `${signed((c.wins - c.losses) * MANAGER_PER_NET_WIN)} W`,
        verb: "HIRE",
      });
    }
    return out;
  });

  function commit(key: SpecialKey) {
    setConfirm(null);
    if (key === "owner") game.hireOwner();
    else if (key === "stadium") game.buyStadium();
    else game.hireManager();
  }

  function commitSwap(key: SpecialKey) {
    setConfirm(null);
    game.tdTapSpecial(key);
  }

  function tap(row: Row, e: MouseEvent) {
    e.stopPropagation();
    if (!canAct) return;
    const taken = game.specialTaken(row.key);
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

{#if rows.length > 0}
  <div class="psep">FRONT OFFICE</div>
{/if}
<div class="special disp">
  {#each rows as row (row.key)}
    {@const taken = game.specialTaken(row.key)}
    {@const swappable = taken && tdArmed && canAct}
    {@const primeable = !taken && row.key === "manager" && game.primeArmed && canAct}
    <!-- ⭐ browses managers only. While Prime is armed, an unhired owner or
         stadium has no move at all, so it wears the same gray the taken rows
         wear — availability is binary, and the affordance must match. A TAKEN
         owner/stadium is excluded: an armed Trade Deadline still swaps it, and
         that amber path outranks Prime's blackout. Derived from the live
         primeArmed getter, so disarming restores the rows. -->
    {@const primeBlocked = !taken && row.key !== "manager" && game.primeArmed}
    <button
      class="srow {row.cls}"
      class:taken={(taken && !swappable) || primeBlocked}
      class:swap={swappable}
      class:prime={primeable}
      disabled={primeBlocked}
      onclick={(e) => tap(row, e)}
    >
      <span class="ic">{row.ic}</span>
      <span class="mid">
        <span class="who">{row.who}</span>
        {#if row.meta}<span class="meta">{row.meta}</span>{/if}
        {#if row.moty}<AwardPill code="MOY" small />{/if}
      </span>
      {#if confirmKey === `s:${row.key}` && !taken && !primeBlocked}
        <span class="confirm" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); commit(row.key); }} onkeydown={(e) => e.key === "Enter" && commit(row.key)}>{row.val ? `${row.verb} ${row.val}` : row.verb}</span>
      {:else if confirmKey === `w:${row.key}` && swappable}
        <span class="confirm" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); commitSwap(row.key); }} onkeydown={(e) => e.key === "Enter" && commitSwap(row.key)}>🔁 TRADE IN</span>
      {:else}
        <span class="val">{row.val}</span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .special {
    display: grid;
    gap: 7px;
    margin-bottom: 10px;
  }
  /* Same anatomy as the player rows (.prow): one line, fixed-width type
     column left, name that ellipsizes first, value at the right edge. */
  .srow {
    display: flex;
    align-items: center;
    gap: 9px;
    border: 2.5px solid var(--ink);
    border-radius: 11px;
    background: var(--yellow);
    border-color: var(--gold-8);
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
      padding: 8px 14px;
      gap: 12px;
    }
  }
  .srow:active {
    transform: translate(-1px, -1px);
  }
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
  .srow.stad {
    background: var(--sky);
    border-color: var(--blue-8);
  }
  .srow.skip {
    background: var(--pink);
    border-color: var(--red-8);
  }
  /* Already gone: the warm gray pair, matching the market's dead rows, which
     is the same "you can't have this" state one section down the page. */
  .srow.taken {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
    color: var(--gray-ink);
    cursor: default;
    filter: grayscale(1);
  }
  .srow.taken:active {
    transform: none;
  }
  .srow.taken .meta,
  .srow.taken .val {
    color: var(--gray-ink);
  }
  /* Armed Prime marks the open manager tile browsable with the same
     amber-dashed look the player rows use — one "tappable for a powerup"
     language. Owner and stadium tiles are never Prime targets. */
  .srow.swap,
  .srow.prime {
    background: var(--amber);
    border: 2.5px dashed var(--ink);
    color: var(--ink);
    filter: none;
  }
  .srow.swap .meta,
  .srow.prime .meta {
    color: var(--muted-2);
  }
  /* Pinned to 24px (12 text + 8 pad + 4 border) like the player rows'
     confirm — an unconstrained line box made tapping change the row height. */
  .confirm {
    margin-left: auto;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--ink);
    color: var(--card);
    font-weight: 800;
    font-size: 12px;
    line-height: 1;
    padding: 4px 12px;
    white-space: nowrap;
  }
</style>

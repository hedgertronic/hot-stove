<script lang="ts">
  import { isPitcher } from "../lib/eligibility";
  import type { Game } from "../lib/engine.svelte";
  import { costTier, lastName, money, posLabel, sortAwards, warTier } from "../lib/format";
  import type { CardPlayer } from "../lib/types";
  import AwardPill from "./AwardPill.svelte";

  let {
    game,
    confirmKey,
    setConfirm,
  }: { game: Game; confirmKey: string | null; setConfirm: (k: string | null) => void } = $props();

  const COLLAPSED = 9;
  let expanded = $state(false);

  // Reset the expander per card.
  $effect(() => {
    void game.card;
    expanded = false;
  });

  // Box Score reads talent-first (WAR desc); Eye Test reads money-first —
  // salary is the one signal that mode deliberately shows, so the list ranks
  // by it. Below-replacement rows are filtered engine-side (visiblePlayers).
  const sorted = $derived.by(() => {
    const ps = [...game.visiblePlayers];
    if (game.scout)
      return ps.sort(
        (a, b) =>
          b.cost - a.cost ||
          lastName(a.name).localeCompare(lastName(b.name)) ||
          a.name.localeCompare(b.name),
      );
    return ps.sort((a, b) => b.war - a.war || b.cost - a.cost);
  });
  // Collapsed view keeps sort order but guarantees signable rows are visible:
  // late-game (one slot open) the eligible players would otherwise all hide
  // behind the expander, leaving a wall of gray.
  const visible = $derived.by(() => {
    if (expanded) return sorted;
    const out = sorted.slice(0, COLLAPSED);
    let open = out.filter((p) => game.playerState(p) === "open").length;
    for (const p of sorted.slice(COLLAPSED)) {
      if (open >= 3) break;
      if (game.playerState(p) === "open") {
        out.push(p);
        open++;
      }
    }
    return out;
  });

  function tap(p: CardPlayer, e: MouseEvent) {
    e.stopPropagation();
    // One gate for everything: signing, Trade Deadline swaps, and Prime Time
    // browsing all follow the same gray-out rules.
    if (!game.rowPlayable(p)) return;
    if (game.primeArmed) {
      game.primeTapPlayer(p);
      return;
    }
    // An armed Trade Deadline claims the tap even when the player also has
    // an open seat — disarm to sign plainly into the open seat instead.
    if (game.tdCandidate(p)) {
      setConfirm(confirmKey === `t:${p.id}` ? null : `t:${p.id}`);
    } else if (game.playerState(p) === "open") {
      setConfirm(confirmKey === `p:${p.id}` ? null : `p:${p.id}`);
    }
  }

  function commitSign(p: CardPlayer) {
    setConfirm(null);
    game.signPlayer(p);
  }

  function commitTrade(p: CardPlayer) {
    setConfirm(null);
    game.tdTapPlayer(p);
  }

  // Team pedigree (💍/🚩) lives beside the team name in the spin banner — the
  // rows only badge individual hardware.
  const hasBadges = (p: CardPlayer) => game.showAwards && p.awards.length > 0;
</script>

<div class="plist disp">
  {#each visible as p (p.id)}
    {@const playable = game.rowPlayable(p)}
    {@const open = game.playerState(p) === "open"}
    {@const swappable = playable && game.tdCandidate(p)}
    {@const primeable = game.primeArmed && playable}
    {@const discounted = game.discountEligible(p)}
    {@const price = game.priceFor(p)}
    {@const plabel = posLabel(p)}
    <button
      class="prow"
      class:dead={!playable}
      class:swap={swappable && !primeable}
      class:prime={primeable}
      onclick={(e) => tap(p, e)}
    >
      <span class="pos" class:pit={isPitcher(p)} class:long={plabel.length > 5}>{plabel}</span>
      <span class="mid">
        <span class="nameline">
          <span class="pname">{p.name}</span>
        </span>
        {#if hasBadges(p)}<span class="badges"
            >{#each sortAwards(p.awards) as a}<AwardPill code={a} small />{/each}</span
          >{/if}
      </span>
      <span class="right">
        {#if game.slotPick === p.id}
          <!-- The picker lives in the rail — point there, cardstock-terse. -->
          <span class="confirm hint">↑ PICK A SLOT</span>
        {:else if game.releasePick === p.id}
          <span class="confirm hint">↑ TAP WHO TO TRADE</span>
        {:else if confirmKey === `p:${p.id}` && open && !swappable && !game.primeArmed}
          <span class="confirm" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); commitSign(p); }} onkeydown={(e) => e.key === "Enter" && commitSign(p)}>SIGN {money(price)}</span>
        {:else if confirmKey === `t:${p.id}` && swappable && !game.primeArmed}
          <span class="confirm" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); commitTrade(p); }} onkeydown={(e) => e.key === "Enter" && commitTrade(p)}>TRADE FOR {money(price)}</span>
        {:else}
          {#if game.showWar}<span class="warchip {warTier(p.war)}">{p.war.toFixed(1)}<span class="unit">WAR</span></span>{/if}
          <span class="cost {discounted ? 'cheap' : costTier(price)}">{money(price)}</span>
        {/if}
      </span>
    </button>
  {/each}
  {#if !expanded && sorted.length > visible.length}
    <button class="more" onclick={(e) => { e.stopPropagation(); expanded = true; }}>
      show {sorted.length - visible.length} more ▾
    </button>
  {/if}
</div>

<style>
  .plist {
    display: grid;
    gap: 6px;
    padding-bottom: 10px;
  }
  .prow {
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
    min-height: 46px;
  }
  .prow:active {
    transform: translate(-1px, -1px);
  }
  /* Wide: the market rows are the core read — give the name/sub line and the
     chips a touch more air (phone packs them by necessity). */
  @media (min-width: 760px) {
    .prow {
      padding: 8px 14px;
      gap: 12px;
    }
  }
  /* Position is a filter cue, not the headline: a compact fixed-width tag so
     the left edge scans as a column. Pitchers flip to filled ink — one subtle
     two-way split (arms vs bats), no rainbow. */
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
  /* Name and hardware share a line when they fit; the badges wrap to a second
     line when they don't (narrow phones). The name never shrinks to make room
     for pills — a name longer than the whole row still ellipsizes via the
     nameline's max-width. */
  .mid {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 6px;
    min-width: 0;
    overflow: hidden;
  }
  .nameline {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
    max-width: 100%;
    min-width: 0;
  }
  .pname {
    font-weight: 800;
    font-size: 14px;
    line-height: 1.15;
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
  /* min-height = the WAR chip's exact height (13.5px × 1.65 line + 4px
     border), so swapping the chip+price for the shorter confirm pill can't
     change the row height — the tap must not make the card twitch. */
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 7px;
    flex: none;
    min-height: 26.3px;
  }
  /* WAR is the decision number — biggest thing on the right. The tiny unit
     label answers "4.2 what?" without competing with the number. */
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
  .warchip .unit {
    font-size: 9px;
    letter-spacing: 0.05em;
    opacity: 0.85;
    margin-left: 2.5px;
    vertical-align: 1px;
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
  .warchip.star {
    background: var(--war-star);
  }
  /* White text on gold — user's call; the gold is deepened to carry it. */
  .warchip.elite {
    background: var(--war-elite);
  }
  /* Structural right-alignment (flex, not text-align) so every engine agrees,
     and a box wide enough for "$20.5M"-class prices — the WAR chips form a
     straight column because the price column never grows. */
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
  .prow.dead {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
    opacity: 0.55;
    cursor: default;
  }
  /* A dead row still whispers its tier: the identity bits (position tag,
     name, award pills) go monochrome, but the WAR chip and salary keep their
     hue — faded by the row's opacity and a mild desaturation — so a gold you
     can't reach still reads gold ("need Trade Deadline for him"). Modes that
     hide a chip render nothing here, so nothing new leaks. */
  .prow.dead .pos,
  .prow.dead .mid {
    filter: grayscale(1);
  }
  .prow.dead .warchip,
  .prow.dead .cost {
    filter: saturate(0.7);
  }
  .prow.dead:active {
    transform: none;
  }
  .prow.dead .pos {
    background: transparent;
  }
  .prow.dead .pos.pit {
    background: var(--gray-ink);
  }
  /* TD swap targets and Prime-browsable rows share one "tappable for a
     powerup" look; the classes stay separate because the tap routes differ. */
  .prow.swap,
  .prow.prime {
    background: var(--amber);
    border: 2.5px dashed var(--ink);
    opacity: 1;
    filter: none;
  }
  /* Pinned to 24px (12 text + 8 pad + 4 border) so the pill fits the row's
     content box at both padding tiers — an unconstrained line box made
     tapping grow the row. */
  .confirm {
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
  /* Pending pick: the next tap belongs to the rail, not this row — the pill
     goes orange (the rail hint's color) and points up at it. */
  .confirm.hint {
    background: var(--orange);
    border-color: var(--ink);
  }
  .more {
    text-align: center;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--muted);
    padding: 8px 0;
    cursor: pointer;
    background: none;
    border: 0;
    font-family: inherit;
  }
</style>

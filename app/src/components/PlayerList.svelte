<script lang="ts">
  import type { Game } from "../lib/engine.svelte";
  import { costTier, lastName, money, posLabel, sortAwards, warTier } from "../lib/format";
  import type { CardPlayer } from "../lib/types";

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
    if (game.playerState(p) === "open") {
      setConfirm(confirmKey === `p:${p.id}` ? null : `p:${p.id}`);
    } else {
      // playable but no open seat ⇒ armed Trade Deadline swap target
      setConfirm(confirmKey === `t:${p.id}` ? null : `t:${p.id}`);
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

  const AWARD_CLS: Record<string, string> = {
    MVP: "mvp",
    CY: "cy",
    MVP2: "mvp",
    CY2: "cy",
    MVP3: "mvp",
    CY3: "cy",
    GG: "gg",
    SS: "ss",
    ROY: "roy",
    AS: "as",
  };
  const PILL_TEXT: Record<string, string> = {
    MVP: "🥇MVP",
    CY: "🥇CY",
    MVP2: "🥈MVP",
    CY2: "🥈CY",
    MVP3: "🥉MVP",
    CY3: "🥉CY",
  };

  function subText(p: CardPlayer, hero: boolean): string {
    const base = p.age != null ? `age ${p.age}` : "";
    if (!hero) return base;
    return base ? `${base} · 🏠 hometown` : "🏠 hometown";
  }

  const isPitcher = (p: CardPlayer) => p.pos.startsWith("SP") || p.pos === "RP";
  // Team pedigree (💍/🚩) lives beside the team name in the spin banner — the
  // rows only badge individual hardware.
  const hasBadges = (p: CardPlayer) => game.showAwards && p.awards.length > 0;
</script>

<div class="plist disp">
  {#each visible as p (p.id)}
    {@const playable = game.rowPlayable(p)}
    {@const open = game.playerState(p) === "open"}
    {@const swappable = playable && !open}
    {@const primeable = game.primeArmed && playable}
    {@const hero = game.heroEligible(p)}
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
        <span class="pname">{p.name}</span>
        {#if subText(p, hero) || hasBadges(p)}
          <span class="sub">
            {#if subText(p, hero)}<span class="age">{subText(p, hero)}</span>{/if}
            {#if hasBadges(p)}<span class="badges"
                >{#each sortAwards(p.awards) as a}<span class="qb {AWARD_CLS[a] ?? ''}">{PILL_TEXT[a] ?? a}</span>{/each}</span
              >{/if}
          </span>
        {/if}
      </span>
      <span class="right">
        {#if confirmKey === `p:${p.id}` && open && !game.primeArmed}
          <span class="confirm" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); commitSign(p); }} onkeydown={(e) => e.key === "Enter" && commitSign(p)}>SIGN {money(price)}</span>
        {:else if confirmKey === `t:${p.id}` && swappable && !game.primeArmed}
          <span class="confirm" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); commitTrade(p); }} onkeydown={(e) => e.key === "Enter" && commitTrade(p)}>TRADE FOR {money(price)}</span>
        {:else}
          {#if primeable}<span class="primetag">⭐</span>{/if}
          {#if game.showWar}<span class="warchip {warTier(p.war)}">{p.war.toFixed(1)}<span class="unit">WAR</span></span>{/if}
          <span class="cost {hero ? 'cheap' : costTier(price)}">{money(price)}</span>
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
    min-height: 54px;
  }
  .prow:active {
    transform: translate(-1px, -1px);
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
  .mid {
    display: flex;
    flex-direction: column;
    gap: 1px;
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
  /* Second line: age + hardware. Keeps the name row clean on narrow screens. */
  .sub {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    overflow: hidden;
  }
  .age {
    font-size: 10.5px;
    color: var(--muted);
    white-space: nowrap;
  }
  .badges {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: none;
  }
  .qb {
    font-size: 8.5px;
    font-weight: 800;
    border: 1.5px solid var(--ink);
    border-radius: 999px;
    padding: 0 5px;
    line-height: 1.5;
  }
  .qb.mvp {
    background: var(--yellow);
  }
  .qb.cy {
    background: var(--sky);
  }
  .qb.gg {
    background: var(--green-wash);
  }
  .qb.ss {
    background: var(--lilac);
  }
  .qb.roy {
    background: var(--pink);
  }
  .qb.as {
    background: var(--amber);
  }
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 7px;
    flex: none;
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
  .cost {
    font-weight: 800;
    font-size: 13px;
    white-space: nowrap;
    min-width: 50px;
    text-align: right;
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
    filter: grayscale(1);
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
  .prow.swap {
    background: var(--amber);
    border: 2.5px dashed var(--ink);
    opacity: 1;
    filter: none;
  }
  .prow.prime {
    background: var(--amber);
    border: 2.5px dashed var(--ink);
    opacity: 1;
    filter: none;
  }
  .primetag {
    font-size: 13px;
  }
  .confirm {
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--ink);
    color: var(--card);
    font-weight: 800;
    font-size: 12px;
    padding: 4px 12px;
    white-space: nowrap;
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

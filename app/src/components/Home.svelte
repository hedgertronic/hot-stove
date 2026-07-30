<script lang="ts">
  import {
    BLANK_CHECK_BUDGET_M,
    MONEYBALL_BUDGET_M,
    type Bank,
    type Difficulty,
    type GameConfig,
  } from "../lib/engine.svelte";
  import { money } from "../lib/format";
  import { GOAL_POINTS } from "../lib/scoring";
  import { bestFor } from "../lib/settings";

  let { config, onplay }: { config: GameConfig; onplay: (c: GameConfig) => void } = $props();

  // Seed once from the saved settings; the rows edit local state until PLAY.
  // svelte-ignore state_referenced_locally
  let difficulty = $state<Difficulty>(config.difficulty);
  // svelte-ignore state_referenced_locally
  let bank = $state<Bank>(config.bank);

  const DIFFS: { key: Difficulty; ic: string; name: string; desc: string }[] = [
    { key: "standard", ic: "🔥", name: "Standard", desc: "WAR, salaries & awards on every card" },
    { key: "scout", ic: "🔭", name: "Scout", desc: "No stats, no salaries — pure name recognition" },
  ];
  /** Each bank card explains itself with the two pills the mode locks or leaves
   * open: Classic spins for its owner + stadium; the fixed caps come pre-signed. */
  const BANKS: {
    key: Bank;
    ic: string;
    name: string;
    pills: { txt: string; cls: string }[];
    cap: string;
  }[] = [
    {
      key: "classic",
      ic: "💼",
      name: "Classic",
      pills: [
        { txt: "💰 OWNER", cls: "open" },
        { txt: "🏟️ STADIUM", cls: "open" },
      ],
      cap: "spin for your cap",
    },
    {
      key: "moneyball",
      ic: "⚾",
      name: "Moneyball",
      pills: [
        { txt: "💰 ’02 A’S", cls: "oak" },
        { txt: "🏟️ ’02 A’S", cls: "oak" },
      ],
      cap: money(MONEYBALL_BUDGET_M),
    },
    {
      key: "blankcheck",
      ic: "💸",
      name: "Blank Check",
      pills: [
        { txt: "💰 ’05 YANKS", cls: "nyy" },
        { txt: "🏟️ ’05 YANKS", cls: "nyy" },
      ],
      cap: money(BLANK_CHECK_BUDGET_M),
    },
  ];

  const DIFF_ICON: Record<Difficulty, string> = { standard: "🔥", scout: "🔭" };
  const BANK_ICON: Record<Bank, string> = { classic: "💼", moneyball: "⚾", blankcheck: "💸" };

  const best = $derived(bestFor(difficulty, bank));
  const comboLabel = $derived(
    `${DIFF_ICON[difficulty]} ${difficulty === "standard" ? "STANDARD" : "SCOUT"} · ${BANK_ICON[bank]} ${
      bank === "classic" ? "CLASSIC" : bank === "moneyball" ? "MONEYBALL" : "BLANK CHECK"
    }`,
  );
</script>

<div class="home disp">
  <div class="mast">
    <div class="biglogo">HOT<em>STOVE</em></div>
    <div class="tag">Spin for a team-season. Sign the right players. Beat the cap.</div>
  </div>

  <div class="psep">DIFFICULTY</div>
  <div class="seg two">
    {#each DIFFS as d (d.key)}
      <button class="segbtn" class:on={difficulty === d.key} onclick={() => (difficulty = d.key)}>
        <span class="ic">{d.ic}</span>
        <span class="segname">{d.name}</span>
        <span class="segdesc">{d.desc}</span>
      </button>
    {/each}
  </div>

  <div class="psep">BANKROLL</div>
  <div class="seg three">
    {#each BANKS as b (b.key)}
      <button
        class="segbtn bank"
        class:on={bank === b.key}
        class:mb={b.key === "moneyball"}
        class:bc={b.key === "blankcheck"}
        onclick={() => (bank = b.key)}
      >
        <span class="ic">{b.ic}</span>
        <span class="segname">{b.name}</span>
        <span class="pillcol">
          {#each b.pills as p}
            <span class="mini {p.cls}">{p.txt}</span>
          {/each}
        </span>
        <span class="segcap">{b.cap}</span>
      </button>
    {/each}
  </div>

  <button class="btn hot playbtn" onclick={() => onplay({ difficulty, bank })}> PLAY 🔥 </button>

  <div class="bestbox">
    <div class="best-h">PERSONAL BEST — {comboLabel}</div>
    {#if best.best !== null}
      <div class="best-n">
        {best.best.toFixed(1)}<span class="best-goal"> / GOAL {GOAL_POINTS}</span>
      </div>
      <div class="best-sub">{best.games} {best.games === 1 ? "game" : "games"} played</div>
    {:else}
      <div class="best-n empty">—<span class="best-goal"> / GOAL {GOAL_POINTS}</span></div>
      <div class="best-sub">no games yet in this mode — set the bar</div>
    {/if}
  </div>
</div>

<style>
  .home {
    padding-top: 7vh;
  }
  .mast {
    text-align: center;
    margin-bottom: 24px;
  }
  .biglogo {
    font-weight: 800;
    font-size: 34px;
    letter-spacing: 0.01em;
  }
  .biglogo em {
    font-style: normal;
    color: var(--orange);
  }
  .tag {
    font-size: 12.5px;
    font-weight: 700;
    color: var(--muted);
    margin-top: 4px;
  }
  .seg {
    display: grid;
    gap: 7px;
    margin-bottom: 14px;
  }
  .seg.two {
    grid-template-columns: 1fr 1fr;
  }
  .seg.three {
    grid-template-columns: repeat(3, 1fr);
  }
  .segbtn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    border: 2.5px dashed var(--gray-ink);
    border-radius: 11px;
    background: transparent;
    padding: 10px 6px 9px;
    cursor: pointer;
    transition: transform 0.08s;
    font-family: inherit;
    color: var(--muted);
  }
  .segbtn:active {
    transform: translate(-1px, -1px);
  }
  .segbtn.on {
    border: 2.5px solid var(--ink);
    background: var(--card);
    color: var(--ink);
  }
  .segbtn.on.mb {
    background: var(--green-wash);
  }
  .segbtn.on.bc {
    background: var(--yellow);
  }
  .ic {
    font-size: 19px;
    line-height: 1.1;
  }
  .segname {
    font-weight: 800;
    font-size: 12.5px;
    line-height: 1.2;
    white-space: nowrap;
  }
  .segdesc {
    font-size: 10px;
    font-weight: 700;
    line-height: 1.3;
    color: var(--muted);
    max-width: 150px;
  }
  .pillcol {
    display: flex;
    flex-direction: column;
    gap: 3px;
    width: 100%;
    margin-top: 2px;
  }
  .mini {
    border: 1.5px dashed var(--gray-ink);
    border-radius: 999px;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: 0.03em;
    padding: 2px 0;
    text-align: center;
    white-space: nowrap;
    color: var(--muted);
    background: transparent;
  }
  .mini.oak {
    border: 1.5px solid var(--ink);
    background: #003831;
    color: #efb21e;
  }
  .mini.nyy {
    border: 1.5px solid var(--ink);
    background: #0c2340;
    color: #fffdf6;
  }
  .segcap {
    font-size: 10px;
    font-weight: 800;
    margin-top: 1px;
  }
  .segbtn:not(.on) .segcap {
    color: var(--muted);
  }
  .playbtn {
    width: 100%;
    min-height: 48px;
    margin-top: 4px;
    font-size: 16px;
  }
  .bestbox {
    margin-top: 14px;
    border: 2.5px solid var(--ink);
    border-radius: 12px;
    background: var(--card);
    padding: 9px 12px 10px;
    text-align: center;
  }
  .best-h {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--muted);
  }
  .best-n {
    font-size: 26px;
    font-weight: 800;
    line-height: 1.2;
    margin-top: 2px;
  }
  .best-n.empty {
    color: var(--gray-ink);
  }
  .best-goal {
    font-size: 12px;
    font-weight: 800;
    color: var(--muted);
  }
  .best-sub {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
  }
</style>

<script lang="ts">
  import type { Difficulty, GameConfig } from "../lib/engine.svelte";
  import { loadHistory } from "../lib/settings";

  let { config, onplay }: { config: GameConfig; onplay: (c: GameConfig) => void } = $props();

  // Seed once from the saved settings; the rows edit local state until PLAY.
  // svelte-ignore state_referenced_locally
  let difficulty = $state<Difficulty>(config.difficulty);
  // svelte-ignore state_referenced_locally
  let moneyball = $state(config.moneyball);

  interface DiffRow {
    key: Difficulty;
    ic: string;
    name: string;
    blurb: string;
  }
  const DIFFS: DiffRow[] = [
    { key: "rookie", ic: "🐣", name: "Rookie", blurb: "Everything visible — award badges too" },
    { key: "standard", ic: "🔥", name: "Standard", blurb: "WAR + salary. Awards hidden till the finale" },
    { key: "scout", ic: "🔭", name: "Scout", blurb: "Trad stat lines only. No WAR, no prices" },
    { key: "eyetest", ic: "🕶️", name: "Eye Test", blurb: "Names and positions. Draft from memory" },
  ];

  const hist = loadHistory();
  const last = hist.at(-1);
  const best = hist.reduce((m, h) => Math.max(m, h.total), 0);
</script>

<div class="home disp">
  <div class="mast">
    <div class="biglogo">HOT<em>STOVE</em></div>
    <div class="tag">Spin for a team-season. Sign the right players. Beat the cap.</div>
  </div>

  <div class="psep">DIFFICULTY</div>
  <div class="picker">
    {#each DIFFS as d (d.key)}
      <button class="mrow" class:on={difficulty === d.key} onclick={() => (difficulty = d.key)}>
        <span class="ic">{d.ic}</span>
        <span class="mid">
          <span class="mname">{d.name}</span>
          <span class="mblurb">{d.blurb}</span>
        </span>
        <span class="tick">{difficulty === d.key ? "✓" : ""}</span>
      </button>
    {/each}
  </div>

  <div class="psep">MODE</div>
  <div class="picker">
    <button class="mrow mb" class:on={moneyball} onclick={() => (moneyball = !moneyball)}>
      <span class="ic">⚾</span>
      <span class="mid">
        <span class="mname">Moneyball</span>
        <span class="mblurb">2002 A’s hard cap — $82.9M, no owners, no stadiums</span>
      </span>
      <span class="tick">{moneyball ? "✓" : ""}</span>
    </button>
  </div>

  <button class="btn hot playbtn" onclick={() => onplay({ difficulty, moneyball })}>
    PLAY 🔥
  </button>

  {#if last}
    <div class="hist">
      Last: {last.record} · {last.total.toFixed(1)} pts
      {#if hist.length > 1}&nbsp;·&nbsp; Best: {best.toFixed(1)}{/if}
    </div>
  {/if}
</div>

<style>
  .home {
    padding-top: 8vh;
  }
  .mast {
    text-align: center;
    margin-bottom: 26px;
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
  .picker {
    display: grid;
    gap: 7px;
    margin-bottom: 14px;
  }
  .mrow {
    display: flex;
    align-items: center;
    gap: 9px;
    border: 2.5px dashed var(--gray-ink);
    border-radius: 11px;
    background: transparent;
    padding: 7px 10px;
    cursor: pointer;
    transition: transform 0.08s;
    font-family: inherit;
    color: var(--muted);
    text-align: left;
    width: 100%;
    min-height: 52px;
  }
  .mrow:active {
    transform: translate(-1px, -1px);
  }
  .mrow.on {
    border: 2.5px solid var(--ink);
    background: var(--card);
    color: var(--ink);
  }
  .mrow.mb.on {
    background: var(--green-wash);
  }
  .ic {
    font-size: 19px;
  }
  .mid {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .mname {
    font-weight: 800;
    font-size: 13.5px;
    line-height: 1.2;
  }
  .mblurb {
    font-size: 11px;
    font-weight: 600;
  }
  .mrow.on .mblurb {
    color: var(--muted-2);
  }
  .tick {
    margin-left: auto;
    font-weight: 800;
    font-size: 16px;
    color: var(--green);
  }
  .playbtn {
    width: 100%;
    min-height: 48px;
    margin-top: 6px;
    font-size: 16px;
  }
  .hist {
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    margin-top: 12px;
  }
</style>

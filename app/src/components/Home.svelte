<script lang="ts">
  import type { Bank, Difficulty, GameConfig } from "../lib/engine.svelte";
  import { loadHistory } from "../lib/settings";

  let { config, onplay }: { config: GameConfig; onplay: (c: GameConfig) => void } = $props();

  // Seed once from the saved settings; the rows edit local state until PLAY.
  // svelte-ignore state_referenced_locally
  let difficulty = $state<Difficulty>(config.difficulty);
  // svelte-ignore state_referenced_locally
  let bank = $state<Bank>(config.bank);

  interface Opt<K> {
    key: K;
    ic: string;
    name: string;
    blurb: string;
  }
  const DIFFS: Opt<Difficulty>[] = [
    { key: "standard", ic: "🔥", name: "Standard", blurb: "WAR, salaries, and award badges all visible" },
    { key: "scout", ic: "🔭", name: "Scout", blurb: "Trad stat lines + salaries. No WAR, no badges" },
    { key: "eyetest", ic: "🕶️", name: "Eye Test", blurb: "Names only. Draft from memory" },
  ];
  const BANKS: Opt<Bank>[] = [
    { key: "classic", ic: "💼", name: "Classic", blurb: "Build your bankroll: hire an owner, buy a stadium" },
    { key: "moneyball", ic: "⚾", name: "Moneyball", blurb: "2002 A’s hard cap — $82.9M, no owners" },
    { key: "blankcheck", ic: "💸", name: "Blank Check", blurb: "2005 Yankees money — $248.6M, spend it" },
  ];

  const diffBlurb = $derived(DIFFS.find((d) => d.key === difficulty)!.blurb);
  const bankBlurb = $derived(BANKS.find((b) => b.key === bank)!.blurb);

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
  <div class="seg">
    {#each DIFFS as d (d.key)}
      <button class="segbtn" class:on={difficulty === d.key} onclick={() => (difficulty = d.key)}>
        <span class="ic">{d.ic}</span>
        <span class="segname">{d.name}</span>
      </button>
    {/each}
  </div>
  <div class="blurb">{diffBlurb}</div>

  <div class="psep">BANKROLL</div>
  <div class="seg">
    {#each BANKS as b (b.key)}
      <button class="segbtn" class:on={bank === b.key} class:mb={b.key === "moneyball"} class:bc={b.key === "blankcheck"} onclick={() => (bank = b.key)}>
        <span class="ic">{b.ic}</span>
        <span class="segname">{b.name}</span>
      </button>
    {/each}
  </div>
  <div class="blurb">{bankBlurb}</div>

  <button class="btn hot playbtn" onclick={() => onplay({ difficulty, bank })}>
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
  .seg {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 7px;
  }
  .segbtn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    border: 2.5px dashed var(--gray-ink);
    border-radius: 11px;
    background: transparent;
    padding: 9px 4px 8px;
    cursor: pointer;
    transition: transform 0.08s;
    font-family: inherit;
    color: var(--muted);
    min-height: 62px;
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
    font-size: 12px;
    line-height: 1.2;
    white-space: nowrap;
  }
  .blurb {
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    margin: 7px 0 14px;
    min-height: 14px;
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

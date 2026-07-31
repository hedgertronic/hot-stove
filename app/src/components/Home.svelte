<script lang="ts">
  import { type Bank, type Difficulty, type GameConfig } from "../lib/engine.svelte";
  import { parseSeedCode } from "../lib/format";
  import { BANKS, DIFFICULTIES } from "../lib/modes";
  import { bestFor } from "../lib/settings";
  import Logo from "./Logo.svelte";

  let {
    config,
    onplay,
  }: { config: GameConfig; onplay: (c: GameConfig, seed?: number) => void } = $props();

  // Seed once from the saved settings; the rows edit local state until PLAY.
  // svelte-ignore state_referenced_locally
  let difficulty = $state<Difficulty>(config.difficulty);
  // svelte-ignore state_referenced_locally
  let bank = $state<Bank>(config.bank);

  // Picker rows come straight from the shared mode table; each fixed-cap card
  // shows its team pill over its payroll pill, Owner's Box only a dashed one.
  const DIFFS = (Object.keys(DIFFICULTIES) as Difficulty[]).map((key) => ({
    key,
    ...DIFFICULTIES[key],
  }));
  const BANK_CARDS = (Object.keys(BANKS) as Bank[]).map((key) => ({ key, ...BANKS[key] }));

  const best = $derived(bestFor(difficulty, bank));

  // PLAY A SEED: a shared code replays that game's exact card sequence
  // under whatever mode combo is selected above.
  let seedOpen = $state(false);
  let seedInput = $state("");
  let seedBad = $state(false);

  function playSeed() {
    const seed = parseSeedCode(seedInput);
    if (seed === null) {
      seedBad = true;
      setTimeout(() => (seedBad = false), 450);
      return;
    }
    onplay({ difficulty, bank }, seed);
  }
</script>

<div class="home disp">
  <div class="mast">
    <Logo big />
  </div>

  <div class="psep">DIFFICULTY</div>
  <div class="seg two">
    {#each DIFFS as d (d.key)}
      <button class="segbtn" class:on={difficulty === d.key} onclick={() => (difficulty = d.key)}>
        <span class="ic">{d.emoji}</span>
        <span class="segname">{d.name}</span>
        <span class="segdesc">{d.desc}</span>
      </button>
    {/each}
  </div>

  <div class="psep">PAYROLL</div>
  <div class="seg three">
    {#each BANK_CARDS as b (b.key)}
      <button
        class="segbtn bank"
        class:on={bank === b.key}
        class:mb={b.key === "moneyball"}
        class:bc={b.key === "blankcheck"}
        onclick={() => (bank = b.key)}
      >
        <span class="ic">{b.emoji}</span>
        <span class="segname">{b.name}</span>
        <span class="pillrow">
          {#if b.team}<span class="pill team {b.cls}">{b.team}</span>{/if}
          <span class="pill cash {b.cls}">{b.cash}</span>
        </span>
      </button>
    {/each}
  </div>

  <button class="btn hot playbtn" onclick={() => onplay({ difficulty, bank })}> PLAY 🔥 </button>

  {#if seedOpen}
    <div class="seedrow" class:bad={seedBad}>
      <span class="seedhash">#</span>
      <input
        class="seedin"
        type="text"
        maxlength="8"
        placeholder="KF12OY"
        autocapitalize="characters"
        autocomplete="off"
        spellcheck="false"
        bind:value={seedInput}
        onkeydown={(e) => e.key === "Enter" && playSeed()}
      />
      <button class="seedgo" onclick={playSeed}>GO</button>
    </div>
  {:else}
    <button class="seedlink" onclick={() => (seedOpen = true)}>PLAY A SEED #</button>
  {/if}

  <!-- The bests card is a section like DIFFICULTY/PAYROLL — its name and games
       count live in the dashed separator, not inside the card. -->
  <div class="psep bestsep">RECORD BOOK · {best.games} {best.games === 1 ? "GAME" : "GAMES"}</div>
  <div class="bestbox">
    <div class="best-cols">
      <div class="best-col">
        <div class="best-n" class:empty={best.bestRecord === null}>{best.bestRecord ?? "—"}</div>
        <div class="best-cap">BEST RECORD</div>
      </div>
      <div class="best-col">
        <div class="best-n" class:empty={best.best === null}>{best.best?.toFixed(1) ?? "—"}</div>
        <div class="best-cap">BEST SCORE</div>
      </div>
    </div>
  </div>
</div>

<style>
  .home {
    padding-top: 7vh;
  }
  /* Wide: the home screen is a menu, not a workspace — it stays a centered
     card-width column instead of stretching into the wide shell. */
  @media (min-width: 760px) {
    .home {
      max-width: 540px;
      margin: 0 auto;
    }
  }
  .mast {
    text-align: center;
    margin-bottom: 24px;
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
  /* flex:1 + centering keeps Owner's Box's single pill balanced against the
     two-pill fixed-cap cards in the same grid row. */
  .pillrow {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-top: 3px;
    flex: 1;
  }
  .pill {
    display: inline-block;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding: 3px 12px;
    white-space: nowrap;
  }
  .pill.open {
    border: 2px dashed var(--gray-ink);
    color: var(--muted);
    background: transparent;
  }
  .pill.cash:not(.open) {
    border: 2px solid var(--ink);
    background: var(--card);
    color: var(--ink);
  }
  .pill.team.oak {
    border: 2px solid var(--ink);
    background: #003831;
    color: #efb21e;
  }
  .pill.team.nyy {
    border: 2px solid var(--ink);
    background: #0c2340;
    color: #fffdf6;
  }
  .playbtn {
    width: 100%;
    min-height: 48px;
    margin-top: 4px;
    font-size: 16px;
  }
  .seedlink {
    display: block;
    margin: 8px auto 0;
    background: none;
    border: 0;
    font-family: inherit;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--muted);
    cursor: pointer;
    padding: 4px 8px;
  }
  .seedrow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 8px;
  }
  .seedrow.bad {
    animation: seedshake 0.45s;
  }
  .seedrow.bad .seedin {
    border-color: var(--orange);
    color: var(--orange);
  }
  @keyframes seedshake {
    20%,
    60% {
      transform: translateX(-4px);
    }
    40%,
    80% {
      transform: translateX(4px);
    }
  }
  .seedhash {
    font-weight: 800;
    font-size: 13px;
    color: var(--muted);
  }
  .seedin {
    width: 110px;
    border: 2px dashed var(--gray-ink);
    border-radius: 9px;
    background: var(--card);
    color: var(--ink);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: center;
    padding: 5px 8px;
    outline: none;
  }
  .seedin:focus {
    border-style: solid;
    border-color: var(--ink);
  }
  .seedgo {
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--ink);
    color: var(--card);
    font-family: inherit;
    font-weight: 800;
    font-size: 11px;
    padding: 5px 12px;
    cursor: pointer;
  }
  /* The separator carries the section's 8px bottom padding, like the others. */
  .bestsep {
    margin-top: 14px;
  }
  .bestbox {
    border: 2.5px solid var(--ink);
    border-radius: 12px;
    background: var(--card);
    padding: 9px 12px 10px;
    text-align: center;
  }
  .best-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .best-col + .best-col {
    border-left: 2px dashed var(--dash);
  }
  .best-n {
    font-size: 24px;
    font-weight: 800;
    line-height: 1.2;
  }
  .best-n.empty {
    color: var(--gray-ink);
  }
  .best-cap {
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--muted);
    margin-bottom: 3px;
  }
</style>

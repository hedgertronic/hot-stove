<script lang="ts">
  import { accentFor } from "../lib/data";
  import type { Game } from "../lib/engine.svelte";
  import { Rng } from "../lib/rng";
  import type { Colors } from "../lib/types";

  let { game, colors }: { game: Game; colors: Colors } = $props();

  let yrEl: HTMLElement | undefined = $state();
  let tmEl: HTMLElement | undefined = $state();
  let display = $state<{ yr: string; tm: string; color: string } | null>(null);
  let landedAnim = $state(false);
  let running = false;

  const reduced =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cardView = $derived.by(() => {
    if (game.phase === "spinning") return display;
    const c = game.card;
    if (!c) return null;
    return { yr: String(c.year), tm: c.name, color: accentFor(colors, c.franchise) };
  });

  function pulse(ms: number) {
    for (const el of [yrEl, tmEl]) {
      el?.animate(
        [{ transform: "translateY(-30%)", opacity: 0.35 }, { transform: "none", opacity: 1 }],
        { duration: Math.min(ms * 0.9, 240), easing: "ease-out" },
      );
    }
  }

  // The banner itself is the reel: cosmetic flicker from a throwaway RNG so the
  // game stream stays untouched, decelerating ticks, overshoot thunk on landing.
  $effect(() => {
    if (game.phase !== "spinning" || running) return;
    running = true;
    landedAnim = false;
    const cosmetic = new Rng(Date.now() >>> 0);
    const land = async () => {
      await game.land();
      landedAnim = true;
      running = false;
    };
    if (reduced) {
      void land();
      return;
    }
    let delay = 70;
    const step = () => {
      const e = cosmetic.pick(game.index.cards);
      display = { yr: String(e.year), tm: e.name, color: accentFor(colors, e.franchise) };
      pulse(delay);
      delay *= 1.14;
      if (delay < 480) setTimeout(step, delay);
      else setTimeout(() => void land(), delay);
    };
    step();
  });
</script>

<div class="banner disp" class:landed={landedAnim} class:stale={game.phase === "preSpin" && !!game.card}>
  {#if cardView}
    <div class="bline">
      <span class="yr" bind:this={yrEl} style:background={cardView.color}>{cardView.yr}</span>
    </div>
    <div class="bline">
      <div class="tname" bind:this={tmEl} style:color={cardView.color}>{cardView.tm}</div>
    </div>
    {#if game.phase === "landed" && game.card}
      <div class="tmeta">
        {game.card.wins}–{game.card.losses}{game.card.prorated !== 1 ? " ✱" : ""}
      </div>
    {/if}
  {:else}
    <div class="bline"><span class="yr idle">····</span></div>
    <div class="bline"><div class="tname idle">HOT STOVE</div></div>
  {/if}
</div>

{#if game.phase === "preSpin"}
  <button class="btn hot spinbtn disp" onclick={() => game.spin()}>SPIN 🔥</button>
{:else if game.coldStove}
  <div class="cold disp">
    <div class="coldmsg">🥶 COLD STOVE — nothing left to take here</div>
    <button
      class="btn spinbtn disp"
      onclick={() => {
        game.coldRespin();
        game.spin();
      }}>SPIN AGAIN — FREE</button
    >
  </div>
{:else if game.phase === "landed" && game.choicesUsed > 0 && game.choicesLeft > 0}
  <button class="btn donebtn disp" onclick={() => game.finishSpin()}>DONE — SPIN ▸</button>
{/if}

<style>
  .banner {
    text-align: center;
    margin-bottom: 8px;
  }
  .banner.landed {
    animation: thunk 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .banner.stale {
    opacity: 0.45;
    filter: grayscale(0.6);
  }
  @keyframes thunk {
    0% {
      transform: scale(1.08) rotate(-1deg);
    }
    100% {
      transform: none;
    }
  }
  .bline {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
  }
  .yr {
    display: inline-block;
    background: var(--blue);
    color: var(--card);
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 1px 12px;
    font-weight: 800;
    font-size: 12px;
  }
  .yr.idle {
    background: var(--gray-bg);
    color: var(--gray-ink);
  }
  .tname {
    font-size: 23px;
    font-weight: 800;
    line-height: 1.15;
  }
  .tname.idle {
    color: var(--gray-ink);
  }
  .tmeta {
    font-size: 11.5px;
    color: var(--muted);
    margin-top: 1px;
  }
  .spinbtn {
    width: 100%;
    margin: 4px 0 12px;
    min-height: 48px;
  }
  .donebtn {
    width: 100%;
    margin: 4px 0 10px;
    font-size: 13px;
    padding: 7px 12px;
  }
  .cold {
    text-align: center;
    margin: 4px 0 12px;
  }
  .coldmsg {
    font-size: 12px;
    font-weight: 800;
    color: var(--muted);
    margin-bottom: 6px;
  }
</style>

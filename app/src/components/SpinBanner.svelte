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
  /** The spin this banner has already started a reel for, so the reel effect
   * runs once per spin however often it re-runs — its first tick writes
   * `display`, which swaps the idle banner for the real one and rebinds the two
   * elements `pulse` reads.
   *
   * A plain `running` boolean did that job and could not do this one: undo is
   * live mid-reel, and an abandoned reel leaves the flag up until its own land
   * resolves seconds later. The spin the player takes straight after a rewind
   * arrives inside that window, is refused as "already running", and shows no
   * reel at all — a still banner until a leftover timer from the abandoned spin
   * drops the card in at a time that belongs to neither. Keyed on
   * `game.spinEpoch`, a stale reel finishing says nothing about the one now in
   * flight. -1 is "no reel yet"; the engine's epoch starts at 0.
   *
   * Plain, not `$state`, for the reason `running` was plain: the reel effect
   * both reads and writes it, and a reactive field would retrigger the effect
   * it is there to gate. */
  let reelEpoch = -1;

  const reduced =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const cardView = $derived.by(() => {
    if (game.phase === "spinning") return display;
    const c = game.card;
    if (!c) return null;
    return { yr: String(c.year), tm: c.name, color: accentFor(colors, c.franchise) };
  });

  function pulse(ms: number, kind: "full" | "year" | "team") {
    const els = kind === "year" ? [yrEl] : kind === "team" ? [tmEl] : [yrEl, tmEl];
    for (const el of els) {
      el?.animate(
        [{ transform: "translateY(-30%)", opacity: 0.35 }, { transform: "none", opacity: 1 }],
        { duration: Math.min(ms * 0.9, 240), easing: "ease-out" },
      );
    }
  }

  // The stove never idles: a committed pick rolls the next card immediately.
  // There is no beat between the two. The reel that follows is itself two
  // seconds of transition, so a pause in front of it added no sense of the
  // pick landing — it only delayed the reel, which reads as buffering.
  // Still deferred by a turn of the event loop rather than called straight:
  // spin() writes the very phase this effect reads, and writing it inside the
  // effect's own run is a self-triggering loop.
  //
  // One spin end is not a committed pick: resuming onto a half-used ✌️ Double
  // Play forfeits the pick that never happened and ends the spin during boot
  // (see Game.resumedForfeit). At zero delay that card is gone on the first
  // frame — the player who armed Double Play, took one pick and came back sees
  // only a reel to somewhere else, which is exactly "Double Play didn't work".
  // That end gets the beat, with the notice below on screen to spend it on;
  // the pick the player DID commit still rolls with no pause at all.
  const RESUME_HOLD = 1600;
  $effect(() => {
    if (game.phase !== "preSpin") return;
    const t = setTimeout(() => game.spin(), game.resumedForfeit ? RESUME_HOLD : 0);
    return () => clearTimeout(t);
  });

  // The flicker chain reschedules itself — each tick books the next — so it
  // outlives the run that started it unless the handles are collected.
  // Quitting mid-reel unmounts this banner with a tick still booked, and that
  // tick reads `game.phase` off a game the app has already let go; the chain's
  // own phase guard cannot cover that, because the read IS the guard.
  //
  // Cancelling belongs to the component's life, NOT to the reel effect's
  // teardown. That effect re-runs on its own during a spin — the first tick
  // writes `display`, which swaps the idle banner for the real one and rebinds
  // the two elements `pulse` reads — and a teardown there would cancel the
  // authoritative land timer on the game's very first spin, freezing the reel
  // forever. The effect below reads nothing, so it runs once and its teardown
  // is the unmount.
  let reelTimers: ReturnType<typeof setTimeout>[] = [];
  function cancelReel() {
    for (const t of reelTimers) clearTimeout(t);
    reelTimers = [];
  }
  $effect(() => cancelReel);

  // The banner itself is the reel: cosmetic flicker from a throwaway RNG so the
  // game stream stays untouched, decelerating ticks, overshoot thunk on landing.
  // Season Ticket and Relocate skip the reel entirely — the chosen card lands
  // instantly with one pulse on the half that changed.
  $effect(() => {
    const epoch = game.spinEpoch;
    if (game.phase !== "spinning" || reelEpoch === epoch) return;
    reelEpoch = epoch;
    landedAnim = false;
    const kind = game.spinKind;
    // Every deferred step of this reel is gated on the epoch it started with.
    // Undo is live mid-reel and bumps the epoch, so a rewound spin's timers,
    // flicker ticks and parked land all find their spin gone and say nothing —
    // the engine refuses their writes, and these refuse to animate over a card
    // the player has already come back to.
    const current = () => game.spinEpoch === epoch;
    const land = async () => {
      const prevName = game.card?.name;
      await game.land();
      if (!current()) return;
      // Fetch failed (connection dropped): the reel freezes and the retry
      // button takes over — retry() re-runs this landing, not the effect.
      if (game.loadFailed) return;
      landedAnim = true;
      // A Season Ticket crossover (Expos↔Nationals) changes the club name on a
      // "year" spin — pulse both halves so the rename doesn't appear silently.
      const renamed = kind === "year" && game.card?.name !== prevName;
      if (kind !== "full" && !reduced) pulse(260, renamed ? "full" : kind);
    };
    if (reduced || kind !== "full") {
      void land();
      return;
    }
    const cosmetic = new Rng(Date.now() >>> 0);
    const pool = game.index.cards;
    // One authoritative timer lands the card; the decelerating flicker chain is
    // pure cosmetics and simply stops early if the browser throttles timers
    // (a throttled chain once stretched a 2s spin to 14s).
    let delay = 50;
    let total = 320;
    for (let d = delay; d < 320; d *= 1.16) total += d;
    // Each reel owns the handles it opens (see reelTimers). Anything still
    // booked when a new reel starts belongs to a spin that has landed, been
    // rewound, or been throttled past its own end — none of them have anything
    // left to say.
    cancelReel();
    reelTimers.push(setTimeout(() => void land(), total));
    const step = () => {
      if (game.phase !== "spinning" || !current()) return;
      const e = cosmetic.pick(pool);
      display = { yr: String(e.year), tm: e.name, color: accentFor(colors, e.franchise) };
      pulse(delay, "full");
      delay *= 1.16;
      if (delay < 320) reelTimers.push(setTimeout(step, delay));
    };
    step();
  });

  async function retry() {
    // The reel effect's own epoch check, in the one place outside it that
    // awaits a land. Undo is live on a stranded RAIN DELAY spin and clears
    // `loadFailed` with everything else, so without this a rewind taken while
    // the retry fetch is in flight would thunk the banner over the card the
    // player has already come back to.
    const epoch = game.spinEpoch;
    game.retrySpin();
    await game.land();
    if (game.spinEpoch !== epoch) return;
    if (game.loadFailed) return; // still offline — the button stays
    landedAnim = true;
  }
</script>

<div class="banner disp" class:landed={landedAnim} class:stale={game.phase === "preSpin" && !!game.card}>
  {#if cardView}
    <div class="bline">
      <!-- The club's accent goes in as a variable, not as a background: the
           pill derives BOTH its rungs from it (see .yr). -->
      <span class="yr chipbox" bind:this={yrEl} style:--accent={cardView.color}><span class="chiplbl">{cardView.yr}</span></span>
    </div>
    <div class="bline team">
      <div class="tname" bind:this={tmEl} style:color={cardView.color}>{cardView.tm}</div>
      <!-- Team pedigree shows in every mode: it's franchise history, not a stat
           leak, and 💍/🚩 players score in Eye Test too. -->
      {#if game.phase === "landed" && game.card}
        {#if game.card.ws}<span class="pedigree" title="Won the World Series">💍</span>
        {:else if game.card.pen}<span class="pedigree" title="Won the pennant">🚩</span>{/if}
      {/if}
    </div>
  {:else}
    <div class="bline"><span class="yr idle chipbox"><span class="chiplbl">····</span></span></div>
    <div class="bline team"><div class="tname idle">HOT STOVE</div></div>
  {/if}
</div>

{#if game.loadFailed}
  <div class="cold disp">
    <!-- ☔ RAIN DELAY: baseball's own word for "play stopped, we wait, we
         resume" — which is exactly what a dropped card fetch is. ONE pill,
         message and action fused: a bare line of muted caps floating over a
         button read as no surface of the game's, and the message here has
         no job except to be tapped. Capsule-sized like SHOW N MORE, not the
         big spin button — a retry is a small recovery (SPIN AGAIN · FREE
         below keeps the big button; it IS the spin). The chipbox recipe
         seats the all-caps label on center; the bare-text version rode the
         cap band 0.0235em high like any uncorrected capsule. -->
    <button
      class="retry chipbox disp"
      onclick={retry}
      aria-label="Rain delay — the card didn't come through. Tap to retry."
      ><span class="chiplbl">☔ RAIN DELAY · TAP TO RETRY</span></button
    >
  </div>
{:else if game.coldStove}
  <div class="cold disp">
    <div class="coldmsg">🥶 COLD STOVE: nothing left to take here</div>
    <button class="btn spinbtn disp" onclick={() => game.coldRespin()}>SPIN AGAIN · FREE</button>
  </div>
{:else if game.resumedForfeit}
  <!-- The other two notices offer a button because the player has a decision
       left; this one has none — the spin is already over and the reel is on a
       timer — so it is a line of copy and nothing else. It names the powerup
       and says it came back, because a refunded ✌️ that vanishes without a
       word is indistinguishable from a broken one. -->
  <div class="cold disp">
    <div class="coldmsg">✌️ DOUBLE PLAY REFUNDED — the reload took pick two</div>
  </div>
{/if}
<!-- Mid-Double-Play (one pick down, one live) has no separate finish button:
     tapping the armed ✌️ pill is the one exit, refunding the powerup — the
     same toggle the player armed it with. -->

<style>
  .banner {
    text-align: center;
    margin-bottom: 12px;
  }
  .banner.landed {
    animation: thunk 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  /* No rule for `.stale`, deliberately. The half-second between a committed
     pick and the next roll used to drain the banner — grayscale and half
     opacity — and it read as a fault rather than a beat: a card going gray is
     what an UNAVAILABLE card does everywhere else in the game, so the one
     thing still on screen looked broken at the exact moment the pick landed.
     The market, the powerups and the front-office rows have already left by
     then, which says "that spin is over" without the banner saying it twice.
     The class stays on the element as a hook for that state. */
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
  .bline.team {
    margin-top: 8px;
  }
  /* The spun year is a club color, so it takes the pair like everything else —
     except that its hue arrives at runtime from colors.json and can't be looked
     up in :root. The two rungs are derived from it instead: the fill is the
     accent thinned into the cardstock, the border is the accent at full
     strength. Every one of the 30 franchise accents is already a dark,
     saturated color (3.30:1 on the ground at the lightest, 11.91:1 at the
     darkest), which is exactly what a rung-8 line has to be — so the accent
     itself IS the line and only the wash has to be computed.
     --blue is the fallback for a pill that renders before an accent arrives. */
  /* Centered by the box, not by the line box — through app.css's chipbox
     recipe (markup class, digits in a .chiplbl) rather than by hand. The
     pill used to carry its own measured constant (a top-only 1.16px nudge,
     twice the 0.58px error desktop measured), and that constant was only
     ever right on the engine it was measured on: iOS WebKit seats the same
     baseline differently and the digits rode visibly LOW on a phone. The
     recipe's trim branch measures the cap band per engine instead, and its
     fallback spends the one shared 0.047em constant — never this pill's own.
     25.55px is exactly the height the pill has always occupied, pinned
     because the banner's two lines have a fixed rhythm and the reel
     animates this element. */
  .yr {
    --chip-h: 25.55px;
    --accent: var(--blue);
    background: color-mix(in srgb, var(--accent) 18%, var(--card));
    border: 2px solid var(--accent);
    color: var(--ink);
    border-radius: 999px;
    padding-inline: 14px;
    font-weight: 800;
    font-size: 13px;
  }
  /* Nothing spun yet: the warm gray pair, which is already a fill and its own
     darker line. */
  .yr.idle {
    --accent: var(--gray-ink);
    background: var(--gray-bg);
    color: var(--gray-ink);
  }
  .tname {
    font-size: 24px;
    font-weight: 800;
    line-height: 1.15;
  }
  .tname.idle {
    color: var(--gray-ink);
  }
  .pedigree {
    font-size: 15px;
  }
  .spinbtn {
    width: 100%;
    margin: 4px 0 12px;
    min-height: 48px;
  }
  /* PlayerList's .more capsule, verbatim — the two are the board's small
     tap-to-continue voice (both sized to the powerup pills' base recipe). */
  /* The chipbox recipe carries the box (inline-flex, pinned height, cap
     seating); this block is the capsule dress — SHOW N MORE's own numbers
     (10.5px/800/0.04em, 11px inline pad, 2px --line ring on --card), at the
     confirm pills' 24px pin. Centered by .cold's text-align, so no width
     games. */
  .retry {
    --chip-h: 24px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--ink);
    margin: 6px 0 12px;
    padding-inline: 11px;
    cursor: pointer;
    background: var(--card);
    border: 2px solid var(--line);
    border-radius: 999px;
    transition: transform 0.08s;
  }
  .retry:active {
    transform: translateY(2px);
  }
  .retry:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
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

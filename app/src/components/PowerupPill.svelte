<script lang="ts">
  /** One powerup pill, and the only place one is drawn.
   *
   * Extracted for RailSeat's reason: the game board drew these and the help
   * sheet drew a hand-copied lookalike, and a specimen that drifts from the
   * control it teaches is worse than no specimen. Both now render this.
   *
   * FOUR STATES, and the caller names one rather than passing three booleans:
   *   · ready  — usable right now
   *   · armed  — waiting on the tap it asked for, orange
   *   · off    — usable, but not on this spin (dimmed, inert)
   *   · spent  — gone for the game (dimmer still, inert)
   * `off` and `spent` are deliberately different opacities: one is "not yet"
   * and one is "never again", and a player has to be able to tell which.
   *
   * WHAT IT DOES NOT KNOW. Nothing about other powerups. Powerups combine —
   * ⭐ + 🏠, or 🔁 + 🏠 + ⭐, arm together and stay armed together — and a
   * cross-powerup condition reaching into a pill's own state is how exclusivity
   * would creep back in unnoticed. Restrictions on what an armed combination
   * can DO belong to the engine and the market rows, where they can be stated
   * once for every surface.
   *
   * A pill with no `onclick` renders as a `<span>` rather than a dead button:
   * the help sheet's specimens are a diagram, and a focusable control that does
   * nothing promises an action the sheet cannot deliver.
   *
   * THE CONTAINER QUERY at the foot of this file needs an ancestor declaring
   * `container-type: inline-size`. Every caller sets it on the row that holds
   * the pills; without one the pill silently stays at base size, and on a
   * 390px phone that is the difference between a 3+3 lattice and a wrap. */
  let {
    label,
    state = "ready",
    onclick,
  }: {
    /** Emoji and words, as one string — the powerup's whole name. Armed labels
     * instruct the next tap and trail an ellipsis ("⭐ TAP A PLAYER…"). */
    label: string;
    state?: "ready" | "armed" | "off" | "spent";
    onclick?: (e: MouseEvent) => void;
  } = $props();
</script>

{#if onclick}
  <button
    class="pp"
    class:spent={state === "spent"}
    class:off={state === "off"}
    class:armed={state === "armed"}
    {onclick}><span class="lb">{label}</span></button
  >
{:else}
  <span
    class="pp"
    class:spent={state === "spent"}
    class:off={state === "off"}
    class:armed={state === "armed"}><span class="lb">{label}</span></span
  >
{/if}

<style>
  .pp {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    text-align: center;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    padding: 5px 11px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: transform 0.08s;
    font-family: inherit;
    color: inherit;
    position: relative;
  }
  /* If an armed label ever outgrows its row, the pill shrinks and the label
     ellipsizes inside it; the ::after tap extension stays unclipped. */
  .lb {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Invisible extension grows the tap target without growing the pill. Capped
     at half the 8px row spacing so adjacent lines' targets meet but never
     overlap (a later pill's extension would otherwise cover the pill above). */
  .pp::after {
    content: "";
    position: absolute;
    inset: -4px 0;
  }
  .pp:active {
    transform: translateY(1.5px);
  }
  .pp.spent {
    opacity: 0.32;
    cursor: default;
  }
  .pp.spent:active {
    transform: none;
  }
  .pp.off {
    opacity: 0.55;
    cursor: default;
  }
  .pp.armed {
    background: var(--orange-2);
    border-color: var(--orange-8);
    color: var(--ink);
  }
  /* The six ready labels need ~393px at the base type size — just over a
     390px phone's 362px content box. One modest type tier, keyed to the
     row's ACTUAL width (container query, not viewport), keeps the 3+3
     lattice on standard phones. Armed labels are longer and may still wrap;
     the two-row structure keeps every wrap's spacing uniform. (This block
     must sit after the base .pp rule — equal specificity, source order
     decides.) */
  @container (max-width: 400px) {
    .pp {
      font-size: 10px;
      padding: 5px 8px;
      letter-spacing: 0.02em;
    }
  }
</style>

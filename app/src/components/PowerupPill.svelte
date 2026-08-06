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
   * 390px phone that is the difference between a 3+3 lattice and a wrap.
   *
   * ARM ANIMATION. When `label` changes (arm/disarm), the CSS `transition:
   * width` interpolates between the old and new widths — the same technique
   * CornerButtons' UNDO? pill uses, except that pill pins a fixed number while
   * these pills vary. The $effect below measures the label's scrollWidth after
   * every DOM update and pins it as an explicit pixel width on the pill element,
   * giving the transition two concrete numbers to interpolate. `calc-size` and
   * `interpolate-size` (the CSS-only approaches to `width: auto` animation) are
   * not used because Safari does not support them. The measurement reads the
   * actual computed padding and border via `getComputedStyle`, so it
   * self-corrects at every container-query tier without a resize observer. The
   * ::after tap extension and the ellipsis fallback are unaffected: the pill's
   * width is merely pinned, not restructured. */
  // The prop stays `state` for every caller; the LOCAL name is aliased away
  // because `$state(...)` in a scope where `state` is a variable parses as a
  // store auto-subscription of that variable — which is also why the DOM refs
  // below could not be runes until the alias existed.
  let {
    label,
    state: mode = "ready",
    onclick,
  }: {
    /** Emoji and words, as one string — the powerup's whole name. Armed labels
     * instruct the next tap and trail an ellipsis ("⭐ TAP A PLAYER…"). */
    label: string;
    state?: "ready" | "armed" | "off" | "spent";
    onclick?: (e: MouseEvent) => void;
  } = $props();

  let pillEl = $state<HTMLElement | undefined>();
  let lbEl = $state<HTMLElement | undefined>();

  // After every `label` change: measure the label span's scrollWidth and pin it
  // as an explicit pixel width on the pill so `transition: width` has two
  // concrete numbers to interpolate rather than animating from auto.
  //
  // `void label` is the explicit reactive dependency — when label changes
  // (arm/disarm), Svelte re-runs this effect and picks up the new scrollWidth.
  // scrollWidth reads the full content width even when `.lb` clips via
  // `overflow: hidden`. getComputedStyle reads the ACTUAL padding and border
  // after the container query may have adjusted them, so the measurement
  // self-corrects at every width without a resize observer.
  // Only runs in the browser — $effect never fires during SSR.
  //
  // TWO STALENESS PATHS the label dependency cannot see, both re-measured:
  //  · the bundled Nunito swaps in AFTER first mount (font-display: swap), and
  //    a width measured against the fallback face is wrong for the life of the
  //    pill — document.fonts.ready is the signal that the real glyphs landed;
  //  · a resize can cross the container-query tier below, which changes the
  //    pill's own padding and type size while the label stays put.
  $effect(() => {
    void label;
    if (!pillEl || !lbEl) return;
    const pill = pillEl;
    const lb = lbEl;
    const measure = () => {
      const cs = getComputedStyle(pill);
      const pw = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const bw = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      // +1 covers scrollWidth's integer truncation. The real run is fractional
      // (letter-spacing at 10.5px type lands on tenths), scrollWidth floors it,
      // and text-overflow fires its ellipsis on ANY shortfall — measured live,
      // a 73.4px label in a 73px pin ellipsized. One invisible pixel of slack
      // beats a visible "RELOCA…" on every pill.
      pill.style.width = `${lb.scrollWidth + pw + bw + 1}px`;
    };
    measure();
    let stale = false;
    document.fonts?.ready.then(() => {
      if (!stale) measure();
    });
    window.addEventListener("resize", measure);
    return () => {
      stale = true;
      window.removeEventListener("resize", measure);
    };
  });
</script>

{#if onclick}
  <button
    bind:this={pillEl}
    class="pp chipbox"
    class:spent={mode === "spent"}
    class:off={mode === "off"}
    class:armed={mode === "armed"}
    {onclick}><span class="lb chiplbl" bind:this={lbEl}>{label}</span></button
  >
{:else}
  <span
    bind:this={pillEl}
    class="pp chipbox"
    class:spent={mode === "spent"}
    class:off={mode === "off"}
    class:armed={mode === "armed"}><span class="lb chiplbl" bind:this={lbEl}>{label}</span></span
  >
{/if}

<style>
  .pp {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    /* The $effect pins an explicit width, which would otherwise outrank flex
       shrink — this clamp is what keeps the documented safety below true: a
       pinned pill can never grow past its row, so an over-long armed label
       still ellipsizes instead of overflowing the lattice. */
    max-width: 100%;
    text-align: center;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    /* The pill is a chip (the `chipbox` class in its markup, the label a
       `.chiplbl`), so its caps are seated by the recipe rather than by the
       page's line box: as a padding-driven box the label rode the engine's
       baseline seat — measured by the render probe at 0.9px high in Chrome
       and 0.3px in Safari, one rule, two rides. The pinned heights are the
       old 5px pair's outcomes at each tier's type, landed on whole pixels
       (30.3 / 29.5 / 28.7 natural). Vertical geometry only: the 7px row gap
       and the ::after tap extension are untouched. */
    --chip-h: 30px;
    padding-inline: 11px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    /* Width transitions alongside transform so arming/disarming eases rather
       than snapping. The $effect pins an explicit pixel width after each label
       change, giving the transition two concrete values to interpolate — the
       same approach CornerButtons' UNDO? pill uses, but measured rather than
       pinned, because powerup labels vary in length. app.css kills both
       transitions for prefers-reduced-motion readers. */
    transition:
      width 0.12s ease,
      transform 0.08s;
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
  /* On trim engines the label's box IS the cap band, and `overflow: hidden`
     (the ellipsis clamp above) clips to it — which slices the ink an emoji
     carries above the cap line: measured live, WebKit cut the ⭐'s top point
     flat. The pair below re-arms the clamp without moving any type: padding
     extends the clip edge past the emoji's ascent, the equal negative margin
     hands the layout box straight back to the cap band, so flex centering
     still lands on the measured caps and the emoji hangs into the padding,
     visible. 0.35em clears the platform emoji faces' ~0.15em of ink beyond
     the cap line with margin to spare. AwardPill solves this by splitting
     the emoji out of its `.chiplbl` instead; this label is one prop string
     that the arm animation measures and the clamp ellipsizes WHOLE, so it
     stays one element and pays the clip margin here. Scoped to this file:
     no other .chiplbl clips. */
  @supports (text-box: trim-both cap alphabetic) {
    .lb {
      padding-block: 0.35em;
      margin-block: -0.35em;
    }
  }
  /* Invisible extension grows the tap target without growing the pill. Capped
     at half the 7px row spacing (PowerupRow's one gap number) so adjacent
     lines' targets meet but never overlap (a later pill's extension would
     otherwise cover the pill above). */
  .pp::after {
    content: "";
    position: absolute;
    inset: -3.5px 0;
  }
  /* Only the wired pill is an offer: the span variant is a diagram, and a
     pointer cursor on it would promise a tap that does nothing. */
  button.pp {
    cursor: pointer;
  }
  button.pp:active {
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
  /* THE LATTICE TIERS, keyed to the row's ACTUAL width (container query, not
     viewport) and measured live rather than estimated. The widest resting row
     (✌️ 🔁 🏠) needs 396px at base size, ~355px at the middle tier, and
     ~327px at the small one — so base holds a 430pt phone's 402px box only
     just, and the middle tier alone left every 360–375pt phone wrapping to
     three lines. The 410px boundary buys the base tier real margin instead of
     6px, and the 390px tier is what keeps the 3+3 lattice on real phones.
     390, NOT 360: the numbers above are desktop-Chrome measurements, and iOS
     renders Nunito and its emoji a few px wider per pill — a 393pt iPhone's
     365px box wrapped on-device with the middle tier's paper margin of 9px.
     The small tier's ~38px of slack there is what survives the metric drift.
     Armed labels are longer and may still wrap; the two-row structure keeps
     every wrap's spacing uniform. (These blocks must sit after the base .pp
     rule and in descending order — equal specificity, source order decides.) */
  @container (max-width: 410px) {
    .pp {
      --chip-h: 30px;
      font-size: 10px;
      padding-inline: 8px;
      letter-spacing: 0.02em;
    }
  }
  @container (max-width: 390px) {
    .pp {
      --chip-h: 29px;
      font-size: 9.5px;
      padding-inline: 6px;
      letter-spacing: 0.01em;
    }
  }
</style>

<script lang="ts">
  /** One chair in the squad — a player seat or the manager's — and the only
   * place either is drawn.
   *
   * It exists because there were two of them. `RosterRail` drew the live rail
   * and `HelpModal` drew a hand-copied lookalike so the help sheet could show a
   * seat without wiring itself to a `Game`, and a specimen that drifts from the
   * screen it teaches is worse than no specimen at all. The seat is now one
   * component with plain props, so the sheet shows the real thing and the
   * copies cannot come apart.
   *
   * PLAIN VALUES ONLY. No `Game`, no `Signed`, no `warTier` call — the caller
   * has already decided what this chair says and which rung it wears, because
   * only the caller knows about difficulty modes. Eye Test passes `tier: ""`
   * and `war: null`, and the seat then has no rung to leak.
   *
   * The root element IS the seat, so a caller's grid or flex row places it
   * directly; there is no wrapper to reason about.
   *
   * WHAT LIVES HERE AND WHAT DOES NOT. Everything about a chair — its frame,
   * its rungs, its two geometries, the WAR numeral that appears at width — is
   * in this file. The rail's own concerns (the grid, the phone pin, the section
   * header) stay with the rail, because they are about the ARRANGEMENT of
   * chairs rather than about a chair. */
  let {
    chair = "cell",
    label,
    name = null,
    meta = null,
    tier = "",
    war = null,
    mgw = false,
    pickable = false,
    onclick,
  }: {
    /** `cell` is one of the eight player seats; `mgr` is the sideways chair
     * that anchors the left edge of the phone grid. */
    chair?: "cell" | "mgr";
    /** The position, or the manager's 🧢. The only thing an empty seat shows,
     * and on the manager's chair a glyph rather than a word: it does the "this
     * row is a different KIND of thing" job the sideways geometry already
     * starts, and the career sheet labels his seasons with the same cap. */
    label: string;
    /** Display name — already shortened by the caller. Null is an empty seat. */
    name?: string | null;
    /** The season line under the name: "1995 ATL". */
    meta?: string | null;
    /** The WAR rung as a bare word (`elite`, `mid`, …), or "" for no rung at
     * all. The seat reads `war-${tier}`, which sets app.css's --rung pair and
     * dresses fill and frame from the one value. The numeral carries the bare
     * word too, as a hook with no rule behind it — it is ink on every rung. */
    tier?: string;
    /** The numeral as it should read — "5.2", "+14.0 W". Null draws none. */
    war?: string | null;
    /** Marks the manager's numeral. A hook with no rule behind it: see the note
     * at the foot of the media query for why the absence is deliberate. */
    mgw?: boolean;
    /** Armed by the release picker — amber, dashed, and nudging. Only a player
     * seat is ever pickable; the manager is hired in the front office row. */
    pickable?: boolean;
    onclick?: () => void;
  } = $props();

  const rung = $derived(tier === "" ? "" : `war-${tier}`);
  /** The manager's chair labels itself with a glyph, and an emoji announces as
   * its Unicode name ("billed cap"), so the spoken name is carried separately:
   * `role="img"` is the one role a generic element takes that honours
   * `aria-label`. A player seat's label is a position code — real text — and
   * takes neither. */
  const spoken = $derived(chair === "mgr" ? { role: "img", "aria-label": "Manager" } : {});
</script>

{#if pickable}
  <button class="cell pickable {rung}" class:vacant={!name} {onclick}>
    <b>{label}</b>
    {#if name}<span>{name}</span><i>{meta}</i>
      {#if war}<em class="rwar {tier}">{war}</em>{/if}
    {/if}
  </button>
{:else if name}
  <div class="{chair} filled {rung}">
    <b {...spoken}>{label}</b><span>{name}</span><i>{meta}</i>
    {#if war}<em class="rwar {tier}" class:mgw>{war}</em>{/if}
  </div>
{:else}
  <div class="{chair} empty"><b {...spoken}>{label}</b></div>
{/if}

<style>
  /* Flex centering: the type stack is shorter than the 52px seat, and a block
     container would park it at the top — the leftover space belongs half
     above, half below. */
  .cell {
    border: 2.5px solid var(--rung-line, var(--line));
    border-radius: 9px;
    background: var(--card);
    text-align: center;
    padding: 5px 2px;
    font-size: 10px;
    line-height: 1.25;
    min-height: 52px;
    font-family: inherit;
    color: inherit;
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
  }
  /* The WAR numeral lives on the finale-style wide rows only; the sideways
     phone seat has no room for it, and the phone grid reads as a who/when
     card. No hardware anywhere in the rail — the seats carry name and season,
     nothing else, and the manager's MOY pill waits for the finale. */
  .rwar {
    display: none;
  }
  /* ---------- the rung ----------
     A seat with someone in it is a COMMITTED row, so it wears its WAR bucket as
     fill AND frame — the hue's wash inside the hue's line, the same object every
     WAR chip in the game is. Both halves come from the pair app.css's `war-*`
     class sets, so no hue is named here and no ladder is enumerated: the frame
     spends --rung-line in the two border shorthands (`.cell` above, `.mgr`
     below) and the wash is the one declaration here. Untiered, both fall back to
     card white inside --line — which is exactly what Eye Test and an unhired
     chair already are, so the mode cannot leak a read through a color.

     FILLED ONLY, and that is the state-vs-value question settled rather than
     traded. A player cell's fill is also the ARMED channel: the release picker
     turns it amber, dashes it and nudges it, and an armed elite seat has to say
     "tappable" before it says "5.2 WAR". It never has to choose, because it
     never wears both classes — the armed branch of the template renders
     `cell pickable`, never `filled`, so these two rules cannot meet on one
     element. Source order is the backstop if they ever do: `.cell.pickable`
     weighs the same and sits below.
     The FRAME is a different channel and stays lit while armed: an armed elite
     seat is a dashed gold rectangle over amber, tier and state at once. An EMPTY
     seat is not committed and takes neither — dashed --line over nothing.

     WHAT THE WASH COSTS THE SUB-LINES. A filled seat sits on whichever of six
     washes its rung supplies, and violet-2 is the darkest of them:
     --muted measures 3.39:1 there against 4.37:1 for --muted-2, on 8.5–9px type.
     So both chairs' label and season lines run --muted-2 — one token, chosen for
     the worst rung, and the sub-lines then read the same on all six. */
  .cell.filled,
  .mgr.filled {
    background: var(--rung-fill, var(--card));
  }
  .cell b {
    display: block;
    font-size: 9px;
    letter-spacing: 0.07em;
    color: var(--muted-2);
  }
  .cell span {
    display: block;
    font-weight: 800;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cell i {
    display: block;
    font-style: normal;
    font-size: 8.5px;
    color: var(--muted-2);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* An empty seat is an invitation: just the position, centered, waiting. */
  .cell.empty {
    border-style: dashed;
    background: transparent;
    color: var(--gray-ink);
    display: grid;
    place-content: center;
  }
  .cell.empty b {
    font-size: 11px;
    color: var(--gray-ink);
  }
  .cell.pickable {
    background: var(--amber);
    border-style: dashed;
    cursor: pointer;
    animation: nudge 1s ease-in-out infinite;
  }
  .cell.pickable.vacant {
    display: grid;
    place-content: center;
  }
  @keyframes nudge {
    50% {
      transform: translateY(-2px);
    }
  }
  /* The manager reads bottom-to-top up the left rail (y-axis-label style,
     glyphs facing the grid) — three parallel lines, label outermost, same
     content pattern and type scale as the player seats. The width is fixed
     so the grid doesn't reflow when the empty seat gains its name/season
     lines on hire; it equals the seat cells' min-height, a geometric match
     between the rotated chair and the upright ones.
     The grid placement is here rather than with the rail's own grid because it
     is a fact about the CHAIR — it is the only seat that spans two rows — and
     a caller laying seats out in a flex column (the help sheet, and the rail
     itself at width) simply ignores it.
     THE CHAIR OPENS THE CARD AT BOTH WIDTHS, and neither width needs a rule for
     it: callers render the manager first, so the flex column takes him first by
     DOM order, and the phone grid pins him to column one across both rows. The
     skipper is above the roster while the club is being built and stays there
     once he is hired, which is the one thing the two geometries have to agree
     on. */
  .mgr {
    grid-column: 1;
    grid-row: 1 / 3;
    width: 52px;
    border: 2.5px solid var(--rung-line, var(--line));
    border-radius: 9px;
    writing-mode: sideways-lr;
    text-align: center;
    padding: 4px 5px;
    line-height: 1.3;
    overflow: hidden;
  }
  /* The chair's label is a GLYPH where the player seats' is a position code, so
     it answers to different type rules. A cap reads at its whole box and a code
     reads at its cap band, so 9px — legible as three tracked letters — is a
     speck as an emoji; and the tracking that separates P·O·S adds a phantom gap
     after a single glyph, so it goes. `line-height: 1` is the same guard the
     career sheet's 🧢 carries: the emoji face's line box stands taller than
     Nunito's and would push the three stacked lines past the chair's 40px of
     content. 13 + 14.3 + 11 = 38.3px against that 40px, so the cap can grow
     without the season line clipping. */
  .mgr b {
    display: block;
    font-size: 13px;
    line-height: 1;
    letter-spacing: normal;
    color: var(--muted-2);
  }
  .mgr span {
    display: block;
    font-weight: 800;
    font-size: 11px;
    max-height: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mgr i {
    display: block;
    font-style: normal;
    font-size: 8.5px;
    color: var(--muted-2);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-height: 100%;
  }
  .mgr.empty {
    border-style: dashed;
    background: transparent;
    color: var(--gray-ink);
    display: grid;
    place-content: center;
  }
  /* An unhired chair is nothing but its label, so the cap grows the way an
     empty player seat's position code does — and it keeps the glyph's own
     leading, because there is no name line under it to protect. */
  .mgr.empty b {
    font-size: 15px;
    color: var(--gray-ink);
  }
  /* Wide: the seat becomes one full-width row of the finale's squad card —
     pos · name · season · WAR, upright, the manager included. Same markup,
     same states; only the geometry changes.
     Keyed to the VIEWPORT, not to a container, because the caller's column
     width is not the thing that decides this: the rail earns its 350–380px
     column at exactly the width the whole page re-lays out at, and the help
     sheet is the same sheet at every size. One breakpoint, one geometry. */
  @media (min-width: 760px) {
    .cell,
    .mgr {
      writing-mode: horizontal-tb;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      text-align: left;
      width: 100%;
      min-height: 36px;
      padding: 6px 10px;
      line-height: 1.25;
      overflow: hidden;
    }
    /* The 34px label column is what aligns every row's second field, so both
       chairs keep it; only the type differs, for the same reason it does on the
       phone — a position code is tracked 9.5px caps and the manager's cap is a
       glyph, which reads at its box. */
    .cell b,
    .mgr b {
      width: 34px;
      flex: none;
      font-size: 9.5px;
    }
    .mgr b {
      font-size: 15px;
      letter-spacing: normal;
    }
    .cell span,
    .mgr span {
      font-size: 13px;
      flex: 0 1 auto;
      min-width: 0;
    }
    .cell i,
    .mgr i {
      font-size: 11px;
      flex: 0 1 auto;
      min-width: 0;
    }
    .cell.empty,
    .cell.pickable.vacant,
    .mgr.empty {
      display: flex;
      place-content: unset;
    }
    .cell.empty b,
    .mgr.empty b {
      font-size: 9.5px;
      color: var(--gray-ink);
      width: 34px;
    }
    /* An unhired chair is a full-width row here rather than a bare glyph, so
       the cap holds the same 15px as a hired one — the empty rows' smaller type
       is a phone rule, and this one only takes its color and its column. */
    .mgr.empty b {
      font-size: 15px;
    }
    /* Nothing stands down here any more: the numeral returns at the width that
       has room for it, beside a border that says the same tier at both widths.
       INK, on every rung, which is app.css's rule for type on a rung-2 fill
       rather than anything about this seat — the finale's squad rows and the
       manager career sheet's rows read the same way. The seat's fill IS that
       wash now, and a numeral tinted to match it runs 2.17:1 to 3.77:1 at 13px
       where ink runs 9.52:1 at worst. The rung is said twice already, by the
       fill and by the frame; the numeral's job is the number.
       The `tier` and `mgw` classes stay on the element as hooks with no rule
       behind them. `mgw`'s absence is load-bearing: the manager used to be
       pinned to flat --green here, which outweighed nothing and sat last, so it
       silently won and any tiering above it did nothing. */
    .rwar {
      display: block;
      margin-left: auto;
      flex: none;
      font-style: normal;
      font-weight: 800;
      font-size: 13px;
      color: var(--ink);
    }
  }
</style>

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
    pickable = false,
    specimen = false,
    onclick,
  }: {
    /** `cell` is one of the eight player seats; `mgr` is the sideways chair
     * that anchors the left edge of the phone grid. */
    chair?: "cell" | "mgr";
    /** The position code, or "MGR" on the manager's chair — a word in the same
     * column the player seats track their codes in. */
    label: string;
    /** Display name — already shortened by the caller. Null is an empty seat. */
    name?: string | null;
    /** The season line under the name: "1995 ATL". */
    meta?: string | null;
    /** The WAR rung as a bare word (`elite`, `mid`, …), or "" for no rung at
     * all. The seat reads `war-${tier}`, app.css's fact-carrier class: it sets
     * the --rung pair and paints nothing — the seat itself stays white
     * cardstock in --line, and the .warchip inside inherits the pair and is
     * the one surface that wears it. */
    tier?: string;
    /** The chip's value as it should read — "5.2", "+14.0". Bare, no unit:
     * these rows are too small for a WAR/WINS suffix. Null draws no chip. */
    war?: string | null;
    /** Armed by the release picker — amber, dashed, and nudging. Only a player
     * seat is ever pickable; the manager is hired in the front office row. */
    pickable?: boolean;
    /** A help-sheet diagram of the armed state: same markup, same amber, no
     * tap. The native `inert` attribute takes the button out of the focus
     * order and swallows clicks; the cursor rule below withdraws the promise
     * of one. Only the pickable branch needs it — a resting seat is a div. */
    specimen?: boolean;
    onclick?: () => void;
  } = $props();

  const rung = $derived(tier === "" ? "" : `war-${tier}`);
</script>

{#if pickable}
  <button class="cell pickable {rung}" class:vacant={!name} inert={specimen} {onclick}>
    <b>{label}</b>
    {#if name}<span>{name}</span><i>{meta}</i>
      {#if war}<em class="rwar warchip sm">{war}</em>{/if}
    {/if}
  </button>
{:else if name && chair === "mgr"}
  <!-- The skipper's chair uses the same upright column layout as the eight
       player seats at all widths: position label, name, WAR chip. The season
       line is hidden on the phone (too narrow) and shown at width, exactly as
       for the player seats (see .mgr i below). -->
  <div class="mgr filled {rung}">
    <b>{label}</b>
    <span>{name}</span>
    <i>{meta}</i>
    {#if war}<em class="rwar warchip sm">{war}</em>{/if}
  </div>
{:else if name}
  <div class="cell filled {rung}">
    <b>{label}</b><span>{name}</span><i>{meta}</i>
    {#if war}<em class="rwar warchip sm">{war}</em>{/if}
  </div>
{:else}
  <div class="{chair} empty"><b>{label}</b></div>
{/if}

<style>
  /* A SEAT'S HEIGHT IS FIXED, AND CONTENT FILLS IT. `height`, not
     `min-height`: an empty seat and a filled one are the same chair, so signing
     a player must not resize the furniture. The phone grid is the strict case —
     one grid row is as tall as its tallest seat, so a single signing must not
     re-tally every seat in the row, and the whole card must not grow under the
     finger that tapped it.
     64px is what a filled phone seat measures without the season line: 5px of
     border, 10px of padding, and three stacked items (11.25 label + 13.75 name
     + 3 gap + 21.016 chip = 49px), filling the 49px content box exactly.
     The season line is hidden on the phone by `display: none` on `.cell i` and
     `.mgr i`; the element stays in the DOM so CSS can target it without a
     structural branch, and desktop restores it via the 760px media query.
     Flex centering: the type stack is shorter than the seat, and a block
     container would park it at the top — the leftover space belongs half
     above, half below. */
  .cell {
    border: 2.5px solid var(--line);
    border-radius: 9px;
    background: var(--card);
    text-align: center;
    padding: 5px 2px;
    font-size: 10px;
    line-height: 1.25;
    height: 64px;
    font-family: inherit;
    color: inherit;
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
  }
  /* ---------- the rung, worn by the chip ----------
     A seat is white cardstock in --line at every width, filled or not — the
     player-row look every market row and both finale squads share. The rung
     rides the compact .warchip beside the season line and nowhere else: the
     seat's `war-*` class is app.css's fact-carrier, setting the --rung pair
     that the chip inside inherits, and no rule here spends either half of it
     on the seat's own fill or frame. Untiered, the chip falls back to bare
     cardstock — which is exactly what Eye Test already draws no chip for, so
     the mode cannot leak a read through a color.

     The chip shows at BOTH widths. It is the seat's only rung signal now, and
     one system at all breakpoints is the point: a phone seat that hid it would
     carry no tier at all. On the phone it sits centered under the name; at
     width it rides the right edge like the finale's rows.

     ARMED still outranks everything: the release picker's branch renders
     `cell pickable` — amber fill, dashed ink line, nudging — and never
     `filled`, so the two states cannot meet on one element. The chip stays
     legible on the amber; the frame says "tappable" before anything says WAR. */
  .rwar {
    align-self: center;
    margin-top: 3px;
    flex: none;
    font-style: normal;
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
  /* Season line: hidden on the phone (too little room in the 64px seat) and
     kept in the DOM so the 760px media query can restore it without a markup
     branch. This applies to both player seats (.cell i) and the manager (.mgr
     i), giving all nine chairs the same three-row phone layout: label, name,
     chip. */
  .cell i,
  .mgr i {
    display: none;
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
  /* Dashed INK over amber — the armed vocabulary the FRONT OFFICE's browsable
     tiles already speak, and the hardest line on the page, so the state
     outranks the white seats around it. The rung, when armed carries one,
     stays on the chip inside. */
  .cell.pickable {
    background: var(--amber);
    border-style: dashed;
    border-color: var(--ink);
    cursor: pointer;
    animation: nudge 1s ease-in-out infinite;
  }
  .cell.pickable.vacant {
    display: grid;
    place-content: center;
  }
  /* A specimen keeps the armed look (the nudge is the state being taught) but
     is not an offer: inert already blocks the tap and the tab stop. */
  .cell.pickable[inert] {
    cursor: default;
  }
  @keyframes nudge {
    50% {
      transform: translateY(-2px);
    }
  }
  /* The manager's chair uses the same upright column layout as the eight player
     seats — position label, name, chip — with no writing-mode rotation. Width
     is slightly wider than the player cells (72px vs the player cells' auto
     sizing) to give the wins chip room to breathe. Spans both grid rows so the
     skipper sits left of the whole roster at all phone widths.
     At 320px: 292px interior − 4×6px gaps − 72px mgr = 196px for 4 cells =
     49px each; 49 − 5px border − 4px padding = 40px content, clearing the
     chip's 36px min-inline-size.
     The grid placement is here rather than with the rail's own grid because it
     is a fact about the CHAIR — it is the only seat that spans two rows — and
     a caller laying seats out in a flex column (the help sheet, and the rail
     itself at width) simply ignores it. */
  .mgr {
    grid-column: 1;
    grid-row: 1 / 3;
    width: 72px;
    border: 2.5px solid var(--line);
    border-radius: 9px;
    background: var(--card);
    text-align: center;
    padding: 4px 5px;
    line-height: 1.3;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  /* MGR is a word in the players' own label register — same tracked caps, same
     muted color. */
  .mgr b {
    display: block;
    font-size: 9px;
    letter-spacing: 0.07em;
    color: var(--muted-2);
  }
  .mgr span {
    display: block;
    font-weight: 800;
    font-size: 11px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mgr.empty {
    border-style: dashed;
    background: transparent;
    color: var(--gray-ink);
    display: grid;
    place-content: center;
  }
  /* An unhired chair is nothing but its label, so the code grows the way an
     empty player seat's position code does. */
  .mgr.empty b {
    font-size: 11px;
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
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 8px;
      text-align: left;
      width: 100%;
      /* Fixed, for the same reason the phone seat's height is: a filled row
         measures 38.016px — 5px of border, 12px of padding and the 21.016px
         chip, which is taller than any of the three type lines beside it — so a
         36px floor let signing a player push the row 2px taller than the empty
         seats above and below it. 38.5px is the filled height with the
         remainder as slack, and `align-items: center` splits it. */
      height: 38.5px;
      padding: 6px 10px;
      line-height: 1.25;
      overflow: hidden;
    }
    /* The season line is visible again at width, as one flex item in the row.
       The DOM order (b, span, i, em.rwar) matches the desired read for both
       the player seats and the manager: pos · name · season · chip. The chip
       pushes to the right edge via `margin-left: auto` below. */
    .cell i,
    .mgr i {
      display: block;
      font-size: 11px;
      flex: 0 1 auto;
      min-width: 0;
    }
    /* The chip moves to the right edge via `margin-left: auto`. DOM order has
       the chip last (b, span, i, em.rwar for cells; same for the manager since
       the markup was simplified to the same structure), so no `order` override
       is needed — the chip is already the last flex item.
       The negative inline-end margin is the CHIP INSET RULE (PlayerList's
       `.right` documents it): a bordered chip riding against the row's own
       border wants less air than type does, so the chip sits 6px inside the
       stroke — the row's 10px padding minus this 4px — while its text stays
       centered in its own box like every other chip. */
    .rwar {
      align-self: auto;
      margin-top: 0;
      margin-left: auto;
      margin-right: -4px;
    }
    /* The 34px label column is what aligns every row's second field, and both
       chairs speak it in the same tracked caps — MGR is a code like the rest. */
    .cell b,
    .mgr b {
      width: 34px;
      flex: none;
      font-size: 9.5px;
    }
    .cell span,
    .mgr span {
      font-size: 13px;
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
  }
</style>

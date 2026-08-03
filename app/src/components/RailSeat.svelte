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
    /** The position, or MGR. The only thing an empty seat shows. */
    label: string;
    /** Display name — already shortened by the caller. Null is an empty seat. */
    name?: string | null;
    /** The season line under the name: "1995 ATL". */
    meta?: string | null;
    /** The WAR rung as a bare word (`elite`, `mid`, …), or "" for no rung at
     * all. The frame reads `war-${tier}` and the numeral reads `tier`, so one
     * value cannot dress the two halves of a seat differently. */
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
    <b>{label}</b><span>{name}</span><i>{meta}</i>
    {#if war}<em class="rwar {tier}" class:mgw>{war}</em>{/if}
  </div>
{:else}
  <div class="{chair} empty"><b>{label}</b></div>
{/if}

<style>
  /* Flex centering: the type stack is shorter than the 52px seat, and a block
     container would park it at the top — the leftover space belongs half
     above, half below. */
  .cell {
    border: 2.5px solid var(--ink);
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
  /* Every seat wears its WAR bucket on its BORDER — the channel the tinting
     rule opens up, and the one that costs nothing here. Three things have to
     hold at once and this is the only arrangement that gets all three:

       * A PLAYER seat's FILL stays free. Those eight cells spend their fill on
         state: card-white at rest, amber when the release picker has armed
         them. A tinted fill takes that away — an armed 5.2-WAR seat could then
         say "tappable" or "5.2-WAR guy" but not both. The border says the tier,
         the fill says the state, and neither has to give anything up. (The
         manager's chair has no armed state, which is what frees ITS fill for
         the tier as well; see .mgr.filled below.)
       * The DASH survives. Dashed still means armed-or-empty at every hue,
         because the dash and the color are different properties of the same
         line: a tappable elite seat is a dashed gold rectangle, an empty seat
         is a dashed ink one.
       * ONE IDEA AT BOTH WIDTHS. The bottom band this replaces only existed on
         the phone, where the numeral doesn't fit, and stood down at ≥760px
         where the numeral takes over — so the phone said "tier" with a band
         and the desktop said it with a number. The border is present at both
         widths, and at ≥760px the numeral joins it in the same hue.

     Everything below the border is unchanged: the name identifies the pick and
     the numeral returns at width, so no decision rests on hue alone. */
  .cell.war-neg,
  .mgr.war-neg {
    border-color: var(--war-neg);
  }
  .cell.war-low,
  .mgr.war-low {
    border-color: var(--war-low);
  }
  .cell.war-mid,
  .mgr.war-mid {
    border-color: var(--war-mid);
  }
  .cell.war-high,
  .mgr.war-high {
    border-color: var(--war-high);
  }
  .cell.war-star,
  .mgr.war-star {
    border-color: var(--war-star);
  }
  .cell.war-elite,
  .mgr.war-elite {
    border-color: var(--war-elite);
  }
  .cell b {
    display: block;
    font-size: 9px;
    letter-spacing: 0.07em;
    color: var(--muted);
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
    color: var(--muted);
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Filled seats stay plain card-white, like the finale's squad rows — green
     is reserved for the finale's dream-team hits. */
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
     itself at width) simply ignores it. */
  .mgr {
    grid-column: 1;
    grid-row: 1 / 3;
    width: 52px;
    border: 2.5px solid var(--ink);
    border-radius: 9px;
    writing-mode: sideways-lr;
    text-align: center;
    padding: 4px 5px;
    line-height: 1.3;
    overflow: hidden;
  }
  /* The sub-lines run one rung darker than the player seats' do. Those sit on
     card white, a single known ground; these sit on whichever of six washes the
     skipper's rung supplies, and violet-2 is the darkest of them — --muted
     measures 3.39:1 there against 4.37:1 for --muted-2, on 8.5–9px type. One
     token, chosen for the worst rung, so the label reads the same on all six. */
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
  /* The hired skipper's chair is the one seat in the rail whose FILL is free,
     and it spends that freedom on the same rung its frame already draws. Fill
     and frame are then the tinting rule's own pair — the hue at rung 2 inside
     the hue at rung 8 — which is the object the game has been teaching since
     the first WAR chip. A +14.0 W skipper is a gold seat rather than a pink
     seat with a gold hairline you have to hunt for at 2.61:1.
     WHY THIS SEAT AND NOT THE EIGHT BESIDE IT. A player cell can be armed by
     the release picker and turns amber to say so, so its fill is a state
     channel and cannot also be a value channel. The manager's chair is never a
     pick target — hiring happens in the FRONT OFFICE row, not here — so it has
     no state to announce and the fill is idle. Identity does not need the fill
     either: the chair is the only sideways cell in the grid, it spans both
     rows, it holds column one, and it says MGR.
     WHAT EYE TEST SEES. The rule below is the fallback, and it is the honest
     one: with no rung to draw the seat is card-white, exactly like the eight
     filled player seats. The caller passes an empty `tier` in that mode, so the
     wash cannot leak a read the mode hides — the same gate the border and the
     numeral answer to, now with a third thing riding on it. */
  .mgr.filled {
    background: var(--card);
  }
  /* Placed after .mgr.filled deliberately: both selectors weigh the same, so
     source order is what lets a rung paint over the card-white fallback. The
     BORDER half of each rung lives up with the player seats' — the line
     register is shared by every chair, and only the wash is the manager's. */
  .mgr.filled.war-neg {
    background: var(--war-neg-fill);
  }
  .mgr.filled.war-low {
    background: var(--war-low-fill);
  }
  .mgr.filled.war-mid {
    background: var(--war-mid-fill);
  }
  .mgr.filled.war-high {
    background: var(--war-high-fill);
  }
  .mgr.filled.war-star {
    background: var(--war-star-fill);
  }
  .mgr.filled.war-elite {
    background: var(--war-elite-fill);
  }
  .mgr.empty {
    border-style: dashed;
    background: transparent;
    color: var(--gray-ink);
    display: grid;
    place-content: center;
  }
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
    /* The skipper closes the squad card rather than opening it, which is the
       finale's order too. Meaningless outside a flex parent, and the rail is
       one at this width. */
    .mgr {
      order: 1;
    }
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
    /* Nothing stands down here any more. The tier border is the same idea at
       both widths; the numeral joins it, in the same hue, because there is
       room for it. */
    .rwar {
      display: block;
      margin-left: auto;
      flex: none;
      font-style: normal;
      font-weight: 800;
      font-size: 13px;
    }
    .rwar.neg {
      color: var(--war-neg);
    }
    .rwar.low {
      color: var(--war-low);
    }
    .rwar.mid {
      color: var(--war-mid);
    }
    .rwar.high {
      color: var(--war-high);
    }
    .rwar.star {
      color: var(--war-star);
    }
    .rwar.elite {
      color: var(--war-elite);
    }
    /* There is no .rwar.mgw rule, and its absence is load-bearing. The manager
       used to be pinned to flat --green here, which has the same specificity
       as .rwar.elite and sits later in the file, so it would silently win and
       the tiering above would do nothing. The `mgw` class stays on the element
       as a hook for a future manager-only rule; the rule itself is gone.
       (Note --war-mid IS --green, so a .500 skipper renders exactly as before.) */
  }
</style>

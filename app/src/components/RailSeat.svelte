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
  import AwardPill from "./AwardPill.svelte";

  let {
    chair = "cell",
    label,
    name = null,
    full = null,
    meta = null,
    tier = "",
    war = null,
    salary = null,
    salaryTier = "",
    badges = null,
    pickable = false,
    expanded = false,
    controls,
    arrived = false,
    specimen = false,
    onclick,
    oninfo,
  }: {
    /** `cell` is one of the eight player seats; `mgr` is the sideways chair
     * that anchors the left edge of the phone grid. */
    chair?: "cell" | "mgr";
    /** The position code, or "MGR" on the manager's chair — a word in the same
     * column the player seats track their codes in. */
    label: string;
    /** Display name — already shortened by the caller. Null is an empty seat. */
    name?: string | null;
    /** The unabridged name, worn at desktop width where the row has room —
     * the finale squad card prints "Greg Maddux", and the rail at width IS
     * that card, so a surname-only row read as the copy drifting from the
     * original. The phone keeps `name`: a 5-track seat fits one word. Falls
     * back to `name` so callers with no longer form (the help sheet's
     * specimens) change nothing. */
    full?: string | null;
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
    /** The paid salary formatted by money() — "$12M", "$5.4M". Beside the WAR
     * chip at desktop width; hidden on the phone while a chip needs the room
     * (too narrow for both), shown at every width when no chip renders (Eye
     * Test — salary is a sunk cost, not a talent read, and it takes the
     * chip's seat). Null omits the element entirely. */
    salary?: string | null;
    /** costTier bucket for the salary text — the same green/ink/orange read
     * the market rows give a price ("cheap" | "mid" | "spendy"), or "" when
     * no salary shows. Passed as a word, like `tier`, so the seat stays free
     * of mode logic. */
    salaryTier?: string;
    /** The seat's hardware, in reading order, or null for a bare seat. Each
     * mark is either an award code ("MVP", "GG" — AwardPill's registry) or a
     * standalone glyph ("🏠", "💍", "🚩", "🥇", "🥈"): a code starts with an
     * ASCII capital, a glyph never does, so the seat can route each mark to
     * a pill or an emoji span without knowing what any of them MEAN. The
     * caller builds the list — hero flag, sorted awards, ring-or-pennant,
     * medal — because ordering and mode gating (showAwards) are game
     * knowledge and this chair carries none. Always on the row at width; on
     * the phone the lane hides until the seat unfolds (`expanded`). */
    badges?: string[] | null;
    /** Armed by the release picker — the armed orange pair, dashed, nudging.
     * Only a player seat is ever pickable; the manager is hired in the front
     * office row. */
    pickable?: boolean;
    /** A help-sheet diagram of the armed state: same markup, same orange, no
     * tap. The native `inert` attribute takes the button out of the focus
     * order and swallows clicks; the cursor rule below withdraws the promise
     * of one. Only the pickable branch needs it — a resting seat is a div. */
    /** Whether this seat's peek overlay is open. STATE ONLY — the overlay
     * itself is the rail's (it overlays the whole row, which is a fact about
     * the ARRANGEMENT, not about a chair); the seat just reports
     * aria-expanded so the button and the panel it summons stay one control
     * to assistive tech. */
    expanded?: boolean;
    /** DOM id of the open peek panel, for aria-controls — set only while
     * `expanded` (the panel exists only then; a dangling reference would be
     * worse than none). A plain string, like every other prop: which panel
     * it is stays the caller's business. */
    controls?: string;
    /** The man just landed here: plays the house thunk-in once. TRANSIENT —
     * the caller raises it on the empty→filled edge and drops it after the
     * animation; a seat mounted already-filled (restore, reload) never sees
     * it. Transform/opacity only, so the seat's pinned geometry never
     * moves. */
    arrived?: boolean;
    specimen?: boolean;
    onclick?: () => void;
    /** Toggles the phone's unfolded read. Distinct from `onclick`, which
     * belongs to the pickable branch's sign/release tap — the two states
     * never share an element — and the caller withholds this one at desktop
     * width (the row already shows everything) and while a pick is armed
     * ("one question at a time"). Present, the filled seat renders as a
     * button; absent, it stays the resting div it has always been, which is
     * also what keeps the help sheet's specimens dead without a new flag. */
    oninfo?: () => void;
  } = $props();

  const rung = $derived(tier === "" ? "" : `war-${tier}`);
</script>

{#snippet marks(list: string[])}
  <!-- One mark, two faces: an award code wears its registry pill, a bare
       glyph (ring, medal, homegrown) stands as type. The leading-capital
       test is the whole router — see the `badges` prop note. -->
  <span class="badges"
    >{#each list as mark}{#if /^[A-Z]/.test(mark)}<AwardPill code={mark} small />{:else}<span
          class="emo">{mark}</span
        >{/if}{/each}</span
  >
{/snippet}

{#snippet lane()}
  <!-- .lane is the finale .qmid restated: name, season and hardware share a
       middle lane that WRAPS at width, so a decorated seat folds its pills
       to a second line instead of clipping them. On the phone the lane is
       `display: contents` — the wrapper vanishes and the name stacks in the
       seat's column exactly as it always did. Both chairs speak it: the
       manager's MOY and ring ride the same lane the players' hardware does. -->
  <span class="lane"
    ><span class="nm short">{name}</span><span class="nm long">{full ?? name}</span><i>{meta}</i
    >{#if badges?.length}{@render marks(badges)}{/if}</span
  >
{/snippet}

{#snippet filledBody()}
  <b>{label}</b>{@render lane()}
  {#if salary || war}
    <span class="chips" class:lone={!war}>
      {#if salary}<em class="sal {salaryTier}">{salary}</em>{/if}
      {#if war}<em class="rwar warchip sm">{war}</em>{/if}
    </span>
  {/if}
{/snippet}

{#snippet mgrBody()}
  <!-- The manager's three rows, now through the shared lane: label, name
       (surname on the phone, the whole card at width), season, and — new —
       his hardware (MOY pill, 💍/🚩), the finale MGR row's own read. The
       wins chip stays a direct child: no salary ever shares his right edge,
       so the .chips group would be a wrapper around one thing. -->
  <b>{label}</b>{@render lane()}
  {#if war}<em class="rwar warchip sm">{war}</em>{/if}
{/snippet}

{#if pickable}
  <button class="cell pickable {rung}" class:vacant={!name} inert={specimen} {onclick}>
    <b>{label}</b>
    {#if name}<span class="nm">{name}</span><i>{meta}</i>
      {#if salary || war}
        <span class="chips" class:lone={!war}>
          {#if salary}<em class="sal {salaryTier}">{salary}</em>{/if}
          {#if war}<em class="rwar warchip sm">{war}</em>{/if}
        </span>
      {/if}
    {/if}
  </button>
{:else if name && chair === "mgr" && oninfo}
  <!-- The skipper's chair, offered — the phone tap answers with the rail's
       peek exactly as a player seat's does. Same inert rule for specimens. -->
  <button
    class="mgr filled {rung}"
    class:expanded
    class:landed={arrived}
    aria-expanded={expanded}
    aria-controls={expanded ? controls : undefined}
    inert={specimen}
    onclick={oninfo}
  >
    {@render mgrBody()}
  </button>
{:else if name && chair === "mgr"}
  <!-- The skipper's chair uses the same upright column layout as the eight
       player seats at all widths: position label, name, WAR chip. The season
       line is hidden on the phone (too narrow) and shown at width, exactly as
       for the player seats (see .mgr i below). No salary: the manager's cost
       is not a Signed.costPaid and the chair carries no salary prop. -->
  <div class="mgr filled {rung}" class:landed={arrived}>
    {@render mgrBody()}
  </div>
{:else if name && oninfo}
  <!-- The same chair, offered: identical anatomy to the resting div below,
       drawn as a button because a phone tap now answers by unfolding the
       seat. inert covers the help sheet's specimens the way the pickable
       branch's does — tests/help-specimens.test.ts pins that no embedded
       seat is a live button. -->
  <button
    class="cell filled {rung}"
    class:expanded
    class:landed={arrived}
    aria-expanded={expanded}
    aria-controls={expanded ? controls : undefined}
    inert={specimen}
    onclick={oninfo}
  >
    {@render filledBody()}
  </button>
{:else if name}
  <div class="cell filled {rung}" class:landed={arrived}>
    {@render filledBody()}
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
     `cell pickable` — the armed orange pair, dashed, nudging — and never
     `filled`, so the two states cannot meet on one element. The chip stays
     legible on the orange-2; the frame says "tappable" before anything says
     WAR. */
  /* The chip group — salary and WAR side by side at desktop, WAR alone on
     the phone (salary is hidden there; the fixed-width column has no room).
     On mobile the group is transparent: a centered column wrapper that
     occupies the same 24.016px (3px margin-top + 21.016px chip) as the bare
     .rwar did before. The salary element is display:none so the WAR chip
     inside is the only visible item, and the height budget is unchanged. */
  .chips {
    display: flex;
    align-items: center;
    align-self: center;
    margin-top: 3px;
    flex: none;
  }
  /* Salary hides on the phone while a WAR chip needs the room — the 40px
     content column at the 320px floor cannot hold "$26.1M" beside the
     36px-min chip without overflow. Desktop restores it in the 760px block
     below, and `.lone` (no chip — Eye Test) shows it at every width: with
     the chip gone the salary takes the chip's seat. */
  .sal {
    display: none;
    font-style: normal;
    font-size: 10.5px;
    font-weight: 800;
    color: var(--ink);
    white-space: nowrap;
  }
  /* Eye Test: no chip, so the salary is the seat's one figure, shown at every
     width in the chip's place. */
  .chips.lone .sal {
    display: block;
  }
  /* The market rows' price read, verbatim: green under $8M, ink through $25M,
     orange above (costTier in lib/format.ts). */
  .sal.cheap {
    color: var(--green);
  }
  .sal.spendy {
    color: var(--orange);
  }
  /* The hardware lane: hidden on the phone like the season line — the 64px
     seat has no row for pills, and the tap answers with the rail's peek
     overlay instead. Kept in the DOM so the 760px block can restore it
     without a markup branch, the season line's own pattern. */
  .badges {
    display: none;
  }
  .emo {
    font-size: 12px;
    line-height: 1;
  }
  /* A filled seat that answers a tap says so the way every offer here does —
     the pickable branch's cursor rule, minus the orange (this is a question
     the player asks, not one the game is asking them). The specimen override
     mirrors the pickable branch's own [inert] withdrawal below. */
  button.cell.filled,
  button.mgr.filled {
    cursor: pointer;
  }
  button.cell.filled[inert],
  button.mgr.filled[inert] {
    cursor: default;
  }
  button.cell.filled:focus-visible,
  button.mgr.filled:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  .rwar {
    align-self: center;
    margin-top: 3px;
    flex: none;
    font-style: normal;
  }
  /* Inside .chips the parent supplies margin-top and centering; the chip
     itself needs neither. The manager's .rwar is a direct child of .mgr —
     not inside .chips — so this rule doesn't affect it. */
  .chips .rwar {
    margin-top: 0;
    align-self: auto;
  }
  .cell b {
    display: block;
    font-size: 9px;
    letter-spacing: 0.07em;
    /* The tracking, given back as start padding — centered label, and the
       trailing step seated it a half-step left (app.css's .warchip .unit
       documents the leak; .mgr b below re-states it). */
    padding-inline-start: 0.07em;
    color: var(--muted-2);
  }
  /* The middle lane holds name, season and hardware. NOT named `mid`: the
     salary element wears costTier's bucket word as a class, and one of the
     three buckets IS "mid" — a `.mid` lane rule reached across and re-drew
     mid-priced salaries (found live: two seats' prices showing on the phone
     because their $8–25M tier matched the lane's display). On the phone the
     lane generates no box — display:contents hands its children straight to
     the seat's column, so the name stacks under the label exactly as before
     the lane existed. Desktop turns it into the finale's .qmid (the wrapping
     flex row) in the media block below. */
  .lane {
    display: contents;
  }
  /* The name line, BY CLASS. This rule was `span:not(.chips)` for a while
     and that shape is the trap: every later span added to the seat (.mid,
     .badges) inherited the name's block treatment at higher specificity
     than its own rules could answer. Naming the one element it means is
     the fix. */
  .nm {
    display: block;
    font-weight: 800;
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Two cuts of one name, CSS-switched like the season line: the phone
     wears the surname, width wears the whole card. Both stay in the DOM so
     the swap is a media fact, not a markup branch. */
  .nm.long {
    display: none;
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
  /* The armed pills' own orange pair, dashed — the vocabulary the market's
     browsable rows speak, loud against the white seats around it without
     borrowing ink's committed voice. The rung, when armed carries one, stays
     on the chip inside. */
  .cell.pickable {
    background: var(--orange-2);
    border-style: dashed;
    border-color: var(--orange-8);
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
  /* The landing: a signed man THUNKS into his chair — the piece placed on
     the board, at the exact recipe and back-out curve the badge chips deal
     in with (Pill.svelte's thunk-in). Keyframe, not a resting transform
     (the transform must resolve to none at rest), transform/opacity only
     (the seat's pinned heights never move), and app.css's reduced-motion
     kill stands it down. Plays only while the caller holds `arrived` on
     the empty→filled edge, so restores and reloads stay still. */
  .cell.landed,
  .mgr.landed {
    animation: seat-land 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes seat-land {
    from {
      opacity: 0.35;
      transform: scale(0.85);
    }
  }
  /* The manager's chair uses the same upright column layout as the eight player
     seats — position label, name, chip — with no writing-mode rotation. Same
     width as the player cells: the rail's five tracks are equal (the chair
     wore a fixed 72px for a while, which read as four matched seats plus one
     odd one). Spans both grid rows so the skipper sits left of the whole
     roster at all phone widths.
     At 320px: 292px interior − 4×6px gaps = 268px over 5 equal tracks =
     53.6px each; 53.6 − 5px border − 10px padding = 38.6px of chair content,
     clearing the chip's 36px min-inline-size.
     The grid placement is here rather than with the rail's own grid because it
     is a fact about the CHAIR — it is the only seat that spans two rows — and
     a caller laying seats out in a flex column (the help sheet, and the rail
     itself at width) simply ignores it. */
  .mgr {
    grid-column: 1;
    grid-row: 1 / 3;
    width: 100%;
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
    /* Stated for the BUTTON cut of the chair — a div inherited these free,
       a button arrives wearing the UA's own face. Same pair .cell states. */
    font-family: inherit;
    color: inherit;
  }
  /* MGR is a word in the players' own label register — same tracked caps, same
     muted color. */
  .mgr b {
    display: block;
    font-size: 9px;
    letter-spacing: 0.07em;
    padding-inline-start: 0.07em;
    color: var(--muted-2);
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
      /* A FLOOR, no longer a ceiling — the one surface excused from the
         fixed-furniture rule, by owner's call: a decorated seat WRAPS its
         hardware to a second line the way the finale squad row does, and a
         row that wraps must be allowed to stand taller. 38.5px is still the
         single-line height (5px border + 12px padding + the 21.016px chip,
         taller than any type line beside it), so an undecorated rail is
         pixel-identical to the fixed era: empty seats, Eye Test seats and
         one-line signings all sit exactly on the floor, and only a second
         pill line spends anything. */
      min-height: 38.5px;
      height: auto;
      padding: 6px 10px;
      line-height: 1.25;
      overflow: hidden;
    }
    /* The manager rides the same floor: his lane now carries MOY and the
       ring, so his row must be allowed the same second line the players'
       get — in practice one pill and a glyph never wrap it, and he stands
       exactly 38.5px like everyone else. */
    /* The season line is visible again at width, as one item of the middle
       lane (player seats) or the row itself (manager, pickable): pos · name
       · season · hardware · chip. The chip group pushes to the right edge
       via `margin-left: auto` below. */
    .cell i,
    .mgr i {
      display: block;
      font-size: 11px;
      flex: 0 1 auto;
      min-width: 0;
    }
    /* The middle lane becomes the finale's .qmid: name, season and pills
       share a WRAPPING flex row, so a decorated seat's pressure valve is a
       second line — the finale squad row's own answer — never a clipped
       pill. flex: 1 with min-width: 0 is what lets it sit between the label
       lane and the chip group and still truncate a long name. */
    .lane {
      display: flex;
      flex: 1 1 auto;
      min-width: 0;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px 8px;
    }
    /* The name never shrinks to make space for pills — past the lane width
       it ellipsizes instead, the finale .qname rule. The full-name cut takes
       the seat; the phone's surname cut stands down. */
    .nm {
      font-size: 13px;
      flex: none;
      max-width: 100%;
    }
    .nm.short {
      display: none;
    }
    .nm.long {
      display: block;
    }
    .badges {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      flex: none;
      max-width: 100%;
    }
    /* At desktop the chip group becomes a row: salary left, WAR chip right,
       the pair pushed to the right edge as a unit and stopped at the row's
       full padding. The old chip-inset pull (-4px, box-against-box wants
       less air) is retired on this surface: paired with the label lane's
       centering slack it left the row heavy-left/cramped-right, and the
       balanced read matters more than the inset optic.
       The manager's .rwar is a direct child of .mgr (no .chips wrapper) and
       still uses the plain .rwar rule below to push itself right. */
    .chips {
      flex-direction: row;
      /* The one-number rule (PlayerList's .prow documents it): salary-to-chip
         equals chip-to-edge, and the row pads 10px. */
      gap: 10px;
      margin-top: 0;
      margin-left: auto;
    }
    .sal {
      display: block;
    }
    /* Inside .chips, the group wrapper handles right-edge placement;
       the chip itself needs no margin push. */
    .chips .rwar {
      margin-left: 0;
      margin-right: 0;
    }
    /* The manager's .rwar is a direct child of .mgr — not inside .chips —
       so it still needs its own push to the right edge. */
    .rwar {
      align-self: auto;
      margin-top: 0;
      margin-left: auto;
    }
    /* The label column is what aligns every row's second field, sized to its
       widest word (UTIL) plus a hair — wider just moves the names right and
       reads as stray air after a two-letter code. Both chairs speak it in the
       same tracked caps — MGR is a code like the rest.
       LEFT-aligned in its lane: centered, a two-letter code floated ~11px of
       slack against the stroke while the chip on the far end sat pulled
       inside it, and the row read heavy-left/cramped-right. Hugging the lane
       edge puts the code at the row's own padding, the same air the chip now
       gets on the other side. */
    .cell b,
    .mgr b {
      width: 30px;
      flex: none;
      font-size: 9.5px;
      text-align: left;
      /* Left-aligned here, so the centered layout's tracking give-back
         above would read as a rightward shove — stood down. */
      padding-inline-start: 0;
    }
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

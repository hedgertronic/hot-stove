<script lang="ts">
  import { isPitcher } from "../lib/eligibility";
  import type { Game } from "../lib/engine.svelte";
  import { costTier, lastName, money, posLabel, sortAwards, warTier } from "../lib/format";
  import type { CardPlayer } from "../lib/types";
  import AwardPill from "./AwardPill.svelte";

  let {
    game,
    confirmKey,
    setConfirm,
  }: { game: Game; confirmKey: string | null; setConfirm: (k: string | null) => void } = $props();

  const COLLAPSED = 9;
  let expanded = $state(false);

  // Reset the expander per card.
  $effect(() => {
    void game.card;
    expanded = false;
  });

  // Box Score reads talent-first (WAR desc); Eye Test reads money-first —
  // salary is the one signal that mode deliberately shows, so the list ranks
  // by it. Below-replacement rows are filtered engine-side (visiblePlayers).
  const sorted = $derived.by(() => {
    const ps = [...game.visiblePlayers];
    if (game.scout)
      return ps.sort(
        (a, b) =>
          b.cost - a.cost ||
          lastName(a.name).localeCompare(lastName(b.name)) ||
          a.name.localeCompare(b.name),
      );
    return ps.sort((a, b) => b.war - a.war || b.cost - a.cost);
  });
  // Collapsed view keeps sort order but guarantees signable rows are visible:
  // late-game (one slot open) the eligible players would otherwise all hide
  // behind the expander, leaving a wall of gray.
  const visible = $derived.by(() => {
    if (expanded) return sorted;
    const out = sorted.slice(0, COLLAPSED);
    let open = out.filter((p) => game.playerState(p) === "open").length;
    for (const p of sorted.slice(COLLAPSED)) {
      if (open >= 3) break;
      if (game.playerState(p) === "open") {
        out.push(p);
        open++;
      }
    }
    return out;
  });

  function tap(p: CardPlayer, e: MouseEvent) {
    e.stopPropagation();
    // A row with an open picker pointing at the rail: tapping it again means
    // "never mind", the same toggle a SIGN confirm honors. Checked before
    // every other route — while its picker is open this row has exactly one
    // meaning, and ⭐/🔁 must not claim the tap that cancels it.
    if (game.slotPick === p.id || game.releasePick === p.id) {
      game.cancelPick();
      return;
    }
    // ⭐ PRIMETIME IS ASKED FIRST, AND WITH ITS OWN GATE. Browsing a career is
    // not a market action: `primeBrowsable` asks only "is there a career here
    // to look at" — armed, landed, a choice left, and a man the club does not
    // already hold — while `rowPlayable` asks whether THIS SEASON can be
    // bought right now. Two rows separate the questions. A man whose landed
    // season fits nowhere is unplayable and still worth browsing, because a
    // different season of his career carries different slot eligibility and
    // the sheet grays the ones that fit nothing. Gating ⭐ on `rowPlayable`
    // handed that to the wrong predicate. (The engine's INTERSECTION RULE
    // still applies inside primeBrowsable itself: with 🏠 armed beside ⭐,
    // only debut matches stay browsable.)
    if (game.primeBrowsable(p)) {
      game.primeTapPlayer(p);
      return;
    }
    if (!game.rowPlayable(p)) return;
    // An armed Trade Deadline claims the tap even when the player also has
    // an open seat — disarm to sign plainly into the open seat instead.
    if (game.tdCandidate(p)) {
      setConfirm(confirmKey === `t:${p.id}` ? null : `t:${p.id}`);
    } else if (game.playerState(p) === "open") {
      setConfirm(confirmKey === `p:${p.id}` ? null : `p:${p.id}`);
    }
  }

  function commitSign(p: CardPlayer) {
    setConfirm(null);
    game.signPlayer(p);
  }

  function commitTrade(p: CardPlayer) {
    setConfirm(null);
    game.tdTapPlayer(p);
  }

  // Team pedigree (💍/🚩) lives beside the team name in the spin banner — the
  // rows only badge individual hardware.
  const hasBadges = (p: CardPlayer) => game.showAwards && p.awards.length > 0;
  // A World Baseball Classic medal IS individual hardware — he won it in March
  // with his country, and the club he is carded with had no part in it — so the
  // row wears it, on the award pills' own `showAwards` gate. 🥇 champion, 🥈
  // losing finalist: the MVP and CY award pills also use 🥇, which the user
  // approved — the medal is a separate entry on a different axis.
  // It stays off the team overview, which is the club's record and not his.
</script>

<div class="plist disp">
  {#each visible as p (p.id)}
    {@const playable = game.rowPlayable(p)}
    {@const open = game.playerState(p) === "open"}
    {@const swappable = playable && game.tdCandidate(p)}
    <!-- The row's affordance reads the same predicate its tap does, or the
         two disagree and a row looks dead while it is still tappable. -->
    {@const primeable = game.primeBrowsable(p)}
    {@const discounted = game.discountEligible(p)}
    {@const price = game.priceFor(p)}
    {@const plabel = posLabel(p)}
    {@const wbc = game.showAwards ? p.wbc : undefined}
    <!-- hg: an armed 🏠's own targets — the rows whose tap answers "SIGN AT
         $1M…" — wear the armed orange the way 🔁's candidates and ⭐'s
         browsables do. One law for all three: armed lights the rows that
         answer it. ⭐ and 🔁 outrank when they claim the same row's tap. -->
    <!-- A pending confirm is suppressed on a row ⭐ has claimed, not on
         every row while ⭐ is armed. The tap opens the career sheet there,
         so no confirm can be raised on it — but `confirmKey` survives the
         arming, and an armed ⭐ must not leave a live SIGN pill sitting on
         a row whose tap now goes somewhere else. Rows ⭐ cannot browse (a
         man already on the club) keep their own pill, which is what makes
         the suppression match the routing exactly. -->
    {@const signConfirm = confirmKey === `p:${p.id}` && open && !swappable && !primeable}
    {@const tradeConfirm = confirmKey === `t:${p.id}` && swappable && !primeable}
    <div
      class="prow"
      class:dead={!playable && !primeable}
      class:swap={swappable && !primeable}
      class:prime={primeable}
      class:hg={discounted && playable && !swappable && !primeable}
    >
      <button
        type="button"
        class="prow-btn"
        aria-disabled={(!playable && !primeable) ? "true" : undefined}
        onclick={(e) => tap(p, e)}
      >
        <span class="pos" class:pit={isPitcher(p)} class:long={plabel.length > 5}>{plabel}</span>
        <span class="mid">
          <span class="nameline">
            <span class="pname">{p.name}</span>
          </span>
          {#if hasBadges(p)}<span class="badges"
              >{#each sortAwards(p.awards) as a}<AwardPill code={a} small />{/each}</span
            >{/if}
          <!-- WBC medal follows award chips, mirroring the Finale's own order:
               award pills → WS ring → pennant → WBC gold → WBC silver.
               Team rings and pennants live on the finale's squad rows; what
               belongs here is the individual hardware only, so the order is
               award chips then the medal. The medal is a sibling of .badges
               so it remains in the mid flex and wraps independently — placing
               it inside .badges would hide it for players with no award chips. -->
          {#if wbc}<span
              class="wbc"
              role="img"
              aria-label="World Baseball Classic {wbc === 2 ? 'champion' : 'finalist'}"
              >{wbc === 2 ? "🥇" : "🥈"}</span
            >{/if}
        </span>
        {#if !signConfirm && !tradeConfirm}
          <span class="right">
            {#if game.slotPick === p.id}
              <!-- The picker lives in the rail — point there, cardstock-terse.
                   The rail sits ABOVE the market on the phone and LEFT of it at
                   width, so the glyph is two spans and the 760px media tier picks
                   the one that points at the actual rail. -->
              <span class="confirm hint"><span class="ph" aria-hidden="true">↑</span><span class="wd" aria-hidden="true">←</span> PICK A SLOT</span>
            {:else if game.releasePick === p.id}
              <span class="confirm hint"><span class="ph" aria-hidden="true">↑</span><span class="wd" aria-hidden="true">←</span> TAP WHO TO TRADE</span>
            {:else}
              <span class="cost {discounted ? 'cheap' : costTier(price)}">{money(price)}</span>
              {#if game.showWar}<span class="warchip {warTier(p.war)}">{p.war.toFixed(1)}<span class="unit">WAR</span></span>{/if}
            {/if}
          </span>
        {/if}
      </button>
      {#if signConfirm}
        <button type="button" class="confirm" onclick={(e) => { e.stopPropagation(); commitSign(p); }}>SIGN {money(price)}</button>
      {:else if tradeConfirm}
        <button type="button" class="confirm" onclick={(e) => { e.stopPropagation(); commitTrade(p); }}>TRADE FOR {money(price)}</button>
      {/if}
    </div>
  {/each}
  {#if !expanded && sorted.length > visible.length}
    <button class="more" onclick={(e) => { e.stopPropagation(); expanded = true; }}>
      show {sorted.length - visible.length} more ▾
    </button>
  {/if}
</div>

<style>
  /* minmax(0, …) for the same reason SpecialRows and the finale's `.ledger`
     carry it: an `auto` track floors at its items' min-content, and a row's
     min-content runs through the nowrap `.pname`. The market's longest name,
     "Christian Encarnacion-Strand", measures 195px at 14px/800; with the 38px
     position tag, two 9px gaps, the 105px WAR-chip-and-price column, 20px of
     padding and 5px of border the row floors at 381px, against the 347px a
     375px phone has to spend. The track grew to fit and took every row with it.
     Narrower than the FRONT OFFICE rows' blowout by 70px, which is why this one
     needs the longest name in a 6,375-name corpus to show and the other needs
     only a Kansas City card — but it is the same bug and the same one-line fix.
     A zero floor lets the track take the width it is given; `.prow > .mid`
     already carries `min-width: 0`, so the name ellipsizes inside it. */
  .plist {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
    padding-bottom: 10px;
  }
  .prow {
    display: flex;
    align-items: center;
    gap: 9px;
    background: var(--card);
    border: 2.5px solid var(--line);
    border-radius: 11px;
    padding: 6px 10px;
    cursor: pointer;
    transition: transform 0.08s;
    font-family: inherit;
    color: inherit;
    text-align: left;
    width: 100%;
    min-height: 46px;
  }
  .prow:active {
    transform: translate(-1px, -1px);
  }
  /* Wide: the market rows are the core read — give the name/sub line and the
     chips a touch more air (phone packs them by necessity). The chip inset
     deepens with the padding (−8 against 14px, the same 6px seat the phone's
     −4 buys against 10px) — SpecialRows' skipper chip runs the identical pair,
     and the two columns must share one right edge or the FRONT OFFICE chip
     floats 4px off the market's. */
  @media (min-width: 760px) {
    .prow {
      padding: 8px 14px;
      gap: 12px;
    }
  }
  /* The row tap surface (.prow-btn) reset lives in app.css: one shared rule
     for PlayerList and SpecialRows. Only the child-combinator .mid scoping
     stays here because the WAR ladder's `mid` rung token shares the name. */
  /* Position is a filter cue, not the headline: a compact fixed-width tag so
     the left edge scans as a column. Pitchers flip to filled ink — one subtle
     two-way split (arms vs bats), no rainbow. */
  .pos {
    width: 38px;
    border-radius: 7px;
    background: var(--card);
    color: var(--ink);
    border: 2px solid var(--line);
    display: grid;
    place-content: center;
    text-align: center;
    font-weight: 800;
    font-size: 9.5px;
    letter-spacing: 0.03em;
    line-height: 1;
    padding: 4px 0;
    flex: none;
  }
  .pos.pit {
    background: var(--ink);
    color: var(--card);
  }
  /* Multi-group labels ("C/IF/OF") shrink to keep the fixed-width column. */
  .pos.long {
    font-size: 7.5px;
    letter-spacing: 0.01em;
  }
  /* Name and hardware share a line when they fit; the badges wrap to a second
     line when they don't (narrow phones). The name never shrinks to make room
     for pills — a name longer than the whole row still ellipsizes via the
     nameline's max-width. */
  /* Scoped to the row's own child, not to `.mid` anywhere: the WAR ladder's
     middle rung is ALSO called `mid`, so a bare `.mid` selector reached into
     the row's mid-tier WAR chip and turned it into a wrapping flex container.
     That is where the green chip's extra gap came from — the chip's number and
     its WAR label became flex items and picked up this rule's 6px column gap on
     top of the label's own 2.5px margin, and `min-width: 0` canceled the
     chip's 42px floor, so only the green chip was 6px wide and 6px gappy. The
     collision is a name collision; the child combinator is the fix for it. */
  .prow-btn > .mid {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 6px;
    min-width: 0;
    overflow: hidden;
  }
  .nameline {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
    max-width: 100%;
    min-width: 0;
  }
  .pname {
    font-weight: 800;
    font-size: 14px;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .badges {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: none;
  }
  /* The medal rides inside the nameline rather than with the badges, so it can
     never wrap to the second line away from the man who won it. It sits under
     the name's 14px because a glyph reads at its whole box where type reads at
     its cap band, and line-height 1 keeps the emoji's taller line box from
     setting the row's height. */
  .wbc {
    font-size: 12px;
    line-height: 1;
    flex: none;
  }
  /* min-height = the WAR chip's exact height (13.5px × 1.65 line + 4px
     border), so swapping the chip+price for the shorter confirm pill can't
     change the row height — the tap must not make the card twitch. */
  /* THE CHIP INSET RULE, stated once and copied by every row that ends in a
     chip (PrimePicker's .right, the rail's .rwar, SpecialRows' manager chip,
     the finale squads): the gap between salary and chip is TYPE-against-box
     and reads at 10px; the gap between chip and row edge is BOX-against-box —
     two drawn strokes — and wants less air, so the negative margin pulls the
     chip to 6px inside the row's 10px padding. Before this rule the two were
     reversed (7px inboard, 10px+ outboard), and the row read as if the chip
     had drifted off the salary toward nothing. */
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
    margin-right: -4px;
    flex: none;
    min-height: 26.3px;
  }
  /* The wide tier pads 14px, so the same 6px seat needs a deeper pull — the
     identical −8 SpecialRows' skipper chip carries, or the two columns' right
     edges split by 4px. THIS BLOCK MUST FOLLOW the base `.right` rule above:
     the media query adds no specificity, so source order is the only thing
     that lets −8 beat −4 — declared before the base rule it silently loses at
     every width, which is exactly how the misalignment shipped once. */
  @media (min-width: 760px) {
    .right {
      margin-right: -8px;
    }
  }
  /* Salary sits inboard; the WAR chip is flush right, the last thing the eye
     lands on. The chip lives in app.css because PrimePicker draws the same
     ladder and two copies of six rules drift.
     The chip is the rightmost item now, so its right edge has to be consistent
     or the WAR column jitters as values vary. app.css's `min-inline-size: 42px`
     is a floor, not a fixed width — "12.3 WAR" is wider than that. 64px seats
     the widest values the visible-players filter passes (above-replacement only)
     with the same side room the salary's 56px floor provided. A separate scoped
     rule rather than touching app.css: the global chip is shared by the finale,
     the rail, and the career sheet, none of which need PlayerList's column pin.
     The text stays CENTERED in that box, like every other chip in the game —
     the outer margins are the inset rule's job (see .right above), not the
     type's. */
  .right .warchip {
    min-inline-size: 64px;
  }
  /* Structural right-alignment (flex, not text-align) so every engine agrees. */
  .cost {
    display: inline-flex;
    justify-content: flex-end;
    font-weight: 800;
    font-size: 13px;
    white-space: nowrap;
    min-width: 56px;
  }
  .cost.cheap {
    color: var(--green);
  }
  .cost.spendy {
    color: var(--orange);
  }
  .prow.dead {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
    opacity: 0.55;
    cursor: default;
  }
  /* A dead row still whispers its tier: the identity bits (position tag,
     name, award pills) go monochrome, but the WAR chip and salary keep their
     hue — faded by the row's opacity and a mild desaturation — so a gold you
     can't reach still reads gold ("need Trade Deadline for him"). Modes that
     hide a chip render nothing here, so nothing new leaks. */
  .prow.dead .prow-btn > .pos,
  .prow.dead .prow-btn > .mid {
    filter: grayscale(1);
  }
  .prow.dead .warchip,
  .prow.dead .cost {
    filter: saturate(0.7);
  }
  .prow.dead:active {
    transform: none;
  }
  .prow.dead .pos {
    background: transparent;
  }
  .prow.dead .pos.pit {
    background: var(--gray-ink);
  }
  /* TD swap targets and Prime-browsable rows share one "tappable for a
     powerup" look; the classes stay separate because the tap routes differ.
     The fill AND the dash are the armed pills' own orange pair — the control
     that armed and the rows it lit are one flow in one voice, with the dash
     carrying the "target" half of the sentence. (The fill was --amber, a
     third warm tone between the armed orange and the trophy amber; the dash
     was ink, which read harder than the state it marked.) */
  .prow.swap,
  .prow.prime,
  .prow.hg {
    background: var(--orange-2);
    border: 2.5px dashed var(--orange-8);
    opacity: 1;
    filter: none;
  }
  /* The confirm pill base recipe lives in app.css (.confirm + :focus-visible).
     Position deltas only: flex: none keeps it from growing; the negative right
     margin pulls it to the same 6px inset the .right column's chips occupy.
     Pinned height (24px = 12px text + 8px pad + 4px border) is enforced by
     the app.css padding asymmetry — no local height rule needed. */
  .prow > .confirm {
    flex: none;
    margin-right: -4px;
  }
  @media (min-width: 760px) {
    .prow > .confirm {
      margin-right: -8px;
    }
  }
  /* Pending pick: the next tap belongs to the rail, not this row — the pill
     goes orange (the rail hint's color) and points up at it. On the pair, so
     the one ink pill on the row is the one that is still tappable. */
  .confirm.hint {
    background: var(--orange-2);
    border-color: var(--orange-8);
    color: var(--ink);
  }
  /* The hint's arrow, one glyph per layout: ↑ while the rail rides above the
     market (phone), ← once the wide grid seats it to the left. Declared after
     the base so the wide block's swap wins on source order. */
  .hint .wd {
    display: none;
  }
  @media (min-width: 760px) {
    .hint .ph {
      display: none;
    }
    .hint .wd {
      display: inline;
    }
  }
  .more {
    text-align: center;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--muted);
    padding: 8px 0;
    cursor: pointer;
    background: none;
    border: 0;
    font-family: inherit;
  }
</style>

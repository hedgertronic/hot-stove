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
    // ⭐ PRIMETIME IS ASKED FIRST, AND WITH ITS OWN GATE. Browsing a career is
    // not a market action: `primeBrowsable` asks only "is there a career here
    // to look at" — armed, landed, a choice left, and a man the club does not
    // already hold — while `rowPlayable` asks whether THIS SEASON can be
    // bought right now. Two rows separate the questions. A man whose landed
    // season fits nowhere is unplayable and still worth browsing, because a
    // different season of his career carries different slot eligibility and
    // the sheet grays the ones that fit nothing. And an armed 🏠 Homegrown
    // grays every row that did not debut with this franchise, which is a
    // filter on the market the reel landed on — a career sheet sells seasons
    // off cards the reel never landed on, so the discount has no claim there.
    // Gating ⭐ on `rowPlayable` handed both of those to the wrong predicate.
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
    <button
      class="prow"
      class:dead={!playable && !primeable}
      class:swap={swappable && !primeable}
      class:prime={primeable}
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
      <span class="right">
        {#if game.slotPick === p.id}
          <!-- The picker lives in the rail — point there, cardstock-terse. -->
          <span class="confirm hint">↑ PICK A SLOT</span>
        {:else if game.releasePick === p.id}
          <span class="confirm hint">↑ TAP WHO TO TRADE</span>
        <!-- A pending confirm is suppressed on a row ⭐ has claimed, not on
             every row while ⭐ is armed. The tap opens the career sheet there,
             so no confirm can be raised on it — but `confirmKey` survives the
             arming, and an armed ⭐ must not leave a live SIGN pill sitting on
             a row whose tap now goes somewhere else. Rows ⭐ cannot browse (a
             man already on the club) keep their own pill, which is what makes
             the suppression match the routing exactly. -->
        {:else if confirmKey === `p:${p.id}` && open && !swappable && !primeable}
          <span class="confirm" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); commitSign(p); }} onkeydown={(e) => e.key === "Enter" && commitSign(p)}>SIGN {money(price)}</span>
        {:else if confirmKey === `t:${p.id}` && swappable && !primeable}
          <span class="confirm" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); commitTrade(p); }} onkeydown={(e) => e.key === "Enter" && commitTrade(p)}>TRADE FOR {money(price)}</span>
        {:else}
          <span class="cost {discounted ? 'cheap' : costTier(price)}">{money(price)}</span>
          {#if game.showWar}<span class="warchip {warTier(p.war)}">{p.war.toFixed(1)}<span class="unit">WAR</span></span>{/if}
        {/if}
      </span>
    </button>
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
  .prow > .mid {
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
  .prow.dead > .pos,
  .prow.dead > .mid {
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
     powerup" look; the classes stay separate because the tap routes differ. */
  .prow.swap,
  .prow.prime {
    background: var(--amber);
    border: 2.5px dashed var(--ink);
    opacity: 1;
    filter: none;
  }
  /* Pinned to 24px (12 text + 8 pad + 4 border) so the pill fits the row's
     content box at both padding tiers — an unconstrained line box made
     tapping grow the row. The 8px splits 4.28 / 3.72, which is app.css's
     optical centering rule at 12px type (0.047 × 12 = 0.56px), paid out of the
     padding so the 24px total holds. Same numbers as the FRONT OFFICE rows'
     confirm, which is the same pill on the same ladder of type sizes. */
  .confirm {
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--ink);
    color: var(--card);
    font-weight: 800;
    font-size: 12px;
    line-height: 1;
    padding: 4.28px 12px 3.72px;
    white-space: nowrap;
  }
  /* Pending pick: the next tap belongs to the rail, not this row — the pill
     goes orange (the rail hint's color) and points up at it. On the pair, so
     the one ink pill on the row is the one that is still tappable. */
  .confirm.hint {
    background: var(--orange-2);
    border-color: var(--orange-8);
    color: var(--ink);
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

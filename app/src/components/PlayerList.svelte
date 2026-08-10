<script lang="ts">
  import { isPitcher } from "../lib/eligibility";
  import type { Game } from "../lib/engine.svelte";
  import { costTier, lastName, money, posLabel } from "../lib/format";
  import type { CardPlayer } from "../lib/types";
  import MarketRow from "./MarketRow.svelte";

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

  // Discard any live confirm when the market's shape changes — i.e., when any
  // powerup is armed or disarmed. armVersion bumps in each toggle; the effect
  // runs once on mount (no-op: confirmKey is already null) and then on each
  // subsequent bump, so powerup taps clear any open sign/trade pill.
  // A pending rail pick clears it for the same reason: only the ⭐ handoff
  // bumps armVersion, so a SIGN pill raised before an ambiguous sign or a 🔁
  // release opened its picker would otherwise sit live on another row while
  // the rail asks its question.
  $effect(() => {
    void game.armVersion;
    void game.slotPick;
    void game.releasePick;
    setConfirm(null);
  });

  // Box Score reads talent-first (WAR desc); Eye Test reads money-first —
  // salary is the one signal that mode deliberately shows, so the list ranks
  // by it. Every qualified player lists, below-replacement included — the
  // WAR sort seats them at the bottom.
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
    // While ANOTHER row's picker is open, every other row is a bystander: the
    // board has asked one question and the only live answers are the rail
    // seats and the asking row's own cancel. Without this gate a tap here
    // silently abandoned the pending pick (⭐ rerouted it to a new career
    // sheet, a plain row raised a SIGN pill under it) — and the rows kept
    // their armed orange while WHAT SLOT? was up, which read as more open
    // questions than the board was asking (owner report, 2026-08-10). The
    // markup's `dimmed` reads the same condition, so look and tap agree.
    if (game.slotPick !== null || game.releasePick !== null) return;
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
  // rows only badge individual hardware; what a row shows and how it grays is
  // MarketRow's, this file only decides WHICH facts each mode hands it.
  // A World Baseball Classic medal IS individual hardware — he won it in March
  // with his country, and the club he is carded with had no part in it — so the
  // row wears it, on the award pills' own `showAwards` gate. 🥇 champion, 🥈
  // losing finalist: the MVP and CY award pills also use 🥇, which the user
  // approved — the medal is a separate entry on a different axis.
  // It stays off the team overview, which is the club's record and not his.
</script>

<div class="plist disp">
  {#each visible as p (p.id)}
    <!-- One question at a time: while a rail picker is open for some OTHER
         row, this row steps back — no armed orange, dead optics, and tap()
         refuses it above. The asking row itself keeps its costume. -->
    {@const dimmed =
      (game.slotPick !== null || game.releasePick !== null) &&
      game.slotPick !== p.id &&
      game.releasePick !== p.id}
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
      class:dead={(!playable && !primeable) || dimmed}
      class:mine={game.isRostered(p)}
      class:swap={swappable && !primeable && !dimmed}
      class:prime={primeable && !dimmed}
      class:hg={discounted && playable && !swappable && !primeable && !dimmed}
    >
      <button
        type="button"
        class="prow-btn"
        aria-disabled={(!playable && !primeable) || dimmed ? "true" : undefined}
        onclick={(e) => tap(p, e)}
      >
        <!-- The row's whole content is MarketRow — the presentational lift the
             help sheet shares, so its specimens cannot drift from this row.
             This file keeps the wiring: which predicate feeds each prop, and
             the confirm buttons below. -->
        <MarketRow
          pos={plabel}
          pit={isPitcher(p)}
          name={p.name}
          awards={game.showAwards ? p.awards : undefined}
          {wbc}
          priceText={money(price)}
          priceTier={discounted ? "cheap" : costTier(price)}
          war={game.showWar ? p.war : null}
          hint={game.slotPick === p.id ? "slot" : game.releasePick === p.id ? "trade" : null}
          washed={(swappable || primeable || (discounted && playable)) && !dimmed}
          rightHidden={signConfirm || tradeConfirm}
          freeze={signConfirm || tradeConfirm || game.slotPick === p.id || game.releasePick === p.id}
          dead={(!playable && !primeable) || dimmed}
        />
      </button>
      {#if signConfirm}
        <button type="button" class="confirm" onclick={(e) => { e.stopPropagation(); commitSign(p); }}><span class="chiplbl">SIGN FOR {money(price)}</span></button>
      {:else if tradeConfirm}
        <button type="button" class="confirm" onclick={(e) => { e.stopPropagation(); commitTrade(p); }}><span class="chiplbl">TRADE FOR {money(price)}</span></button>
      {/if}
    </div>
  {/each}
  {#if !expanded && sorted.length > visible.length}
    <!-- The arrow is the WHAT SLOT? hint's glyph (↓ here — the hidden rows
         sit below), in the hint's own aria-hidden span so a screen reader
         gets the words without the arrow. The capsule is a chipbox with the
         words in a .chiplbl: as a padding-driven box the caps rode the
         engine's baseline seat, visibly high next to the powerup pills it is
         sized to match — the recipe seats both families the same way. The
         arrow stays a bare flex item (no cap band to trim), centered by the
         box alone per the recipe's own rule. -->
    <button type="button" class="more chipbox" onclick={(e) => { e.stopPropagation(); expanded = true; }}>
      <span class="ph" aria-hidden="true">↓</span><span class="chiplbl">SHOW {sorted.length - visible.length} MORE</span>
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
     A zero floor lets the track take the width it is given; MarketRow's mid
     column already carries `min-width: 0`, so the name ellipsizes inside it. */
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
  /* Wide: the rows keep the phone's 10px horizontal frame — the widths were
     14px for a round, and the extra air pushed the position and WAR chips
     inboard where the phone's tighter frame read better balanced. 10px is
     also the .right column's own salary↔chip gap, so the chip's air on both
     sides is ONE number: salary-to-chip equals chip-to-edge, at every width.
     Only the vertical padding grows with the larger desktop row. */
  @media (min-width: 760px) {
    .prow {
      padding: 8px 10px;
      gap: 12px;
      /* At phone, the 26.275px WAR chip + 12px padding + 5px border = 43.275px
         falls below the 46px floor, so min-height binds in both armed and
         unarmed states. At desktop the padding grows to 16px: 26.275 + 16 + 5 =
         47.275px exceeds 46px, so unarmed rows sit at 47.275px while armed rows
         (chip removed, 24px confirm pill + 16 + 5 = 45px) clamp back to 46px —
         a 1.275px shrink. 48px covers both states at the same floor. */
      min-height: 48px;
    }
  }
  /* The row tap surface (.prow-btn) reset lives in app.css: one shared rule
     for PlayerList and SpecialRows. Everything INSIDE the button — position
     tag, mid column, price/WAR column, the picker hints, and the dead-state
     content filters — is MarketRow's, shared with the help sheet's specimen
     so the two cannot drift. This file keeps the row box and its four live
     state washes below. */
  .prow.dead {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
    opacity: 0.55;
    cursor: default;
  }
  /* A row dead because the man is ALREADY YOURS, told apart from "no seat
     fits him" by hue rather than by a tag: the finale's own signed-row
     vocabulary (--green-wash into the card, the saturated green on the
     line), muted by the dead state's opacity. Scoped under .dead so an
     armed 🔁's self-swap candidate — the same human, tappable — keeps the
     armed orange that claims its tap. */
  .prow.dead.mine {
    background: color-mix(in srgb, var(--green-wash) 45%, var(--card));
    border-color: var(--green);
  }
  /* The dead row's CONTENT treatment (grayscale identity, desaturated chips,
     the pit tag's line-gray fill) lives in MarketRow, driven by its `dead`
     prop — the same reason the content markup does. */
  .prow.dead:active {
    transform: none;
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
     Position deltas only: flex: none keeps it from growing; it stops at the
     row's full padding, the same edge the .right column's chips hold.
     Pinned height (24px = 12px text + 8px pad + 4px border) is enforced by
     the app.css padding asymmetry — no local height rule needed. */
  .prow > .confirm {
    flex: none;
  }
  /* THE ROW MUST NOT RESHAPE UNDER THE TAP. The confirm replaces the value
     column, and the two are different widths, so the swap used to hand the
     mid column the difference and snap wrapped award pills back to one line
     for exactly the life of the pill. The guard is wrapnudge's `freeze`,
     passed through MarketRow: the mid column's width is clamped to its
     pre-swap value while a confirm or hint is up. */
  /* The list expander, in the system's own button voice: a quiet full-width
     capsule — cardstock on the structural line, caps at the action-row
     tracking, the standard press dip and focus ring, and a real tap target.
     It was bare lowercase text for a long while, the one interactive surface
     in the game with no border, no dip, and no focus style. Ink, like every
     other capsule's type — muted was tried and read as disabled next to the
     powerup pills it is sized to match. */
  .more {
    text-align: center;
    /* Sized to the powerup pills' base recipe (PowerupPill.svelte: 10.5px/800,
       30px pinned chip height, 11px inline padding, 2px border) so the two
       capsule families read as one control voice across the board — and, as
       of the chipbox join, seat their caps identically too. */
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--ink);
    width: fit-content;
    justify-self: center;
    margin-top: 2px;
    --chip-h: 30px;
    padding-inline: 11px;
    cursor: pointer;
    background: var(--card);
    border: 2px solid var(--line);
    border-radius: 999px;
    font-family: inherit;
    transition: transform 0.08s;
  }
  /* The hint pills' own arrow-to-words air — a margin, not a space character,
     which the label's cap trim can't measure. */
  .more .ph {
    margin-inline-end: 4px;
    display: block;
  }
  /* The arrow is a bare flex item (no cap band, so no trim) and both engines
     seat Nunito's ↓ ink HIGH in its em square — Blink 1.86px in this 30px
     box at 10.5px type, WebKit 0.20px (measured, tools/probe_centering.py
     `more-arrow`; the WebKit hair confirmed by eye on the phone). Written
     in em (1.86/10.5 = 0.177; 0.20/10.5 ≈ 0.02) because the ride is the
     glyph's position in its em square, which scales with the type. */
  .more .ph {
    transform: translateY(0.02em);
  }
  @supports not (font: -apple-system-body) {
    .more .ph {
      transform: translateY(0.177em);
    }
  }
  .more:active {
    transform: translateY(2px);
  }
  .more:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
</style>

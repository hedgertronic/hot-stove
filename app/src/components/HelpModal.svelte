<script lang="ts">
  import { BADGE_BY_KEY } from "../lib/badges";
  import { SLOT_TYPES } from "../lib/engine.svelte";
  import { costTier, money, posLabel, signed, slotLabel, sortAwards, warTier } from "../lib/format";
  import { BANKS } from "../lib/modes";
  import {
    AWARD_POINTS,
    BUDGET_BONUS_MAX,
    LUXURY_TAX_PER_M,
    MANAGER_MOTY_POINTS,
    MANAGER_PER_NET_WIN,
    PENNANT_POINTS,
    REPLACEMENT_WINS,
    RING_POINTS,
    SCOUT_HIT_POINTS,
    WBC_CHAMPION_POINTS,
    WBC_RUNNERUP_POINTS,
  } from "../lib/scoring";
  import type { CardPlayer } from "../lib/types";
  import AwardPill from "./AwardPill.svelte";
  import BadgePill from "./BadgePill.svelte";
  import PayrollBox from "./PayrollBox.svelte";
  import PowerupPill from "./PowerupPill.svelte";
  import RailSeat from "./RailSeat.svelte";
  import Sheet from "./Sheet.svelte";

  /** How to play, taught mostly in pictures.
   *
   * The screens a player is about to meet are made of five things words are
   * bad at: a market row, the roster rail's seats, the payroll meter, a
   * powerup pill, and a badge. Each one appears here as ITSELF — same anatomy,
   * same classes, same tier ladder — with one line of copy beside it, instead
   * of a paragraph describing a picture the player cannot see.
   *
   * That extends to the two MOMENTS a still row cannot carry. Signing a man
   * who fits two seats, and trading one man out for another, are both a tap
   * that changes the whole screen: the rail lights up and the row's right-hand
   * column turns into an orange instruction pointing at it. Each is drawn here
   * as the screen it actually is — armed seats above, instructed row below,
   * in the order the board stacks them, so the ↑ in the pill points at the
   * seats it is talking about.
   *
   * ---- How the specimens are built ----
   *
   * From plain object literals, never a `Game`. All but one go through the REAL
   * component: `PayrollBox`, `BadgePill`, `AwardPill`, `RailSeat` and
   * `PowerupPill`. The last two used to be hand-copied markup here, on the
   * grounds that their owners take a `Game` — so the seat and the pill were
   * lifted out of `RosterRail` and `PowerupRow` into components of their own
   * that take plain values. The copies are gone, and with them the only way for
   * this sheet to teach a screen that no longer exists.
   *
   * The market row is the one specimen still drawn by hand. `PlayerList` is a
   * list of buttons wired to signings and pickers, and there is no presentation
   * layer to lift out of it that would not be the whole component. It is drawn
   * ONCE, as the `prow` snippet, because five rows of it now appear on the
   * sheet — resting, gray, utility, mid-pick and mid-trade — and five copies of
   * one hand-copy is five chances for four of them to drift.
   *
   * Nothing here comes from `src/lab`. That directory is the DEV-only fixture
   * gallery, excluded from the production bundle by an `import.meta.env.DEV`
   * guard, and an import from this file would pull the whole lab into the
   * shipped app.
   *
   * The WAR chip is the app.css ladder, not a copy: one ladder, one home. The
   * row and seat rules below ARE a second copy of PlayerList's and
   * RosterRail's, and are meant to be — a specimen that drifts from the screen
   * it teaches is worse than no specimen, so it is the same numbers written
   * out rather than the same component wired to a fake game. */
  let { onclose }: { onclose: () => void } = $props();

  /* EVERY FIGURE BELOW IS THE REAL ONE, read off data/cards, and every tier is
   * DERIVED from it by the app's own `warTier`. Both halves matter. A caption a
   * few lines down says a seat's border is that player's WAR tier, so a
   * hand-picked tier beside a hand-picked number is the help sheet teaching the
   * ladder wrong — a worse failure than the hand-copied markup these specimens
   * were rewritten to remove, and the exact one that shipped here for a round:
   * a manager chair labelled "star" over an invented "+9.4 W", which is elite.
   * Nothing here is a plausible-looking invention any more. */

  /** What the `prow` snippet needs to draw one market row. The three state
   * flags are the row's own three classes, not a fourth vocabulary. */
  interface Spec {
    pos: string;
    name: string;
    awards?: string[];
    war: number;
    cost: number;
    /** A pitcher's position tag is filled ink rather than card white. */
    pit?: boolean;
    /** Nowhere to put him: the market's gray. */
    dead?: boolean;
    /** An armed 🔁 has claimed this row: amber under a dashed ink line. */
    swap?: boolean;
  }

  /** One row off a real card: a generational season with hardware on it. */
  const MARKET: Spec = {
    pos: "SP",
    name: "Pedro Martínez",
    awards: ["CY", "AS"],
    war: 9.8,
    cost: 54.6,
    pit: true,
  };
  /** The same row with nowhere to put him — the market's gray. */
  const MARKET_DEAD: Spec = { pos: "C", name: "Iván Rodríguez", war: 6.4, cost: 44, dead: true };
  /** Ben Zobrist's 2009: 108 games in the infield, 75 in the outfield, which is
   * two seats' worth of eligibility earned in ONE season. The tag is not typed
   * out — `posLabel` reads it off those two game counts against the same
   * `MIN_POS_G` the market and the solver read, so the row says "2B/OF" for
   * exactly the reason the game's own row says it, and a moved threshold moves
   * this specimen with it. The rest of the CardPlayer shape is not consulted
   * for a position tag, which is what the cast is for. */
  const UTIL: Spec = {
    pos: posLabel({ pos: "2B", posG: { c: 0, if: 108, of: 75, dh: 1 } } as CardPlayer),
    name: "Ben Zobrist",
    awards: ["AS"],
    war: 8.6,
    cost: 1,
  };

  /** Four of the eight chairs: two filled, two waiting. Four rather than eight
   * because the phone grid is 2×4 and this is 2×2 — the same object at a size
   * that leaves room for a caption. */
  const SEATS = [
    { label: "C", name: "Piazza", meta: "1997 LAD", war: 8.7 },
    { label: "IF", name: null, meta: null, war: null },
    { label: "SP", name: "Maddux", meta: "1995 ATL", war: 10.8 },
    { label: "RP", name: null, meta: null, war: null },
  ];

  /** Bobby Cox's 1995 Braves, 90–54, through the engine's own expression — so
   * the chair's numeral and the rung it wears come from one number, and that
   * number is the one the game would put there. */
  const MGR_WINS = (90 - 54) * MANAGER_PER_NET_WIN;

  /** The eight seats, counted off SLOT_TYPES rather than written out: "C · IF
   * ×2 · OF · UTIL · SP ×2 · RP". A seat added to the game must not need this
   * sentence found and edited — that is precisely the drift the specimens above
   * were extracted to end, and copy drifts the same way markup does. */
  const SEAT_LINE = (() => {
    const runs: [string, number][] = [];
    for (const t of SLOT_TYPES) {
      const label = slotLabel(t);
      const last = runs[runs.length - 1];
      if (last && last[0] === label) last[1] += 1;
      else runs.push([label, 1]);
    }
    return runs.map(([l, n]) => (n > 1 ? `${l} ×${n}` : l)).join(" · ");
  })();

  /** The WAR ladder, one chip per rung. The label is written out; the COLOR is
   * `warTier`'s, read off the number sitting beside it. A moved threshold moves
   * the chip with it, so the sheet cannot end up teaching a rung the app no
   * longer draws — the same rule the seats and the market row above follow.
   *
   * These are `.warchip`s, which wear a bare tier class (`elite`), while a rail
   * seat's border wears the prefixed one (`war-elite`) — app.css's two
   * spellings, one ladder.
   *
   * The sheet now draws SIX prefixed rungs across its seats, so no assertion
   * anywhere may look for a `war-` token in the sheet's whole markup and
   * conclude anything about one chair from finding it. That is why
   * tests/help-specimens.test.ts cuts the manager's chair out of the body and
   * reads the rung off that element alone. Adding a rung-wearing specimen here
   * is therefore free; it was not before. */
  const LADDER: [string, number][] = [
    ["<0", -0.1],
    ["0–2", 0],
    ["2–4", 2],
    ["4–6", 4],
    ["6–8", 6],
    ["8+", 8],
  ];

  /** The two arms already in the rotation when a 🔁 lands on a third — Maddux's
   * and Smoltz's real 1995 seasons, so the seat a trade empties is a real
   * season leaving the club. Two of them because that is the ONLY shape that
   * raises the picker: `tdTapPlayer` completes the swap outright when a man
   * fits exactly one filled seat, and asks which one only when he fits more. */
  const ROTATION = [
    { name: "Maddux", war: 10.8 },
    { name: "Smoltz", war: 4.5 },
  ];

  /** The finale's ledger, in the pills it is actually made of. Counted off
   * `AWARD_POINTS` in the app's own display order rather than written out, so a
   * retuned award cannot leave the sheet quoting last round's number, and a new
   * award appears here without anyone remembering to add it. The skipper's MOY
   * rides the same row on its own constant — it scores through the same sum and
   * is simply not a player's award. */
  const LEDGER: [string, number][] = [
    ...sortAwards(Object.keys(AWARD_POINTS)).map(
      (c): [string, number] => [c, AWARD_POINTS[c]],
    ),
    ["MOY", MANAGER_MOTY_POINTS],
  ];

  const EARNED = BADGE_BY_KEY.hundred;
  const SECRET = BADGE_BY_KEY.twoway;
</script>

<!-- The market row, part for part, and the ONE place this sheet draws one.
     The row is never a button here: these are diagrams, and a tappable
     specimen in a help sheet promises an action the sheet cannot deliver.
     `hint` swaps the WAR chip and the price for the orange instruction the
     real row shows while a pick is in flight — the same either/or the live
     row runs, so a specimen can never show both at once when the board
     never does. -->
{#snippet prow(p: Spec, hint?: string)}
  <div class="prow" class:dead={p.dead} class:swap={p.swap}>
    <span class="pos" class:pit={p.pit}>{p.pos}</span>
    <span class="mid">
      <span class="pname">{p.name}</span>
      {#if p.awards}<span class="badges">{#each p.awards as a (a)}<AwardPill code={a} small />{/each}</span>{/if}
    </span>
    <span class="right">
      {#if hint}
        <span class="confirm hint">{hint}</span>
      {:else}
        <span class="warchip {warTier(p.war)}">{p.war.toFixed(1)}<span class="unit">WAR</span></span>
        <span class="cost {costTier(p.cost)}">{money(p.cost)}</span>
      {/if}
    </span>
  </div>
{/snippet}

<Sheet {onclose} label="How to play" tall title="HOW TO PLAY" confirmLabel="GOT IT">
<!-- Every block below is a direct child of this one div, and the gaps between
     them are set by the rhythm rule in the style block rather than block by
     block. That is why the PayrollBox specimens are wrapped: the rule reaches
     elements this file owns, and a child component's root is not one. A
     `{@render}` introduces no wrapper of its own, so the rows the snippet
     above draws are direct children like everything else. -->
<div class="help">
  <div class="hsec">THE LOOP</div>
  <ul>
    <li>The stove spins you a real team-season, 1985–2025.</li>
    <li>Take <b>one</b> thing per spin: sign a player, or make a hire.</li>
    <li>
      Play until the club is finished: {SLOT_TYPES.length} seats ({SEAT_LINE}) plus a manager.
      Clean House adds an owner and a ballpark.
    </li>
    <li>Then the season is scored. <b>162 points is a perfect season.</b></li>
  </ul>

  <div class="hsec">A PLAYER ROW</div>
  {@render prow(MARKET)}
  <div class="lgnd">
    <span>position</span><span>name + hardware</span><span>WAR</span><span>salary</span>
  </div>
  {@render prow(MARKET_DEAD)}
  <p class="cap">
    Tap a row to sign him. Gray means that seat is taken. Salaries read green when
    they are cheap, orange when they are steep.
  </p>

  <div class="hsec">YOUR SQUAD</div>
  <!-- The real seat component, the real rungs. -->
  <div class="rail">
    <RailSeat
      chair="mgr"
      label="MGR"
      name="Cox"
      meta="1995 ATL"
      tier={warTier(MGR_WINS)}
      war="{signed(MGR_WINS)} W"
      mgw
    />
    {#each SEATS as s (s.label)}
      <RailSeat
        label={s.label}
        name={s.name}
        meta={s.meta}
        tier={s.war === null ? "" : warTier(s.war)}
        war={s.war === null ? null : s.war.toFixed(1)}
      />
    {/each}
  </div>
  <p class="cap">A seat's border color is that player's WAR tier. Dashed is empty.</p>
  <div class="ladder">
    {#each LADDER as [label, war] (label)}
      <span class="warchip {warTier(war)}">{label}</span>
    {/each}
  </div>
  <p class="cap">Six rungs. Every WAR chip and every seat border wears one.</p>
  <ul>
    <li><b>Eight seats:</b> {SEAT_LINE}.</li>
    <li><b>UTIL:</b> any position player.</li>
    <li><b>A manager too</b>, hired from the front office row.</li>
    <li>One man per seat. Full seats gray out.</li>
  </ul>
  <!-- A man who fits two seats, and the tap that settles which. The seats sit
       ABOVE the row here because they sit above it on the board, and because
       the row's own pill is an arrow pointing at them. -->
  {@render prow(UTIL)}
  <p class="cap">A tag like {UTIL.pos} means he fits more than one seat.</p>
  <div class="picks">
    <RailSeat label="IF" pickable />
    <RailSeat label="OF" pickable />
  </div>
  {@render prow(UTIL, "↑ PICK A SLOT")}
  <p class="cap">Tap him and every seat he fits lights up. Tap the one you want.</p>

  <div class="hsec">YOUR PAYROLL</div>
  <!-- The box as a player first meets it, and the reason it is first: under
       Clean House nothing is hired yet, so this is the state they look at
       before any of the three below exist. `capKnown` false is what makes the
       payroll $0 rather than the engine's minBudget floor, and `pending` is
       what puts the two TBD names under the ghosts — the same two props the
       board passes, so this is the pre-owner box and not a picture of one. -->
  <div class="spec">
    <PayrollBox bank="classic" budget={0} spend={0} capKnown={false} pending />
  </div>
  <p class="cap">
    No owner, no payroll. It is $0 until you hire one, and the bar drifts empty.
  </p>
  <div class="spec">
    <PayrollBox
      bank="classic"
      budget={96.7}
      spend={88}
      ownerName="Ted Turner"
      ownerBudget={92.1}
      parkName="Turner Field"
      parkMult={1.05}
    />
  </div>
  <p class="cap">Owner × ballpark sets your payroll. The bar is what you've spent.</p>
  <div class="spec">
    <PayrollBox
      bank="classic"
      budget={96.7}
      spend={111}
      ownerName="Ted Turner"
      ownerBudget={92.1}
      parkName="Turner Field"
      parkMult={1.05}
    />
  </div>
  <p class="cap">
    You can go over. The luxury tax then takes {LUXURY_TAX_PER_M} point per $1M, with no
    cap on it.
  </p>
  <ul>
    <li>
      <b>💼 Clean House:</b> hire an owner for a budget, then a ballpark to multiply it,
      0.85× to 1.15×. Both cost a spin, the same as a player.
    </li>
    <li><b>⚾ Moneyball:</b> a fixed {BANKS.moneyball.cash}. No hires. The 2002 A's.</li>
    <li><b>💸 Blank Check:</b> a fixed {BANKS.blankcheck.cash}. The 2005 Yankees.</li>
  </ul>

  <div class="hsec">BALL KNOWLEDGE</div>
  <ul>
    <li><b>📊 Box Score:</b> WAR, salaries and hardware, all on the card.</li>
    <li><b>🔭 Eye Test:</b> name, position, price. No WAR, no awards, your call.</li>
    <li>Hidden hardware still scores. The mode changes what you see, not what you get.</li>
  </ul>

  <div class="hsec">POWERUPS — ONE USE EACH</div>
  <!-- One entry per powerup, each carrying its OWN pills rather than a shared
       three-state key beside a list of names. A key teaches the vocabulary and
       leaves the player to apply it; these say what tapping this pill does and
       what the pill then reads, which is the question being asked. The armed
       labels are the strings PowerupRow builds — same words, so the sheet is
       naming a thing the player will recognise on sight rather than
       paraphrasing it. -->
  <ul class="puplist">
    <li>
      <PowerupPill label="🎟️ SEASON TICKET" /> Same franchise, any year: a grid of every
      season the club has played.
    </li>
    <li>
      <PowerupPill label="🚚 RELOCATE" /> Same year, any club: a grid of everyone who played
      that season.
    </li>
    <li>
      <PowerupPill label="✌️ DOUBLE PLAY" /> Two signings on one spin. It reads
      <PowerupPill label="✌️ PICK TWO…" state="armed" /> until the first lands, then
      <PowerupPill label="✌️ ONE MORE…" state="armed" />.
    </li>
    <li>
      <PowerupPill label="🔁 TRADE DEADLINE" /> Swap a signed player, owner or ballpark for
      this card's. Armed it reads <PowerupPill label="🔁 TAP A TRADE…" state="armed" /> and
      every row you could swap for goes amber.
    </li>
    <li>
      <PowerupPill label="⭐ PRIMETIME" /> Armed it reads
      <PowerupPill label="⭐ TAP A PLAYER…" state="armed" />, and a tap opens that man's
      whole career: take any season of it.
    </li>
    <li>
      <PowerupPill label="🏠 HOMEGROWN" /> Armed it reads
      <PowerupPill label="🏠 SIGN AT $1M…" state="armed" /> and grays every row that debuted
      elsewhere. The rest cost $1M.
    </li>
  </ul>
  <!-- 🔁's second tap, which is the one no label can carry: the seats he could
       take light up and the row points at them. Both seats are filled, because
       that is the only shape that raises this screen at all — one eligible
       seat and the swap completes on the first tap. -->
  <div class="picks">
    {#each ROTATION as r (r.name)}
      <RailSeat
        label="SP"
        name={r.name}
        meta="1995 ATL"
        tier={warTier(r.war)}
        war={r.war.toFixed(1)}
        pickable
      />
    {/each}
  </div>
  {@render prow({ ...MARKET, swap: true }, "↑ TAP WHO TO TRADE")}
  <p class="cap">
    A trade is two taps: the man you want, then the seat he takes. That season leaves
    the club.
  </p>
  <!-- The two states no entry above can show, since both are a pill that has
       stopped being usable. One label in both, so the only difference on
       screen is the difference being taught. -->
  <div class="pups">
    <PowerupPill label="🎟️ SEASON TICKET" state="off" />
    <PowerupPill label="🎟️ SEASON TICKET" state="spent" />
  </div>
  <div class="lgnd two"><span>not on this spin</span><span>used up</span></div>
  <!-- Says ARMED, and stops there. Arming genuinely stacks; what an armed
       combination can then DO is narrower than "they stack" would promise —
       ⭐ and 🏠 arm together, but an armed ⭐ browses only the rows 🏠 has
       left live. Help copy that overshoots the engine is worse than none. -->
  <p class="cap">
    More than one can be armed on the same spin. A powerup never costs you a spin.
  </p>

  <div class="hsec">SCORING</div>
  <ul>
    <li>
      <b>Wins:</b> {REPLACEMENT_WINS} base + roster WAR + manager (W−L) × {MANAGER_PER_NET_WIN}.
    </li>
    <li>
      <b>Payroll:</b> −{BUDGET_BONUS_MAX} for spending nothing, 0 at half your payroll,
      +{BUDGET_BONUS_MAX} right at it. Over it the bonus is gone and the luxury tax runs
      instead.
    </li>
    <li>
      <b>Ring chasing:</b> +{RING_POINTS} a 💍 World Series ring, +{PENNANT_POINTS} a 🚩
      pennant, +{WBC_CHAMPION_POINTS} a World Baseball Classic gold, +{WBC_RUNNERUP_POINTS}
      a silver. One man can carry a ring and a medal, and both count.
    </li>
    <li><b>Scouting:</b> +{SCOUT_HIT_POINTS} per signing the dream team also wanted.</li>
    <li>
      <b>The dream team</b> is the best club the finale can build from the cards you were
      dealt. Your score is measured against it.
    </li>
  </ul>
  <!-- The trophy case as the pills it is made of. These are the finale's own
       AwardPills, so the ledger a player reaches at the end is a row of things
       they have already seen keyed to a number — which is what a sentence
       spelling out eleven awards and eleven values could never be. -->
  <div class="ledger">
    {#each LEDGER as [code, pts] (code)}
      <span class="pair"><AwardPill {code} />+{pts}</span>
    {/each}
  </div>
  <!-- The one thing the pills cannot say for themselves. 🥈MVP and 🥉MVP are
       BALLOT FINISHES — second and third in the voting — and a player who has
       only ever seen 🥇MVP on a market row has no way to read the other two
       off the medal alone. The old prose spelled all eleven values out to say
       this one sentence; the pills carry the other ten. -->
  <p class="cap">
    <b>Trophy case:</b> every pill a signed player wears scores, and your skipper's MOY
    with them. 🥈 and 🥉 are second and third in that year's voting.
  </p>

  <div class="hsec">THE TROPHY CASE</div>
  <div class="pups">
    <BadgePill badge={EARNED} />
    <BadgePill badge={SECRET} locked />
  </div>
  <div class="lgnd two"><span>earned — tap to see why</span><span>go find it</span></div>
  <p class="cap">Tap 🏆 any time. One lifetime collection, across every mode.</p>

  <div class="hsec">WHERE THE NUMBERS COME FROM</div>
  <!-- Named source by source, and no license claimed: the repo records what
       each file supplied (pipeline/fetch.py, data/owners.json's `source`,
       data/wbc.json's `_source`) and states no terms for any of them. -->
  <ul class="src">
    <li><b>Lahman Baseball Database:</b> rosters, records, salaries, awards, managers, ballparks.</li>
    <li><b>Baseball-Reference:</b> WAR and salaries.</li>
    <li><b>SABR and Wikipedia:</b> club owners.</li>
    <li><b>Wikipedia:</b> WBC rosters.</li>
  </ul>
</div>
</Sheet>

<style>
  /* ---------- the vertical rhythm ----------
     Three values, and every gap on the sheet is one of them:

         16px  opens a section — the space above a .hsec rule
          8px  between blocks inside a section
          4px  ties a label to the specimen it names (.cap, .lgnd)

     Written once over the children rather than as a margin per block, because
     a margin per block is how this sheet ended up with a caption touching the
     payroll box beneath it: `.cap` carried `margin: 6px 0 0` and the pairs that
     needed a gap were spelled out one adjacency at a time (`.cap + .cap`,
     `.cap + ul`). Any pair nobody wrote down got nothing, and `.cap` followed
     by a PayrollBox was one — 0px, the only zero gap on the sheet. A rule over
     the children has no adjacencies to forget.

     It reaches elements this file owns, since a child component's root does not
     carry this file's scope class. That is what the `.spec` wrappers around the
     three PayrollBox specimens are for, and why a new specimen needs one. The
     seat and pill groups need no wrapper of their own: `.rail`, `.picks` and
     `.pups` are this file's elements already, and they exist to arrange the
     child components inside them. */
  .help > * + * {
    margin-top: 8px;
  }
  .help > .hsec {
    margin-top: 16px;
  }
  /* The first heading closes up against Sheet's header. */
  .help > .hsec:first-child {
    margin-top: 0;
  }
  .help > .cap,
  .help > .lgnd {
    margin-top: 4px;
  }

  .hsec {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--muted);
    border-bottom: 2px solid var(--line);
    padding-bottom: 3px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 5px;
  }
  li {
    font-size: 12px;
    line-height: 1.45;
  }
  li b {
    font-weight: 800;
  }
  /* The credit, in the caption's register rather than the body's — it is the
     last thing on the sheet and the least of it. */
  .src li {
    font-size: 11px;
    line-height: 1.4;
    color: var(--muted);
  }
  /* One line under a specimen, saying the one thing the picture cannot. */
  .cap {
    margin: 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--muted);
  }
  /* The part names, sitting under the specimen on the columns they name. The
     ticks point up at the row rather than relying on horizontal luck alone. */
  .lgnd {
    display: grid;
    /* The row's own columns, gaps folded in, under the row's own padding — so
       each tick lands on the part it names instead of near it: 38px tag + 9px
       gap, the flexible name group, 42px chip + 7px gap, 56px price. */
    grid-template-columns: 47px 1fr 49px 56px;
    padding: 0 10px;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--muted);
    text-transform: uppercase;
  }
  .lgnd span {
    text-align: center;
  }
  .lgnd span::before {
    content: "↑";
    display: block;
    opacity: 0.55;
  }
  .lgnd.two {
    grid-template-columns: repeat(2, 1fr);
  }
  .lgnd.three {
    grid-template-columns: repeat(3, 1fr);
  }

  /* The ladder as six of the app's own chips. `.warchip` is global, so these
     rungs ARE the market's and cannot drift from it — the same reasoning that
     put the seats and the pills into components of their own. */
  .ladder {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  /* ---------- specimen: a market row (PlayerList's anatomy) ---------- */
  .prow {
    display: flex;
    align-items: center;
    gap: 9px;
    background: var(--card);
    border: 2.5px solid var(--line);
    border-radius: 11px;
    padding: 6px 10px;
    min-height: 46px;
  }
  .prow.dead {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
    opacity: 0.55;
  }
  /* An armed 🔁 has claimed this row: amber under a dashed ink line, which is
     the app's one ARMED vocabulary rather than a look this sheet invented. */
  .prow.swap {
    background: var(--amber);
    border: 2.5px dashed var(--ink);
  }
  /* The pending pill, PlayerList's numbers exactly — 24px tall (12px type, 8px
     of padding, 4px of border) so the row does not change height when the chip
     and the price step aside for it, and the 8px split 4.28 / 3.72 by app.css's
     optical centering rule at 12px type. Orange because the next tap belongs to
     the rail: the pill is an arrow, not a button. */
  .confirm.hint {
    border: 2px solid var(--orange-8);
    border-radius: 999px;
    background: var(--orange-2);
    color: var(--ink);
    font-weight: 800;
    font-size: 12px;
    line-height: 1;
    padding: 4.28px 12px 3.72px;
    white-space: nowrap;
  }
  .prow.dead > .pos,
  .prow.dead > .mid {
    filter: grayscale(1);
  }
  .prow.dead .warchip,
  .prow.dead .cost {
    filter: saturate(0.7);
  }
  .prow.dead .pos {
    background: transparent;
  }
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
  .prow > .mid {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 6px;
    min-width: 0;
    overflow: hidden;
  }
  .pname {
    font-weight: 800;
    font-size: 14px;
    line-height: 1.15;
    white-space: nowrap;
  }
  .badges {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    flex: none;
  }
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 7px;
    flex: none;
  }
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

  /* ---------- the seat and pill specimens' CONTAINERS ---------- */
  /* The seats and the pills are the real components now; only the boxes that
     arrange them live here, and each one mirrors its screen's own arrangement.
     Two seat columns rather than four: the phone rail is 2×4 and this is 2×2,
     the same grid at a size that leaves room for a caption beside it. */
  .rail {
    display: grid;
    grid-template-columns: auto repeat(2, 1fr);
    gap: 6px;
  }
  /* And the rail's OTHER arrangement at the width the rail changes at, because
     a help sheet has to teach the screen the reader is about to be looking at.
     RailSeat turns itself into a full-width row here; a seat drawn that way
     inside a two-column grid is a row with no room, and the names clip. Same
     breakpoint, same flex column, same manager-first order as RosterRail. */
  @media (min-width: 760px) {
    .rail {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
  }
  /* The two seats a pick offers, side by side. The rail's own grid is nine
     chairs wide and this is a crop of it — the two that lit up — so it gets the
     two columns it holds rather than the rail's `auto repeat(2, 1fr)`, whose
     leading `auto` track belongs to the manager's chair. Same gap as the rail,
     and the same collapse to a column at the width RailSeat changes shape at,
     for the same reason: a full-width seat row inside a two-column grid is a
     row with no room. */
  .picks {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  @media (min-width: 760px) {
    .picks {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
  }

  /* `container-type` is PowerupPill's contract — its narrow type tier is keyed
     to the width of the row holding it, exactly as PowerupRow's is, so a pill
     in this sheet sizes itself the way a pill on the board does. */
  .pups {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 8px 7px;
    container-type: inline-size;
  }
  /* The powerup entries. Pills sit INLINE in the sentence that explains them,
     so the name of the thing and the thing itself are the same object on the
     page; the extra leading is what keeps a line of 12px type readable with a
     25px pill standing in it. It declares the same container as `.pups` because
     the container query is the pill's contract wherever a pill is drawn — a
     pill with no container silently stays at base size. */
  .puplist {
    gap: 8px;
    container-type: inline-size;
  }
  .puplist li {
    line-height: 1.85;
  }

  /* The ledger's pills against what each is worth. A wrapping row rather than a
     grid: the pills are different widths by design (a 🥇MVP is wider than a GG)
     and a column grid would either clip the wide ones or leave the narrow ones
     stranded in a track sized for someone else. */
  .ledger {
    display: flex;
    flex-wrap: wrap;
    gap: 5px 9px;
    font-size: 11px;
    font-weight: 800;
  }
  .pair {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
</style>

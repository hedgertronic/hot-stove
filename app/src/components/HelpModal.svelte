<script lang="ts">
  import { BADGE_BY_KEY } from "../lib/badges";
  import { SLOT_TYPES } from "../lib/engine.svelte";
  import { costTier, money, signed, slotLabel, warTier } from "../lib/format";
  import { BANKS } from "../lib/modes";
  import { MANAGER_PER_NET_WIN } from "../lib/scoring";
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
   * layer to lift out of it that would not be the whole component.
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

  /** One row off a real card: a generational season with hardware on it. */
  const MARKET = {
    pos: "SP",
    name: "Pedro Martínez",
    awards: ["CY", "AS"],
    war: 9.8,
    cost: 54.6,
  };
  /** The same row with nowhere to put him — the market's gray. */
  const MARKET_DEAD = { pos: "C", name: "Iván Rodríguez", war: 6.4, cost: 44 };

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
   * seat's border wears the prefixed one (`war-elite`). Keeping them apart is
   * what lets tests/help-specimens.test.ts still prove the manager chair's rung
   * is derived: six rungs of ladder do not put `war-star` in the markup. */
  const LADDER: [string, number][] = [
    ["<0", -0.1],
    ["0–2", 0],
    ["2–4", 2],
    ["4–6", 4],
    ["6–8", 6],
    ["8+", 8],
  ];

  const EARNED = BADGE_BY_KEY.hundred;
  const SECRET = BADGE_BY_KEY.twoway;
</script>

<Sheet {onclose} label="How to play" tall title="HOW TO PLAY" confirmLabel="GOT IT">
<!-- Every block below is a direct child of this one div, and the gaps between
     them are set by the rhythm rule in the style block rather than block by
     block. That is why the two PayrollBox specimens are wrapped: the rule
     reaches elements this file owns, and a child component's root is not one. -->
<div class="help">
  <div class="hsec">THE LOOP</div>
  <ul>
    <li>The stove spins you a real team-season, 1985–2025.</li>
    <li>Take <b>one</b> thing per spin — sign a player, or make a hire.</li>
    <li>
      Play until the club is finished: {SLOT_TYPES.length} seats — {SEAT_LINE} — plus a
      manager. Clean House adds an owner and a ballpark.
    </li>
    <li>Then the season is scored. <b>162 points is a perfect season.</b></li>
  </ul>

  <div class="hsec">A PLAYER ROW</div>
  <!-- The market row, part for part. The row is not a button here: this is a
       diagram, and a tappable specimen in a help sheet promises an action the
       sheet cannot deliver. -->
  <div class="prow">
    <span class="pos pit">{MARKET.pos}</span>
    <span class="mid">
      <span class="pname">{MARKET.name}</span>
      <span class="badges">{#each MARKET.awards as a}<AwardPill code={a} small />{/each}</span>
    </span>
    <span class="right">
      <span class="warchip {warTier(MARKET.war)}">{MARKET.war.toFixed(1)}<span class="unit">WAR</span></span>
      <span class="cost {costTier(MARKET.cost)}">{money(MARKET.cost)}</span>
    </span>
  </div>
  <div class="lgnd">
    <span>position</span><span>name + hardware</span><span>WAR</span><span>salary</span>
  </div>
  <div class="prow dead">
    <span class="pos">{MARKET_DEAD.pos}</span>
    <span class="mid"><span class="pname">{MARKET_DEAD.name}</span></span>
    <span class="right">
      <span class="warchip {warTier(MARKET_DEAD.war)}">{MARKET_DEAD.war.toFixed(1)}<span class="unit">WAR</span></span>
      <span class="cost {costTier(MARKET_DEAD.cost)}">{money(MARKET_DEAD.cost)}</span>
    </span>
  </div>
  <p class="cap">
    Tap a row to sign him. Gray means that seat is already taken. Salaries read green
    when they are cheap, orange when they are steep.
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
  <p class="cap">Six rungs. Every WAR chip and every seat border wears one of them.</p>
  <ul>
    <li><b>Eight seats:</b> {SEAT_LINE}.</li>
    <li><b>UTIL</b> takes any position player — the flexible one.</li>
    <li><b>Plus a manager</b>, hired from the front office row.</li>
    <li>You can't sign two men into one seat. Full seats gray out.</li>
  </ul>

  <div class="hsec">YOUR PAYROLL</div>
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
    You can go over. The luxury tax then takes 1 point for every $1M, with no cap on
    it.
  </p>
  <ul>
    <li>
      <b>💼 Clean House</b> — you have <b>no payroll at all</b> until you hire an
      owner. Hire one for a budget, then a ballpark to multiply it, 0.85× to
      1.15×. Both cost a spin, the same as a player does.
    </li>
    <li>
      <b>⚾ Moneyball</b> — a fixed {BANKS.moneyball.cash}. No owner, no ballpark. The 2002
      A's.
    </li>
    <li><b>💸 Blank Check</b> — a fixed {BANKS.blankcheck.cash}. The 2005 Yankees.</li>
  </ul>

  <div class="hsec">BALL KNOWLEDGE</div>
  <ul>
    <li><b>📊 Box Score</b> — every number on the card: WAR, salaries, hardware.</li>
    <li>
      <b>🔭 Eye Test</b> — no WAR, no awards. Name, position, price, your call.
    </li>
    <li>Hidden hardware still scores. The mode changes what you see, not what you get.</li>
  </ul>

  <div class="hsec">POWERUPS — ONE USE EACH</div>
  <!-- The three states a pill moves through, side by side. Same geometry as
       the row under the spin banner, so the sheet is naming things the player
       can already see. -->
  <div class="pups">
    <PowerupPill label="🚚 RELOCATE" />
    <PowerupPill label="⭐ TAP A PLAYER…" state="armed" />
    <PowerupPill label="🎟️ SEASON TICKET" state="spent" />
  </div>
  <div class="lgnd three">
    <span>ready</span><span>armed — do the thing</span><span>spent</span>
  </div>
  <ul>
    <li><b>🎟️ SEASON TICKET</b> — same franchise, any year.</li>
    <li><b>🚚 RELOCATE</b> — same year, any club.</li>
    <li><b>✌️ DOUBLE PLAY</b> — two signings on one spin.</li>
    <li><b>🔁 TRADE DEADLINE</b> — swap a signed player, owner, or stadium for this card's.</li>
    <li><b>⭐ PRIMETIME</b> — browse a whole career and take any season of it.</li>
    <li><b>🏠 HOMEGROWN</b> — players who debuted with this club sign for $1M.</li>
  </ul>
  <!-- Says ARMED, and stops there. Arming genuinely stacks; what an armed
       combination can then DO is narrower than "they stack" would promise —
       ⭐ and 🏠 arm together, but an armed ⭐ browses only the rows 🏠 has
       left live. Help copy that overshoots the engine is worse than none. -->
  <p class="cap">
    More than one can be armed on the same spin. A powerup never costs you a spin.
  </p>

  <div class="hsec">SCORING</div>
  <ul>
    <li><b>Wins:</b> 50 base + roster WAR + manager (W−L) × {MANAGER_PER_NET_WIN}.</li>
    <li>
      <b>Payroll:</b> −10 for spending nothing, 0 at half your payroll, +10 right at it.
      Over it the bonus is gone and the luxury tax runs instead.
    </li>
    <li>
      <b>Trophy case:</b> MVP +3 · Cy Young +3 · ROY +2 · 🥈 second on either ballot +2 /
      🥉 third +1 · All-Star, Gold Glove, Silver Slugger +1 each · your skipper's MOY +2.
    </li>
    <li>
      <b>Ring chasing:</b> per player, +3 a 💍 World Series ring, +1 a 🚩 pennant, +2 a
      World Baseball Classic gold, +1 a silver. One man can carry both a ring and a
      medal, and both count.
    </li>
    <li><b>Scouting:</b> +1 per signing the dream team also wanted.</li>
    <li>
      <b>The dream team</b> is the best club the finale can build out of the same cards
      you were dealt. It is what your score is measured against.
    </li>
  </ul>

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
    <li>
      <b>The Lahman Baseball Database</b> — rosters, records, salaries, awards, All-Star
      teams, managers, the Hall of Fame, ballparks and attendance.
    </li>
    <li><b>Baseball-Reference</b> — WAR, and the salaries Lahman doesn't carry.</li>
    <li><b>SABR and Wikipedia</b> — who owned which club, and when.</li>
    <li><b>Wikipedia</b> — the World Baseball Classic rosters.</li>
  </ul>
  <p class="cap">Names and numbers only. No logos, no photographs.</p>
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
     two PayrollBox specimens are for, and why a new specimen needs one. */
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
     breakpoint, same flex column, same manager-last order as RosterRail. */
  @media (min-width: 760px) {
    .rail {
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
</style>

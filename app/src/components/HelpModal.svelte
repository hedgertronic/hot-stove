<script lang="ts">
  import { BADGE_BY_KEY } from "../lib/badges";
  import { costTier, money, warTier } from "../lib/format";
  import AwardPill from "./AwardPill.svelte";
  import BadgePill from "./BadgePill.svelte";
  import PayrollBox from "./PayrollBox.svelte";
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
   * From plain object literals, never a `Game`. Three of them go through the
   * real component, because those components already take plain props and are
   * already in the bundle: `PayrollBox` (the finale renders it for a club no
   * Game exists for), `BadgePill`, and `AwardPill`. The other two — the market
   * row and the rail seats — are drawn from the same markup and classes their
   * real screens use, because those components take a `Game` and importing one
   * here would wire a help sheet to live engine state.
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

  /** One row off a real card: a generational season with hardware on it. */
  const MARKET = {
    pos: "SP",
    name: "Pedro Martínez",
    awards: ["CY", "AS"],
    war: 9.7,
    cost: 12.5,
  };
  /** The same row with nowhere to put him — the market's gray. */
  const MARKET_DEAD = { pos: "C", name: "Iván Rodríguez", war: 5.2, cost: 6.9 };

  /** Four of the nine chairs: two filled, two waiting. */
  const SEATS = [
    { label: "C", name: "Piazza", meta: "1997 LAN", war: 6.4 },
    { label: "IF", name: "", meta: "", war: 0 },
    { label: "SP", name: "Maddux", meta: "1995 ATL", war: 9.7 },
    { label: "RP", name: "", meta: "", war: 0 },
  ];

  const EARNED = BADGE_BY_KEY.hundred;
  const SECRET = BADGE_BY_KEY.twoway;
</script>

<Sheet {onclose} label="How to play" tall title="HOW TO PLAY" confirmLabel="GOT IT">
  <div class="hsec">THE LOOP</div>
  <ul>
    <li>The stove spins you a random team-season, 1985–2025.</li>
    <li>Take <b>one</b> thing per spin — sign a player, or make a hire.</li>
    <li>Fill 8 seats — C · IF ×2 · OF · UTIL · SP ×2 · RP — plus a manager.</li>
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
  <p class="cap">Tap a row to sign. Gray means that seat is already taken.</p>

  <div class="hsec">YOUR SQUAD</div>
  <div class="rail">
    <div class="mgr filled"><b>MGR</b><span>Cox</span><i>1995 ATL</i></div>
    {#each SEATS as s (s.label)}
      {#if s.name}
        <div class="cell filled war-{warTier(s.war)}">
          <b>{s.label}</b><span>{s.name}</span><i>{s.meta}</i>
        </div>
      {:else}
        <div class="cell empty"><b>{s.label}</b></div>
      {/if}
    {/each}
  </div>
  <p class="cap">A seat's border color is that player's WAR tier. Dashed is empty.</p>

  <div class="hsec">YOUR PAYROLL</div>
  <PayrollBox
    bank="classic"
    budget={96.7}
    spend={88}
    ownerName="Ted Turner"
    ownerBudget={92.1}
    parkName="Turner Field"
    parkMult={1.05}
  />
  <p class="cap">Owner × ballpark sets your payroll. The bar is what you've spent.</p>
  <PayrollBox
    bank="classic"
    budget={96.7}
    spend={111}
    ownerName="Ted Turner"
    ownerBudget={92.1}
    parkName="Turner Field"
    parkMult={1.05}
  />
  <p class="cap">You <i>can</i> overspend — the luxury tax just eats your score.</p>
  <ul>
    <li><b>💼 Clean House</b> — hire an owner and a ballpark to set your payroll.</li>
    <li><b>⚾ Moneyball</b> — a fixed $51.5M, the 2002 A's.</li>
    <li><b>💸 Blank Check</b> — a fixed $203.2M, the 2005 Yankees.</li>
  </ul>

  <div class="hsec">BALL KNOWLEDGE</div>
  <ul>
    <li><b>📊 Box Score</b> — every number on the card: WAR, salaries, hardware.</li>
    <li>
      <b>🔭 Eye Test</b> — no WAR, no awards. Name, position, price, your call.
    </li>
  </ul>

  <div class="hsec">POWERUPS — ONCE PER GAME</div>
  <!-- The three states a pill moves through, side by side. Same geometry as
       the row under the spin banner, so the sheet is naming things the player
       can already see. -->
  <div class="pups">
    <span class="pp">🚚 RELOCATE</span>
    <span class="pp armed">⭐ TAP A PLAYER…</span>
    <span class="pp spent">🎟️ SEASON TICKET</span>
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
  <p class="cap">More than one can be armed on the same spin.</p>

  <div class="hsec">SCORING</div>
  <ul>
    <li><b>Wins:</b> 50 base + roster WAR + manager (W−L) × 0.2.</li>
    <li><b>Payroll:</b> up to +10 for spending it all; −1 per $1M over.</li>
    <li>
      <b>Trophy case:</b> MVP +3 · Cy Young +3 · ROY +2 · 🥈 +2 / 🥉 +1 ·
      All-Star, Gold Glove, Silver Slugger +1 each · your skipper's MOY +2.
    </li>
    <li><b>Ring chasing:</b> 💍 +3 / 🚩 +1 per player from a title or pennant year.</li>
    <li><b>Scouting:</b> +1 per signing who makes the dream team.</li>
  </ul>

  <div class="hsec">THE TROPHY CASE</div>
  <div class="pups">
    <BadgePill badge={EARNED} />
    <BadgePill badge={SECRET} locked />
  </div>
  <div class="lgnd two"><span>earned — tap to see why</span><span>go find it</span></div>
  <p class="cap">Tap 🏆 any time. One lifetime collection, across every mode.</p>
</Sheet>

<style>
  .hsec {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--muted);
    border-bottom: 2px solid var(--ink);
    padding-bottom: 3px;
    margin: 14px 0 6px;
  }
  /* The first heading closes up against Sheet's header. */
  .hsec:first-child {
    margin-top: 0;
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
  /* One line under a specimen, saying the one thing the picture cannot. */
  .cap {
    margin: 6px 0 0;
    font-size: 11px;
    line-height: 1.4;
    color: var(--muted);
  }
  .cap + .cap,
  .cap + ul {
    margin-top: 8px;
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
    margin: 3px 0 8px;
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

  /* ---------- specimen: a market row (PlayerList's anatomy) ---------- */
  .prow {
    display: flex;
    align-items: center;
    gap: 9px;
    background: var(--card);
    border: 2.5px solid var(--ink);
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
    border: 2px solid var(--ink);
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

  /* ---------- specimen: the roster rail (RosterRail's anatomy) ---------- */
  /* Four seats rather than eight: the grid is 2×4 on the real screen and 2×2
     here, which is the same object at a size that leaves room for a caption. */
  .rail {
    display: grid;
    grid-template-columns: auto repeat(2, 1fr);
    gap: 6px;
  }
  .cell,
  .mgr {
    border: 2.5px solid var(--ink);
    border-radius: 9px;
    background: var(--card);
    text-align: center;
    padding: 5px 2px;
    font-size: 10px;
    line-height: 1.25;
    min-height: 52px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .cell b,
  .mgr b {
    display: block;
    font-size: 9px;
    letter-spacing: 0.07em;
    color: var(--muted);
  }
  .cell span,
  .mgr span {
    display: block;
    font-weight: 800;
    font-size: 11px;
  }
  .cell i,
  .mgr i {
    display: block;
    font-style: normal;
    font-size: 8.5px;
    color: var(--muted);
    font-weight: 700;
  }
  /* All six rungs, not just the two the specimens land on: the seats above are
     a literal, and a rewritten number must move the border rather than quietly
     lose it. */
  .cell.war-neg {
    border-color: var(--war-neg);
  }
  .cell.war-low {
    border-color: var(--war-low);
  }
  .cell.war-mid {
    border-color: var(--war-mid);
  }
  .cell.war-high {
    border-color: var(--war-high);
  }
  .cell.war-star {
    border-color: var(--war-star);
  }
  .cell.war-elite {
    border-color: var(--war-elite);
  }
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
  /* The manager's chair spans both rows on the left, as it does on the real
     rail; upright here rather than rotated, because a 90° label at this size
     costs more legibility than the fidelity buys. */
  .mgr {
    grid-column: 1;
    grid-row: 1 / 3;
    width: 52px;
  }

  /* ---------- specimen: powerup pills (PowerupRow's anatomy) ---------- */
  .pups {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    gap: 8px 7px;
  }
  .pp {
    display: inline-flex;
    align-items: center;
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--card);
    padding: 5px 8px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .pp.armed {
    background: var(--orange-2);
    border-color: var(--orange-8);
    color: var(--ink);
  }
  .pp.spent {
    opacity: 0.32;
  }
</style>

<script lang="ts">
  import { BADGE_BY_KEY } from "../lib/badges";
  import { SLOT_TYPES } from "../lib/engine.svelte";
  import {
    costTier,
    money,
    posLabel,
    signed,
    slotLabel,
    sortAwards,
    statValue,
    warTier,
  } from "../lib/format";
  import { BANKS } from "../lib/modes";
  import { debugLogFromStorage } from "../lib/share";
  import {
    AWARD_POINTS,
    BUDGET_BONUS_MAX,
    LUXURY_TAX_PER_M,
    MANAGER_MOTY_POINTS,
    MANAGER_PER_NET_WIN,
    PENNANT_POINTS,
    GAMES,
    REPLACEMENT_WINS,
    RING_POINTS,
    SCOUT_HIT_POINTS,
    WBC_CHAMPION_POINTS,
    WBC_RUNNERUP_POINTS,
    budgetBonus,
    luxuryTax,
    round1,
  } from "../lib/scoring";
  import type { CardPlayer } from "../lib/types";
  import AwardPill from "./AwardPill.svelte";
  import BadgePill from "./BadgePill.svelte";
  import BugGlyph from "./BugGlyph.svelte";
  import MarketRow from "./MarketRow.svelte";
  import PayrollBox from "./PayrollBox.svelte";
  import PowerupPill from "./PowerupPill.svelte";
  import RailSeat from "./RailSeat.svelte";
  import Sheet from "./Sheet.svelte";
  import SpecialRows, { fans, type SpecimenRow } from "./SpecialRows.svelte";

  /** How to play, taught mostly in pictures.
   *
   * The screens a player is about to meet are made of six things words are
   * bad at: a market row, the roster rail's seats, the three FRONT OFFICE
   * tiles, the payroll meter, a powerup pill, and a badge. Each one appears
   * here as ITSELF — same anatomy, same classes, same tier ladder — with one
   * line of copy beside it, instead of a paragraph describing a picture the
   * player cannot see.
   *
   * That extends to the one MOMENT a still row cannot carry. Signing a man who
   * fits two seats is a tap that changes the whole screen: the rail lights up
   * and the row's right-hand column turns into an orange instruction pointing
   * at it. It is drawn here as the screen it actually is — armed seats above,
   * instructed row below, in the order the board stacks them, so the ↑ in the
   * pill points at the seats it is talking about.
   *
   * The powerups get no such screen. Each one is a row of the POWERUPS table —
   * its pill and a line of copy naming the armed label it turns into — and a
   * mocked-up screenshot of one mid-use taught nothing that line did not
   * already say.
   *
   * ---- How the specimens are built ----
   *
   * From plain object literals, never a `Game`. All but one go through the
   * REAL component: `PayrollBox`, `BadgePill`, `AwardPill`, `RailSeat`,
   * `PowerupPill` and `SpecialRows`. The seat and the pill were lifted out of
   * `RosterRail` and `PowerupRow` into components that take plain values;
   * `SpecialRows` takes a `specimen` row list for the same reason, so the
   * FRONT OFFICE tiles here are the game's own tiles and cannot drift.
   *
   * EVERY EMBEDDED CONTROL IS INERT. A specimen is a diagram, and a tappable
   * control in a help sheet promises an action the sheet cannot deliver. The
   * components that render buttons (`RailSeat` pickable, `SpecialRows`) take
   * a specimen flag that puts the native `inert` attribute on them — no tab
   * stop, no click, no pointer cursor — and `PowerupPill` renders a `<span>`
   * whenever it has no `onclick`. tests/help-specimens.test.ts pins that the
   * only live buttons on the sheet are Sheet's own two exits.
   *
   * The market row is the one specimen still drawn by hand. `PlayerList` is a
   * list of buttons wired to signings and pickers, and there is no presentation
   * layer to lift out of it that would not be the whole component. It is drawn
   * ONCE, as the `prow` snippet, because four rows of it appear on the sheet —
   * resting, gray, utility and mid-pick — and four copies of one hand-copy is
   * four chances for three of them to drift.
   *
   * Nothing here comes from `src/lab`. That directory is the DEV-only fixture
   * gallery, excluded from the production bundle by an `import.meta.env.DEV`
   * guard, and an import from this file would pull the whole lab into the
   * shipped app.
   *
   * The WAR chip is the app.css ladder, not a copy: one ladder, one home. The
   * row rules below ARE a second copy of PlayerList's, and are meant to be —
   * a specimen that drifts from the screen it teaches is worse than no
   * specimen, so it is the same numbers written out rather than the same
   * component wired to a fake game.
   *
   * SECTION HEADERS are the game's own `.psep` device — the dashed rule with
   * the centered title the board uses for FRONT OFFICE / PLAYERS — rather
   * than a header style private to this sheet. */
  let { onclose, gameLog = null }: { onclose: () => void; gameLog?: string | null } = $props();

  /** Build the GitHub report only from explicit, useful diagnostics: the
   * current run supplied by the HUD (preferred), the stored run when Help is
   * opened from home, browser identity, and this page URL. No storage dump or
   * unrelated state leaves the app. The href is assembled at render time so
   * a newly committed move is included when the sheet opens. */
  function reportHref(): string {
    const code = gameLog ?? debugLogFromStorage();
    const browser = typeof navigator === "undefined" ? "Unavailable" : navigator.userAgent;
    const page = typeof location === "undefined" ? "Unavailable" : location.href;
    const body = [
      "### What happened?",
      "Tell us what you expected and what happened instead.",
      "",
      "### Game code",
      code ? `\`${code}\`` : "No game code was available.",
      "",
      "### Browser",
      browser,
      "",
      "### Page",
      page,
    ].join("\n");
    const params = new URLSearchParams({ title: "Bug: ", body });
    return `https://github.com/hedgertronic/hot-stove/issues/new?${params}`;
  }

  /* EVERY FIGURE BELOW IS THE REAL ONE, read off data/cards, and every tier is
   * DERIVED from it by the app's own `warTier`. Both halves matter. A caption a
   * few lines down says a seat's chip is that player's WAR tier, so a
   * hand-picked tier beside a hand-picked number is the help sheet teaching the
   * ladder wrong — the exact failure that shipped here for a round: a manager
   * chair labelled "star" over an invented "+9.4 W", which is elite.
   * Nothing here is a plausible-looking invention any more. */

  /** What the `prow` snippet needs to draw one market row. The three state
   * flags are the row's own three classes, not a fourth vocabulary. */
  interface Spec {
    pos: string;
    name: string;
    awards?: string[];
    war: number;
    cost: number;
    /** A pitcher's position tag is filled to the ring's own gray rather than
     * card white. */
    pit?: boolean;
    /** Nowhere to put him: the market's gray. */
    dead?: boolean;
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
    pos: posLabel({ pos: "2B", posG: { c: 0, if: 108, of: 75 } } as CardPlayer),
    name: "Ben Zobrist",
    awards: ["AS"],
    war: 8.6,
    cost: 1,
  };

  /** All eight player seats in the order SLOT_TYPES defines them: two filled
   * (Piazza and Maddux at their real numbers), six empty waiting seats. The
   * four-column phone grid and the stacked wide layout both draw this same set,
   * so the sheet shows the club as the board shows it. `slotLabel` maps FLEX to
   * UTIL, the same way the live rail labels it. */
  const SEATS = [
    { label: slotLabel("C"),    name: "Piazza", meta: "1997 LAD", war: 8.7 },
    { label: slotLabel("IF"),   name: null,     meta: null,       war: null },
    { label: slotLabel("IF"),   name: null,     meta: null,       war: null },
    { label: slotLabel("OF"),   name: null,     meta: null,       war: null },
    { label: slotLabel("FLEX"), name: null,     meta: null,       war: null },
    { label: slotLabel("SP"),   name: "Maddux", meta: "1995 ATL", war: 10.8 },
    { label: slotLabel("SP"),   name: null,     meta: null,       war: null },
    { label: slotLabel("RP"),   name: null,     meta: null,       war: null },
  ];

  /** Bobby Cox's 1995 Braves, 90–54, through the engine's own expression — so
   * the chair's numeral and the rung it wears come from one number, and that
   * number is the one the game would put there. */
  const MGR_WINS = (90 - 54) * MANAGER_PER_NET_WIN;

  /** The FRONT OFFICE as the ATL 1995 card deals it — the same club the rail
   * and trade specimens draft from, so the whole sheet teaches ONE season.
   * Owner budget, park, attendance, multiplier and record are the card's own
   * figures (tests/help-specimens.test.ts reads them back off the card), and
   * every derived string goes through the game's own formatter: `money`,
   * `fans`, and the skipper's bare value + WINS unit exactly as SpecialRows
   * builds them. */
  const FO_OWNER_BUDGET = 93.2;
  const FO_PARK_MULT = 1.09;
  const FRONT_OFFICE: SpecimenRow[] = [
    { key: "owner", cls: "", ic: "💰", who: "Ted Turner", meta: "", val: money(FO_OWNER_BUDGET) },
    {
      key: "stadium",
      cls: "stad",
      ic: "🏟️",
      who: "Atlanta-Fulton County Stadium",
      meta: fans(2561831),
      val: `×${FO_PARK_MULT.toFixed(2)}`,
    },
    {
      key: "manager",
      cls: "skip",
      ic: "🧢",
      who: "Bobby Cox",
      meta: "90–54",
      val: MGR_WINS.toFixed(1),
      unit: "WINS",
      // Without the rung the specimen draws plain type ("7.2WINS", no chip)
      // while the caption below promises a chip — the same one-mapping rule
      // the rail's MGR seat follows, three lines down.
      tier: warTier(MGR_WINS),
    },
  ];
  /** The payroll those two hires produce — owner × ballpark, the engine's own
   * multiplication, so the payroll specimens below quote the same club. */
  const FO_BUDGET = FO_OWNER_BUDGET * FO_PARK_MULT;

  /** One run per unique slot label — [label, count, isPitcher] — with duplicates
   * collapsed. Built once so the slot-badges chips and any prose summary share
   * the same derived array; a seat added to SLOT_TYPES moves both with it.
   * SP and RP are the pitcher seats; their chips wear the line-gray fill the
   * market rows use, matching the established read a player brings to the sheet.
   * eligibility.ts's isPitcher() works on CardPlayer.pos, not a slot type
   * string, so the pitcher check lives here as its own two literals. */
  const SEAT_BADGE_RUNS: [string, number, boolean][] = (() => {
    const runs: [string, number, boolean][] = [];
    for (const t of SLOT_TYPES) {
      const label = slotLabel(t);
      const pit = t === "SP" || t === "RP";
      const last = runs[runs.length - 1];
      if (last && last[0] === label) last[1] += 1;
      else runs.push([label, 1, pit]);
    }
    return runs;
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
   * The sheet draws a prefixed rung on several seats at once, so no assertion
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

  /** One aligned row per powerup: the resting pill and what its tap opens.
   * Where the copy quotes a label ("PICK TWO…"), it quotes the string
   * PowerupRow builds — same words, so the sheet names a thing the player
   * will recognise on sight rather than paraphrasing it. The armed pills
   * themselves are not drawn: arming is taught by playing, and
   * tests/help-specimens.test.ts pins their absence. */
  const POWERUPS: { label: string; text: string }[] = [
    {
      label: "🎟️ SEASON TICKET",
      text: "Same franchise, any year. Opens a grid of every season the club has played; tap one and that season is your card.",
    },
    {
      label: "🚚 RELOCATE",
      text: "Same year, any club. Opens a grid of everyone who played that season; tap one and that club is your card.",
    },
    {
      label: "✌️ DOUBLE PLAY",
      text: "Two signings on one spin. The pill reads PICK TWO… until the first lands, then ONE MORE… until the second.",
    },
    {
      label: "🔁 TRADE DEADLINE",
      text: "Swap a signed player, owner or ballpark for this card's. Every row you could take goes orange; tap the one you want, then who he replaces.",
    },
    {
      label: "⭐ PRIME TIME",
      text: "Tap any player and his whole career opens; take any season of it. The open skipper tile browses careers too.",
    },
    {
      label: "🏠 HOMEGROWN",
      text: "Rows that debuted with another club gray out; everyone still live signs for $1M.",
    },
  ];

  /** The payroll bonus, drawn as the bar itself at three fills spanning the
   * bonus range — the ONE thing a sentence about a sliding scale cannot show
   * is where on the bar a number sits. All three quote the ATL 1995 payroll
   * the box specimens above do, and every figure is run through the game's own
   * `budgetBonus` rather than typed out, so a retuned constant moves the
   * captions with it. `mini` is PayrollBox's ledger-row bar, the same object
   * under the same rules at a third the height.
   *
   * The fourth row crosses the cap on purpose: the meter goes orange, the
   * percent runs past 100, and the figure switches from the bonus to the
   * luxury tax — the full arc a payroll can travel, gold to green to orange,
   * in four bars. (The full-size PayrollBox up in YOUR PAYROLL shows the same
   * over state with its SPENT/OVER labels.) */
  const METERS: { spend: number; label: string }[] = [
    { spend: 40,   label: "low"  },  // 39%  →  −2.1 PTS  (below half: bar costs points)
    { spend: 76,   label: "mid"  },  // 75%  →  +5.0 PTS
    { spend: 96.5, label: "high" },  // 95%  →  +9.0 PTS
    { spend: 111,  label: "over" },  // 109% →  −9.4 PTS  (past the cap: luxury tax)
  ];
  /** The budget bonus at this spend level, rounded. Negative below half the
   * cap, zero at half, positive right at it. Keyed to the formula's zero
   * crossing (spend = budget/2) rather than a 50% literal so the percent
   * warning and the red points can never disagree at a rounding edge. */
  const meterBonus = (spend: number) => round1(budgetBonus(spend, FO_BUDGET));
  /** Points string: bonus below the cap, tax above it. */
  const meterPts = (spend: number) =>
    spend > FO_BUDGET
      ? signed(-luxuryTax(spend, FO_BUDGET))
      : signed(meterBonus(spend));
  /** Spend as a percentage of the payroll cap, rounded to the nearest whole
   * number. */
  const meterPct = (spend: number) => Math.round((spend / FO_BUDGET) * 100);

  /** How many ⭐ the scouting row can hold: every seat plus the skipper. Owner
   * and ballpark are not scoutable (bestroster.ts counts players and the
   * skipper only), and the count is derived off SLOT_TYPES for the same reason
   * SEAT_BADGE_RUNS is — a seat added to the game must not need this number found. */
  const DREAM_SEATS = SLOT_TYPES.length + 1;
  /** A middling scouting report, drawn the way the finale draws one: a run of
   * stars, one per find, against what the run is worth. */
  const SCOUT_HITS = 4;

  /** The trophy case, in the pills it is actually made of. Counted off
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

  /** RING CHASING, one row per honour, each priced off its own scoring
   * constant — the emojis are the finale's own pedigree glyphs. */
  const RINGS: [string, string, number][] = [
    ["💍", "World Series ring", RING_POINTS],
    ["🚩", "Pennant, Series lost", PENNANT_POINTS],
    ["🥇", "World Baseball Classic gold", WBC_CHAMPION_POINTS],
    ["🥈", "World Baseball Classic silver", WBC_RUNNERUP_POINTS],
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
{#snippet prow(p: Spec, hint?: "slot" | "trade")}
  <div class="prow" class:dead={p.dead}>
    <!-- The market's own MarketRow — the same component PlayerList wraps in
         its button, so this specimen cannot drift from the live row (both of
         the sheet's real staleness bugs lived in the old hand copy).
         `hintAbove` pins the hint's ↑ at every width: on this sheet the
         armed seats sit above the row in every layout, so the wide tier's ←
         would point at nothing. -->
    <MarketRow
      pos={p.pos}
      pit={p.pit}
      name={p.name}
      awards={p.awards}
      priceText={money(p.cost)}
      priceTier={costTier(p.cost)}
      war={p.war}
      hint={hint ?? null}
      hintAbove
      dead={p.dead}
    />
  </div>
{/snippet}

{#snippet corner()}
  <a
    class="report"
    href={reportHref()}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Report a bug on GitHub"
    title="Report a bug"
  ><BugGlyph /></a>
{/snippet}

<Sheet {onclose} label="How to play" tall title="HOW TO PLAY" confirmLabel="GOT IT" {corner}>
<!-- Every block below is a direct child of this one div, and the gaps between
     them are set by the rhythm rule in the style block rather than block by
     block. That is why the PayrollBox and SpecialRows specimens are wrapped:
     the rule reaches elements this file owns, and a child component's root is
     not one. A `{@render}` introduces no wrapper of its own, so the rows the
     snippet above draws are direct children like everything else. -->
<div class="help">
  <!-- OVERVIEW, not HOW TO PLAY: the sheet's own title already says that, and
       a first heading repeating it was a rule spent on nothing — but a bare
       list opening the sheet left the intro as the one unlabeled stretch on a
       page where every other block announces itself. -->
  <div class="psep">OVERVIEW</div>
  <ul>
    <li>The stove spins you a real team-season, 1985–2025.</li>
    <li>Take <b>one</b> thing per spin: sign a player, or make a hire.</li>
    <li>
      Play until the club is finished: {SLOT_TYPES.length} seats plus a manager.
      Open Market adds an owner and a ballpark.
    </li>
    <li>Then the season is scored. <b>162 points is a perfect season.</b></li>
  </ul>
  <!-- SEAT_BADGE_RUNS: one chip per unique seat label, duplicate labels
       collapsed to a ×N count beside the chip. SP and RP get the line-gray
       fill the market rows use — a player who has already signed
       Pedro Martínez already knows that glyph means "pitcher"; it says the
       same thing on a seat badge. Counts appear beside the chip, not inside
       it, so the chip's fixed 38px width is not disturbed. -->
  <div class="slot-badges">
    {#each SEAT_BADGE_RUNS as [label, count, pit] (label)}
      <span class="sbadge">
        <span class="pos" class:pit>{label}</span>
        {#if count > 1}<span class="scnt">×{count}</span>{/if}
      </span>
    {/each}
    <!-- The dugout is not a market position, so its chip steps off the
         batter/pitcher two-way split: warm gray, the same pair the rail's MGR
         seat sits outside — a third category, not a third team. -->
    <span class="sbadge"><span class="pos mgr">MGR</span></span>
  </div>

  <div class="psep">A PLAYER ROW</div>
  {@render prow(MARKET)}
  <!-- The part names, anchored to the parts they name: the legend is the row's
       own anatomy (.pos, .mid, .right, .warchip, .cost) with the paint turned
       off, so each ↑ sits on its column because it is IN that column — not
       because a hand-measured grid track happens to agree with the row. A
       resized chip or a repadded tag moves its own label with it. -->
  <div class="lgnd" aria-hidden="true">
    <span class="pos lt">position</span>
    <span class="mid lt">name + hardware</span>
    <span class="right">
      <span class="cost lt">salary</span>
      <span class="warchip lt">WAR</span>
    </span>
  </div>
  {@render prow(MARKET_DEAD)}
  <p class="cap">
    Tap a row to sign him. Gray means that seat is taken. Salaries read green when
    they are cheap, orange when they are steep.
  </p>

  <div class="psep">YOUR SQUAD</div>
  <!-- The real seat component, the real rungs. -->
  <div class="rail">
    <RailSeat
      chair="mgr"
      label="MGR"
      name="Cox"
      meta="1995 ATL"
      tier={warTier(MGR_WINS)}
      war={statValue(MGR_WINS)}
    />
    {#each SEATS as s, i (i)}
      <RailSeat
        label={s.label}
        name={s.name}
        meta={s.meta}
        tier={s.war === null ? "" : warTier(s.war)}
        war={s.war === null ? null : s.war.toFixed(1)}
      />
    {/each}
  </div>
  <p class="cap">A seat's chip color is that player's WAR tier. Dashed is empty.</p>
  <div class="ladder">
    {#each LADDER as [label, war] (label)}
      <span class="warchip {warTier(war)}">{label}</span>
    {/each}
  </div>
  <p class="cap">Six rungs. Every WAR chip in the game wears one.</p>
  <ul>
    <li><b>UTIL:</b> any position player.</li>
    <li><b>MGR:</b> the skipper's chair, hired from the FRONT OFFICE row below.</li>
    <li>One man per seat.</li>
  </ul>
  <!-- A man who fits two seats, and the tap that settles which. The seats sit
       ABOVE the row here because they sit above it on the board, and because
       the row's own pill is an arrow pointing at them. -->
  {@render prow(UTIL)}
  <p class="cap">A tag like {UTIL.pos} means he fits more than one seat.</p>
  <div class="picks">
    <RailSeat label="IF" pickable specimen />
    <RailSeat label="OF" pickable specimen />
  </div>
  {@render prow(UTIL, "slot")}
  <p class="cap">Tap him and every seat he fits lights up. Tap the one you want.</p>

  <div class="psep">FRONT OFFICE</div>
  <!-- The game's own tiles (SpecialRows), inert, off the same ATL 1995 card
       the rail drafts from. The hue is the chair, not a grade: owner teal,
       ballpark pink, skipper white with a rung-colored chip. -->
  <div class="spec">
    <SpecialRows specimen={FRONT_OFFICE} />
  </div>
  <ul>
    <li><b>💰 Owner</b> (teal): sets your payroll budget.</li>
    <li><b>🏟️ Ballpark</b> (pink): multiplies it, 0.85× to 1.15×.</li>
    <li>
      <b>🧢 Skipper</b> (white): adds (W−L) × {MANAGER_PER_NET_WIN} to your win total,
      short seasons scaled up to a full 162. The chip reads it in WINS.
    </li>
  </ul>
  <p class="cap">
    Each hire costs a spin, the same as a player. Owner and ballpark exist under Open
    Market only; the skipper is on every card that has one.
  </p>

  <div class="psep">YOUR PAYROLL</div>
  <!-- The box as a player first meets it, and the reason it is first: under
       Open Market nothing is hired yet, so this is the state they look at
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
  <!-- The FRONT OFFICE above, hired: the same owner and ballpark, so the ×
       math here is the tiles' own two figures meeting. -->
  <div class="spec">
    <PayrollBox
      bank="classic"
      budget={FO_BUDGET}
      spend={88}
      ownerName="Ted Turner"
      ownerBudget={FO_OWNER_BUDGET}
      parkName="Atlanta-Fulton County Stadium"
      parkMult={FO_PARK_MULT}
    />
  </div>
  <p class="cap">Owner × ballpark sets your payroll. The bar is what you've spent.</p>
  <div class="spec">
    <PayrollBox
      bank="classic"
      budget={FO_BUDGET}
      spend={111}
      ownerName="Ted Turner"
      ownerBudget={FO_OWNER_BUDGET}
      parkName="Atlanta-Fulton County Stadium"
      parkMult={FO_PARK_MULT}
    />
  </div>
  <!-- What the over state LOOKS like, and no price on it: the payroll bonus
       and the luxury tax are both priced under SCORING now, and a rate quoted
       in two sections is a rate that can disagree with itself. -->
  <p class="cap">You can go over. The bar goes orange and the figure says by how much.</p>
  <ul>
    <li><b>🛒 Open Market:</b> owner × ballpark sets the payroll, as above.</li>
    <li><b>🐘 Moneyball:</b> a fixed {BANKS.moneyball.cash}. No hires. The 2002 A's.</li>
    <li><b>💸 Blank Check:</b> a fixed {BANKS.blankcheck.cash}. The 2005 Yankees.</li>
  </ul>

  <div class="psep">BALL KNOWLEDGE</div>
  <ul>
    <li><b>📊 Box Score:</b> WAR, salaries and hardware, all on the card.</li>
    <li><b>🔭 Eye Test:</b> name, position, price. No WAR, no awards, no skipper records. Your call.</li>
    <li>Hidden hardware still scores. The mode changes what you see, not what you get.</li>
  </ul>

  <div class="psep">POWERUPS · ONE USE EACH</div>
  <!-- One aligned row per powerup: its pill and one line saying what the tap
       opens and what the sheet then asks for. Where the line quotes an armed
       label, it quotes PowerupRow's own string. -->
  <div class="pgrid">
    {#each POWERUPS as pu (pu.label)}
      <span class="pstack">
        <PowerupPill label={pu.label} />
      </span>
      <span class="ptxt">{pu.text}</span>
    {/each}
  </div>
  <!-- The two states no row above can show, since both are a pill that has
       stopped being usable. One label in both, so the only difference on
       screen is the difference being taught — and each caption hangs off its
       own pill rather than off a shared grid's luck. -->
  <div class="pups">
    <span class="keyed">
      <PowerupPill label="🎟️ SEASON TICKET" state="off" />
      <span class="klbl">not on this spin</span>
    </span>
    <span class="keyed">
      <PowerupPill label="🎟️ SEASON TICKET" state="spent" />
      <span class="klbl">used up</span>
    </span>
  </div>
  <!-- Says ARMED, and stops there. Arming genuinely stacks; what an armed
       combination can then DO is narrower than "they stack" would promise —
       ⭐ and 🏠 arm together, but an armed ⭐ browses only the rows 🏠 has
       left live. Help copy that overshoots the engine is worse than none. -->
  <p class="cap">
    More than one can be armed on the same spin. A powerup never costs you a spin.
  </p>

  <!-- SCORING is the sheet's one nested section: five things each get a
       subsection — WINS is the spine, and the four after it are what moves it.
       The level is the same .psep device with a `sub` modifier, not a header
       style private to this sheet — one dashed rule instead of two, indented,
       so a reader can see at a glance that PAYROLL BONUS sits under SCORING
       rather than beside it.
       Every subsection is a DIRECT child of .help, wrapper-free: the vertical
       rhythm is written once over .help's children, and a container around a
       subsection would silently drop every gap inside it. -->
  <div class="psep">SCORING</div>

  <div class="psep sub">WINS</div>
  <!-- The three addends and the cap, in a two-column formula grid: the bold
       number on the left, what it names on the right. GAMES is the win cap —
       the same constant `expectedWins` clamps to — not the point goal (both
       are 162, but they are two different things that happen to share a
       number). No em dash, no "−" between rows: the formula reads vertically,
       not as a sentence. -->
  <div class="wgrid">
    <span class="wnum">{REPLACEMENT_WINS}</span>
    <span class="wlbl">replacement baseline</span>
    <span class="wnum">+WAR</span>
    <span class="wlbl">sum of every player's WAR</span>
    <span class="wnum">+MGR</span>
    <span class="wlbl">skipper (W−L) ×{MANAGER_PER_NET_WIN}</span>
    <span class="wnum">={GAMES} max</span>
    <span class="wlbl">a perfect season</span>
  </div>

  <div class="psep sub">PAYROLL BONUS</div>
  <!-- Three fills of the mini bar — meter, percent, and points inline on one
       line. The 39% row teaches the whole below-break-even register at once:
       PayrollBox draws its bar GOLD there (the meter's own `plow` state — the
       live game board and the finale ledger wear the identical hue at the
       identical threshold, so this is a specimen, not an illustration), the
       percent goes --gray-ink, and the points go --red-8, the register the WAR
       chip uses for a below-replacement season. Together: gold bar, losing
       points, add more.
       .mbar wraps PayrollBox's root (.pmeter, a child-component root scoped
       CSS cannot reach) so flex layout can size the bar and the label jointly. -->
  <div class="meters">
    {#each METERS as m (m.label)}
      <div class="mtr">
        <span class="mbar">
          <PayrollBox mini bank="classic" budget={FO_BUDGET} spend={m.spend} />
        </span>
        <span class="mlbl">
          <span class="mpct" class:mwarn={meterBonus(m.spend) < 0}>{meterPct(m.spend)}%</span>
          <b
            class:mbonus={m.spend <= FO_BUDGET && meterBonus(m.spend) >= 0}
            class:mneg={m.spend <= FO_BUDGET && meterBonus(m.spend) < 0}
            class:mtax={m.spend > FO_BUDGET}
          >{meterPts(m.spend)}</b>
          <span class="munit">PTS</span>
        </span>
      </div>
    {/each}
  </div>
  <p class="cap">
    The fuller the bar, the better it pays: −{BUDGET_BONUS_MAX} for spending nothing, 0 at
    half your payroll, +{BUDGET_BONUS_MAX} right at it. Below half the bar wears gold, the
    zone where the bonus still runs negative; from half on it wears green.
  </p>
  <p class="cap">
    Past the end the bonus is gone and the luxury tax runs instead, at {LUXURY_TAX_PER_M}
    point per $1M over, with no cap on it.
  </p>

  <div class="psep sub">SCOUTING</div>
  <!-- The finale's own scouting chip: one ⭐ per find, against what the run is
       worth. Priced off SCOUT_HIT_POINTS and counted off SLOT_TYPES, so a
       retuned point and an added seat both move this line themselves. -->
  <div class="stars">
    <span class="semo">{"⭐".repeat(SCOUT_HITS)}</span>
    <b class="spts">+{round1(SCOUT_HITS * SCOUT_HIT_POINTS)}</b>
  </div>
  <p class="cap">
    The dream team is the best club you could have signed from the cards you were dealt.
    The finale lays it out beside yours and stars every seat you both wanted.
  </p>
  <p class="cap">
    Each star is worth +{SCOUT_HIT_POINTS}, up to {DREAM_SEATS}: {SLOT_TYPES.length} seats plus
    the skipper. Your owner and your ballpark are not scouted.
  </p>

  <div class="psep sub">TROPHY CASE</div>
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
       off the medal alone. -->
  <p class="cap">
    Every pill a signed player wears scores, and your skipper's MOY with them. 🥈 and 🥉
    are second and third in that year's voting.
  </p>
  <div class="pups">
    <span class="keyed">
      <BadgePill badge={EARNED} />
      <span class="klbl">earned · tap to see why</span>
    </span>
    <span class="keyed">
      <BadgePill badge={SECRET} locked />
      <span class="klbl">go find it</span>
    </span>
  </div>
  <p class="cap">
    Badges are separate: a lifetime collection across every mode, worth no points. Tap 🏆
    any time.
  </p>

  <div class="psep sub">RING CHASING</div>
  <!-- One honour per row, each priced off its own scoring constant. The
       emojis are the finale's pedigree glyphs, so the ledger row the player
       meets at the end reads back in the same pictures. -->
  <div class="rings">
    {#each RINGS as [emo, name, pts] (emo)}
      <span class="remo">{emo}</span><span class="rlbl">{name}</span><b class="rpts">+{pts}</b>
    {/each}
  </div>
  <p class="cap">
    Per signed player, and they stack: a ring and a Classic medal on one season both
    count.
  </p>

  <div class="psep">DATA SOURCES</div>
  <!-- Named source by source, each named once, and no license claimed: the
       repo records what each file supplied (pipeline/fetch.py,
       data/owners.json's `source`, data/wbc.json's `_source`) and states no
       terms for any of them. -->
  <ul class="src">
    <li><b>Lahman Baseball Database:</b> statistics and salaries.</li>
    <li><b>Baseball-Reference:</b> WAR and salaries.</li>
    <li><b>SABR:</b> club owners.</li>
    <li><b>Wikipedia:</b> WBC rosters and club owners.</li>
  </ul>
</div>
</Sheet>

<style>
  /* The report beetle is the close pill's mirrored shoulder: identical box,
     tap extension, press, and focus treatment; only the line-art tenant
     differs. */
  .report {
    flex: none;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: var(--card);
    color: var(--muted);
    width: 28px;
    height: 22px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    position: relative;
  }
  .report::after {
    content: "";
    position: absolute;
    inset: -11px -8px;
  }
  .report:active { transform: translateY(1.5px); }
  .report:focus-visible {
    outline: 3px solid var(--blue);
    outline-offset: 2px;
  }
  /* ---------- the vertical rhythm ----------
     Three values, and every gap on the sheet is one of them:

         16px  opens a section — the space above a .psep rule
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
     PayrollBox and SpecialRows specimens are for, and why a new specimen needs
     one. The seat and pill groups need no wrapper of their own: `.rail`,
     `.picks`, `.pups` and `.pgrid` are this file's elements already, and they
     exist to arrange the child components inside them. */
  .help > * + * {
    margin-top: 8px;
  }
  /* The section device is the game's own .psep (app.css): dashed rule either
     side of a centered title, the same header the board hangs over FRONT
     OFFICE and PLAYERS. Only its rhythm is decided here. */
  .help > .psep {
    margin-top: 16px;
  }
  /* The first heading closes up against Sheet's header. */
  .help > .psep:first-child {
    margin-top: 0;
  }
  /* ---------- the subsection level ----------
     SCORING is the only section with one, and its four parts get the SAME
     device a rung quieter rather than a header style of their own: one dashed
     rule instead of two, indented, a size down. The asymmetry is what carries
     the level — a title that starts at a margin and trails off into the rule
     reads as hanging under the centered title above it, which is what it does.
     A subsection opens on 12px, between the 16px a section opens on and the
     8px between blocks inside one, so the nesting is legible in the spacing as
     well as in the rule. */
  .help > .psep.sub {
    margin-top: 12px;
    font-size: 9px;
    padding-left: 12px;
  }
  .help > .psep.sub::before {
    display: none;
  }
  .help > .cap,
  .help > .lgnd {
    margin-top: 4px;
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
  /* The credits read in the body's own register — they used to drop to 11px
     muted, and a section that whispers under its own heading read as broken
     styling rather than as modesty. The .src class stays on the markup as the
     section's name; it just no longer costs the type anything. */
  /* One line under a specimen, saying the one thing the picture cannot.
     Same size and leading as body text (li, .ptxt) — differs only in color. */
  .cap {
    margin: 0;
    font-size: 12px;
    line-height: 1.45;
    color: var(--muted);
  }
  /* ---------- anchored labels ----------
     The legend is the market row's own skeleton: the same .pos / .mid /
     .right / .warchip / .cost elements at the same widths, paint stripped,
     with the label riding INSIDE the box it names. Alignment is therefore the
     row's own layout, not a parallel grid to keep in step with it. The
     horizontal padding is the row's 10px padding plus its 2.5px border, the
     two thicknesses the borderless legend does not spend. */
  .lgnd {
    display: flex;
    gap: 9px;
    padding: 0 12.5px;
  }
  .lgnd .lt {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    background: transparent;
    border-color: transparent;
    color: var(--muted);
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1.3;
    padding: 0;
  }
  /* The tick points up at the part, from inside the part's own column. */
  .lgnd .lt::before {
    content: "↑";
    opacity: 0.55;
  }
  .lgnd .mid.lt {
    flex: 1;
    min-width: 0;
  }
  /* A pill-and-caption pair: the caption hangs off its own pill, so it cannot
     drift onto a neighbour the way a shared label grid could. */
  .keyed {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .klbl {
    text-align: center;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--muted);
    text-transform: uppercase;
    line-height: 1.3;
  }
  .klbl::before {
    content: "↑";
    display: block;
    opacity: 0.55;
  }

  /* The ladder as six of the app's own chips. `.warchip` is global, so these
     rungs ARE the market's and cannot drift from it — the same reasoning that
     put the seats and the pills into components of their own. */
  .ladder {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  /* ---------- specimen: a market row ----------
     The row's CONTENT is MarketRow — the live market's own component, so
     nothing about the tag, the columns, the hint pill or the dead-state
     filters is drawn here any more. What stays is the row BOX (cardstock,
     border, dead wash), the same split PlayerList keeps: the box is the
     surface's own, the innards are shared. */
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
  /* MarketRow's hint deliberately shares the live confirm-pill recipe, whose
     cursor promises a tap. Here it is explanatory ink inside an inert diagram,
     so withdraw that promise just as the specimen seats below do. */
  .prow :global(.confirm.hint) {
    cursor: default;
  }
  .prow.dead {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
    opacity: 0.55;
  }
  /* ---------- the seat badges' and legend's own chip ----------
     NOT the market row's tag (that is MarketRow's): this .pos draws the seat
     badges above the rail and the legend's skeleton, which share the tag's
     geometry but carry their own variants (.mgr, the paint-stripped .lt). */
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
  /* The MGR chip's third look: batters are white, pitchers line-gray, and
     the dugout — not a market position at all — wears the warm gray pair so
     the two-way arms/bats split stays a two-way split. Ink text, not
     gray-on-gray: the chip is a label, not a dead row. */
  .pos.mgr {
    background: var(--gray-bg);
    border-color: var(--gray-ink);
  }
  /* Filled ink, ring to match — one tone, no halo, MarketRow's own pair
     (its .pos.pit and the confirm pill both wear it). */
  .pos.pit {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--card);
  }
  /* The legend's .right/.cost skeleton, MarketRow's numbers (10px salary↔chip
     gap, 56px price floor) so the paint-stripped labels keep sitting under
     the columns they name. Geometry only — the specimen's own column is
     MarketRow's. */
  .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 10px;
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

  /* ---------- the seat and pill specimens' CONTAINERS ---------- */
  /* Four seat columns matching RosterRail's phone grid exactly: `auto` holds
     the manager's chair, `repeat(4, 1fr)` holds the 8 player seats across 2
     rows. RailSeat spans the manager row with its own grid-row declaration,
     the same way it does on the live board. Fewer columns made each seat too
     wide and the manager too short — the reader wasn't seeing the real thing. */
  .rail {
    display: grid;
    grid-template-columns: auto repeat(4, 1fr);
    gap: 6px;
  }
  /* At width RailSeat turns itself into a full-width card row; a full-width row
     inside a grid column has no room, and the names clip. Same breakpoint, same
     flex column, same manager-first order as RosterRail. */
  @media (min-width: 760px) {
    .rail {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
  }
  /* The seats a pick offers, side by side. The rail's own grid is nine
     chairs wide and this is a crop of it — the two that lit up: with both
     of a multi-group man's groups still open, his picker offers only the
     specialist seats (engine `pickableSlotCells`; UTIL joins the ask only
     once one group is full), so the crop shows the fresh-club case. It
     gets the two columns it holds rather than the rail's
     `auto repeat(4, 1fr)`, whose leading `auto` track belongs to the
     manager's chair. Same gap as the rail, and the same collapse to a
     column at the width RailSeat changes shape at, for the same reason: a
     full-width seat row inside a narrow grid column is a row with no
     room. */
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
    align-items: flex-start;
    gap: 8px 16px;
    container-type: inline-size;
  }
  /* The powerup table: one aligned row per powerup — its pills in the left
     column, one line of copy in the right — so the six entries read down two
     ruled columns instead of pills dispersing through sentences. It declares
     the same container as `.pups` because the container query is the pill's
     contract wherever a pill is drawn: a pill with no container silently stays
     at base size. */
  .pgrid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: center;
    container-type: inline-size;
  }
  /* The pill's column, left-flush so the two columns keep a straight rule
     down the sheet. */
  .pstack {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .ptxt {
    font-size: 12px;
    line-height: 1.45;
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

  /* ---------- the payroll bonus, as three fills of the bar ----------
     Each row: mini bar + percent + points, all inline. .mbar wraps the
     PayrollBox root (a child-component root this file's scoped CSS cannot
     reach) so the flex row can size bar and label jointly. .mlbl is
     flex: none / white-space: nowrap so it never wraps mid-row. */
  .meters {
    display: grid;
    gap: 8px;
  }
  .mtr {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  /* Absorbs the remaining flex width; PayrollBox's .pmeter uses width: 100%
     inside it, so the bar fills the track. */
  .mbar {
    flex: 1;
    min-width: 0;
  }
  .mlbl {
    display: flex;
    align-items: baseline;
    gap: 4px;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
    flex: none;
    white-space: nowrap;
  }
  .mlbl b {
    font-size: 12px;
    font-weight: 800;
    color: var(--ink);
  }
  /* The sub-50% percent borrows --gray-ink, the pre-hire payroll box's own
     label color: "you are in the zone where the bar has not started paying
     off." The gray percent plus the red points below read together — low fill,
     actively losing points — so neither signal has to carry the full message
     alone. */
  .mlbl .mpct.mwarn {
    color: var(--gray-ink);
  }
  /* Negative budget bonus: the bar is costing points. --red-8 matches
     --war-neg, the same register the WAR chip uses for a below-replacement
     season. */
  .mlbl .mneg {
    color: var(--red-8);
  }

  /* ---------- the emoji scoring lines ----------
     SCOUTING and RING CHASING both price a glyph, and they are two views of
     one device: a 13px glyph, the body's 12px for what it names, and 12px/800
     for what it is worth. They were 15px and 13px here and nothing on the
     sheet ranged against them, which made RING CHASING read as a page from a
     different document.
     The scouting line is the finale's chip: a RUN of stars, one per find,
     against what the run is worth — so it carries no label column. */
  .stars {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  /* RING CHASING: glyph · honour · points, one honour per row, the points
     right-aligned down one rule the way the finale's ledger keeps its column. */
  .rings {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 5px 9px;
    align-items: center;
  }
  .remo,
  .semo {
    font-size: 13px;
    line-height: 1;
  }
  /* Joins the ledger register its sibling rows live in: 700 weight (same as
     .mlbl) and the body's 1.45 leading. Without weight the honour name was the
     only 400-weight run in the whole SCORING section, reading lighter than its
     neighbours even at the same pixel size. Line-height 1.3 made it feel
     compressed against the 1.45 above and below. Both fixed here. */
  .rlbl {
    font-size: 12px;
    font-weight: 700;
    line-height: 1.45;
  }
  .rpts,
  .spts {
    font-weight: 800;
    font-size: 12px;
  }
  .rpts {
    justify-self: end;
  }

  /* ---------- the WINS formula ----------
     Two-column grid: a bold numeral or symbol on the left, a body-weight
     label on the right. Same size as the body so it reads as structured text
     rather than a chart — it IS structured text. */
  .wgrid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 9px;
    align-items: center;
  }
  .wnum {
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }
  .wlbl {
    font-size: 12px;
    line-height: 1.45;
  }

  /* ---------- HOW TO PLAY: position badges ----------
     Flex-wrap row of .sbadge pairs — each pair is a .pos chip with an
     optional ×N count beside it. The gap is between sbadge units; the 2px
     gap inside each pair keeps the count close to its chip without touching.
     SP and RP chips carry the .pit fill from .pos.pit above. */
  .slot-badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
  }
  .sbadge {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  /* The repeat count beside a chip: same font size as the chip's label,
     bold to match the chip's weight, ink-colored so it reads as part of
     the same unit. */
  .scnt {
    font-size: 9.5px;
    font-weight: 800;
    color: var(--ink);
  }

  /* ---------- payroll meter: bonus, negative-bonus, and tax colors ----------
     Specificity (.mlbl .mbonus = 0,2,0) beats .mlbl b (0,1,1) so the color
     overrides the baseline ink value without !important. .mneg and .mpct.mwarn
     are declared above alongside .mbar and .mlbl to keep the layout block
     together. */
  .mlbl .mbonus {
    color: var(--green);
  }
  .mlbl .mtax {
    color: var(--orange);
  }
</style>

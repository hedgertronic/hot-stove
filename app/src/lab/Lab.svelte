<script lang="ts">
  /** Dev-only UI lab (?lab): edge-case galleries rendered through the REAL
   * components, fed by forged Game states from fixtures.ts. Nothing here
   * ships — App.svelte only imports this module in DEV. */
  import BadgePill from "../components/BadgePill.svelte";
  import BadgeSlot from "../components/BadgeSlot.svelte";
  import BankBox from "../components/BankBox.svelte";
  import Finale from "../components/Finale.svelte";
  import PlayerList from "../components/PlayerList.svelte";
  import PayrollBox, { FIXED_CAP_CLUB } from "../components/PayrollBox.svelte";
  import PowerupRow from "../components/PowerupRow.svelte";
  import RosterRail from "../components/RosterRail.svelte";
  import PrimePicker from "../components/PrimePicker.svelte";
  import SpecialPrimePicker from "../components/SpecialPrimePicker.svelte";
  import SpinBanner from "../components/SpinBanner.svelte";
  import {
    PILL_LADDER,
    bankGames,
    finaleBad,
    finaleCeilingAbove,
    finaleCeilingMatched,
    finaleCeilingMet,
    finaleCeilingPerfect,
    finaleCeilingSameRecord,
    finaleCentury,
    finaleDayjob,
    finaleMariners,
    finaleMortgaged,
    finaleOver,
    finalePerfect,
    finalePocketed,
    finaleUnder,
    hdGame,
    marketGame,
    powerupGames,
    primeGame,
    primePickGame,
    railGames,
    scoutGame,
    specialPrimeGame,
    tdGame,
  } from "./fixtures";
  import { BADGE_BY_KEY } from "../lib/badges";

  const market = marketGame();
  const scout = scoutGame();
  const td = tdGame();
  const prime = primeGame();
  const hd = hdGame();
  // ☔ RAIN DELAY is a flag on a real Game, not a market shape of its own —
  // raise it on a fresh forge and the banner's own gate renders the notice
  // exactly as a dropped card fetch leaves it.
  const lost = marketGame();
  lost.loadFailed = true;
  const banks = bankGames();
  const pups = powerupGames();
  const rails = railGames();
  const finUnder = finaleUnder();
  const finOver = finaleOver();
  const finMariners = finaleMariners();
  const finPerfect = finalePerfect();
  const finBad = finaleBad();
  const finMortgaged = finaleMortgaged();
  const finPocketed = finalePocketed();
  const finCentury = finaleCentury();
  const finDayjob = finaleDayjob();
  const finCeilAbove = finaleCeilingAbove();
  const finCeilSame = finaleCeilingSameRecord();
  const finCeilPerfect = finaleCeilingPerfect();
  const finCeilMet = finaleCeilingMet();
  const finCeilMatched = finaleCeilingMatched();

  // One confirm per market section; preset so the SIGN pill is visible on load.
  let confirmMarket = $state<string | null>("p:salty");
  let confirmScout = $state<string | null>(null);
  let confirmTd = $state<string | null>(null);

  // The manager career sheet is a modal; a button summons it over the lab.
  let mgrSheet = $state(false);
  // The player career sheet, same summons: the wrapped award-pill rows are
  // the gallery's subject, so open it at a phone width.
  let primeSheet = $state(false);

  /* The explanation panel. Two rows, because the interesting failure is
     geometric: the panel floats, so what has to be checked is where it lands
     and whether it stays inside its row. The first row is preset open on a
     middle pill (the ordinary case, arrow centered). The second is a dense row
     whose pills reach both margins, which is where the clamp does its work —
     tap the leftmost and rightmost pills and the panel should stop at the
     margin while the arrow slides along its edge to keep pointing. */
  /* Filtered, because these name badges by key and the table they come from is
     edited independently: a retired key must leave a shorter row here, not a
     crashed lab. */
  const byKey = (keys: string[]) => keys.map((k) => BADGE_BY_KEY[k]).filter((b) => b != null);
  const HOW_ROW = byKey(["crown", "crystal", "allstars", "skull"]);
  const EDGE_ROW = byKey(["hundred", "dime", "cubs", "twoway", "rings", "pocket"]);
  let labHow = $state<string | null>("crystal");
  let labEdge = $state<string | null>(null);

  const noop = () => {};

  /* Every state PayrollBox renders, as bare props. The in-game bank box is
     scheduled to move onto this component, and these are the states it needs:
     if one of them cannot be expressed here the extraction has failed, so the
     gallery is the proof rather than the doc comment. Owner names are the real
     ones the game resolves; the fixed-cap clubs come from the component's own
     constant so both surfaces name the same club. */
  const YAMAUCHI = "Hiroshi Yamauchi";
  const PAYROLL_STATES = [
    {
      note: "Classic, nothing hired — both chips ghosted, both names TBD, payroll $0: drifting gray hatch and $0M LEFT",
      props: { bank: "classic" as const, budget: 40, spend: 0, capKnown: false, pending: true },
    },
    {
      note: "Classic, $34M signed before an owner — over a $0 payroll, so the box wears the overrun alarm",
      props: { bank: "classic" as const, budget: 40, spend: 34, capKnown: false, pending: true },
    },
    {
      note: "Classic, owner hired but no ballpark yet — one ghost, one real, payroll still unknown",
      props: {
        bank: "classic" as const, budget: 92.1, spend: 12, capKnown: true, pending: true,
        ownerName: YAMAUCHI, ownerBudget: 92.1,
      },
    },
    {
      note: "Classic, both hired, ~39% spent — the full × = math",
      props: {
        bank: "classic" as const, budget: 96.7, spend: 38,
        ownerName: YAMAUCHI, ownerBudget: 92.1, parkName: "Safeco Field", parkMult: 1.05,
      },
    },
    {
      note: "Classic, $0 spent — the fill's own right border would paint a sliver, so it goes too",
      props: {
        bank: "classic" as const, budget: 96.7, spend: 0,
        ownerName: YAMAUCHI, ownerBudget: 92.1, parkName: "Safeco Field", parkMult: 1.05,
      },
    },
    {
      note: "Classic, $14.3M OVER PAYROLL — hatch, orange line, and the overrun REPLACING the green figure",
      props: {
        bank: "classic" as const, budget: 96.7, spend: 111,
        ownerName: YAMAUCHI, ownerBudget: 92.1, parkName: "Safeco Field", parkMult: 1.05,
      },
    },
    {
      note: "Moneyball — payroll set outright, no seats; the solo hires line names the club the mode borrows",
      props: {
        bank: "moneyball" as const, budget: 60, spend: 41,
        ownerName: "Stephen Schott & Ken Hofmann", // FIXED_CAP_CLUB.moneyball → OAK 2002
      },
    },
    {
      note: "Blank Check — same box, the other constant",
      props: {
        bank: "blankcheck" as const, budget: 200, spend: 120,
        ownerName: "George Steinbrenner", // FIXED_CAP_CLUB.blankcheck → NYY 2005
      },
    },
    {
      note: "Classic, finished, no front office on record (a finale older than these fields): the payroll alone, and no TBD names — nothing is still coming",
      props: { bank: "classic" as const, budget: 96.7, spend: 95 },
    },
  ];
  // Named so the constant is exercised rather than decorative: a rename there
  // must reach this gallery.
  const FIXED_CLUBS = `${FIXED_CAP_CLUB.moneyball?.team} ${FIXED_CAP_CLUB.moneyball?.year} · ${FIXED_CAP_CLUB.blankcheck?.team} ${FIXED_CAP_CLUB.blankcheck?.year}`;
</script>

<div class="lab">
  <div class="labhead disp">
    🧪 UI LAB — forged states, live components. Interactions mutate fixtures
    (reload to reset); nothing is saved.
  </div>

  <div class="psep">MARKET · BOX SCORE</div>
  <div class="cap">
    All WAR tiers (−1.4 → 11.8) · spendy/cheap costs ·
    long name + 4 pills (Saltalamacchia, preset SIGN confirm) · dead row
    (Edgar, rostered)
  </div>
  <PlayerList game={market} confirmKey={confirmMarket} setConfirm={(k) => (confirmMarket = k)} />

  <div class="psep">MARKET · EYE TEST</div>
  <div class="cap">Same card, scout mode: cost-sorted, WAR and awards hidden</div>
  <PlayerList game={scout} confirmKey={confirmScout} setConfirm={(k) => (confirmScout = k)} />

  <div class="psep">MARKET · TRADE DEADLINE ARMED</div>
  <div class="cap">Roster full → unsigned rows are amber swap targets (TRADE FOR)</div>
  <PlayerList game={td} confirmKey={confirmTd} setConfirm={(k) => (confirmTd = k)} />

  <div class="psep">MARKET · PRIME TIME ARMED</div>
  <div class="cap">Signable rows carry the ⭐ career-browse affordance</div>
  <PlayerList game={prime} confirmKey={null} setConfirm={noop} />

  <div class="psep">PRIME TIME · MANAGER CAREER SHEET</div>
  <div class="cap">
    ⭐ on the open 🧢 tile — Piniella's real 23-season timeline from
    specials.json: MOY pills (Box Score), negative-value TBD years, grayed
    "here" row (2001 SEA)
  </div>
  <button class="btn sheetbtn" onclick={() => (mgrSheet = true)}>OPEN THE SHEET</button>
  {#if mgrSheet}
    <SpecialPrimePicker game={specialPrimeGame()} onclose={() => (mgrSheet = false)} />
  {/if}

  <div class="psep">PRIME TIME · PLAYER CAREER SHEET</div>
  <div class="cap">
    ⭐ on a decorated player — Ichiro's real career from the index: award
    pills wrap under the year label at phone widths, WBC medal, grayed
    "here" row (2001 SEA)
  </div>
  <button class="btn sheetbtn" onclick={() => (primeSheet = true)}>OPEN THE CAREER SHEET</button>
  {#if primeSheet}
    <PrimePicker game={primePickGame()} onclose={() => (primeSheet = false)} />
  {/if}

  <div class="psep">MARKET · HOMEGROWN ARMED</div>
  <div class="cap">
    Debut-matching rows (Ichiro, Garcia) stay live at the flat $1M;
    everyone else grays — every WAR tier represented, chips keep a faded hue
  </div>
  <PlayerList game={hd} confirmKey={null} setConfirm={noop} />

  <div class="psep">SPIN BANNER · ☔ RAIN DELAY</div>
  <div class="cap">
    A spin whose card fetch failed: one capsule under the idle reel, message
    and action fused (SHOW N MORE's dress on the chipbox recipe). The button
    is live but has no stranded fetch to re-run here.
  </div>
  <SpinBanner game={lost} colors={{ franchises: {} }} />

  <div class="psep">PAYROLL BOX</div>
  <div class="cap">Pre-owner, nothing signed yet — payroll $0, gray drifting hatch</div>
  <BankBox game={banks.preOwner} />
  <div class="cap">Pre-owner, $34M signed — $34M over a $0 payroll</div>
  <BankBox game={banks.preOwnerSpent} />
  <div class="cap">Classic, ~39% spent</div>
  <BankBox game={banks.normal} />
  <div class="cap">Classic, ~96% spent (near cap)</div>
  <BankBox game={banks.nearCap} />
  <div class="cap">Classic, $14.3M over a real payroll</div>
  <BankBox game={banks.over} />
  <div class="cap">Moneyball (fixed cap, real owners line)</div>
  <BankBox game={banks.moneyball} />
  <div class="cap">Blank Check (fixed cap)</div>
  <BankBox game={banks.blankcheck} />

  <div class="psep">PAYROLL BOX · EVERY STATE</div>
  <div class="cap">
    The shared component the finale renders for BOTH clubs, driven directly by
    props rather than through a Game — every state the in-game bank box needs,
    so switching that box onto this one is a demonstrated move rather than a
    promised one. Compare each row against the PAYROLL BOX gallery above it:
    they must be the same object. Fixed-cap clubs: {FIXED_CLUBS}.
  </div>
  {#each PAYROLL_STATES as s (s.note)}
    <div class="cap">{s.note}</div>
    <div class="paycase"><PayrollBox {...s.props} /></div>
  {/each}

  <div class="psep">POWERUPS</div>
  <div class="cap">All ready (pre-choice)</div>
  <PowerupRow game={pups.ready} onSeasonTicket={noop} onRelocate={noop} />
  <div class="cap">Double Play + Trade Deadline armed (labels change, row stays 3+3)</div>
  <PowerupRow game={pups.armed} onSeasonTicket={noop} onRelocate={noop} />
  <div class="cap">Season Ticket / Relocate / Prime spent, post-choice</div>
  <PowerupRow game={pups.spent} onSeasonTicket={noop} onRelocate={noop} />

  <div class="psep">ROSTER RAIL</div>
  <div class="cap">Empty / partial (🏠 discount seat) / full + manager — wide (≥760px) renders these as finale-style rows</div>
  <div class="railcase"><RosterRail game={rails.empty} /></div>
  <div class="railcase"><RosterRail game={rails.partial} /></div>
  <div class="railcase"><RosterRail game={rails.full} /></div>

  <div class="psep">BADGE PILLS · THE WHOLE LADDER</div>
  <div class="cap">
    Every rarity tier in one column, rarest first, through the shared
    BadgePill — the same component the finale row and the home trophy case
    both render. No season can show all six at once (the pill row caps at
    four, and legendary and common are mutually exclusive on the on-field
    axis), so this is the only place the ramp is reviewable end to end. Below
    the ramp are states no single surface shows together: three locked
    silhouettes (named, then anonymous, then anonymous on the inverted
    legendary pill) that only the trophy case renders, and the six NEW flags
    that only a finale renders.
  </div>
  <div class="ladder">
    {#each PILL_LADDER as row, i (i)}
      <div class="lrung">
        <BadgePill badge={row.badge} locked={row.locked} fresh={row.fresh ?? false} />
        <span class="lnote">{row.note}</span>
      </div>
    {/each}
  </div>

  <div class="psep">BADGE PILLS · TAP TO EXPLAIN</div>
  <div class="cap">
    BadgeSlot — the tappable pill and its trigger panel, the one implementation
    the finale row and the trophy case both render. The panel FLOATS: it
    overlays whatever is beneath it and moves nothing, so the row it belongs to
    looks identical open or shut. An arrow connects it to the pill. Preset open
    on the second pill; tap any pill to move it, tap outside or press Escape to
    dismiss.
  </div>
  <div class="howrow">
    {#each HOW_ROW as b (b.key)}
      <BadgeSlot
        badge={b}
        open={labHow === b.key}
        ontoggle={() => (labHow = labHow === b.key ? null : b.key)}
      />
    {/each}
  </div>

  <div class="cap edgecap">
    The clamp: a dense row whose pills reach both margins. A panel anchored to
    the leftmost or rightmost pill has to stop at the row's edge rather than
    hang past it — the arrow slides along the panel's own edge to keep pointing
    at the pill. Nothing here may widen the column.
  </div>
  <div class="howrow">
    {#each EDGE_ROW as b (b.key)}
      <BadgeSlot
        badge={b}
        open={labEdge === b.key}
        ontoggle={() => (labEdge = labEdge === b.key ? null : b.key)}
      />
    {/each}
  </div>

  <div class="psep">FINALE · UNDER CAP — FULL SWEEP</div>
  <div class="cap">
    Front-office-bonus face · 💍💍🚩 pedigree · 9-⭐ scouting sweep (every
    squad row starred, whole dream team green) · long-name squad row with 4
    pills + 💍 (badge wrap) · 🏠 discount row · pills 🍎 uncommon (108 wins
    matches the '86 Mets) + 🔮 rare (9 scout hits) — sky beside violet
  </div>
  <div class="fincase" id="fin-under">
    <Finale game={finUnder} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · OVER CAP — STACKED PEDIGREE</div>
  <div class="cap">
    Luxury-tax face ($19.3M over) · 7💍 + 2🚩 &gt; 8 emojis → ×N fallback ·
    1 scout hit · empty dream-team seat (—) · dream manager differs · pills
    💸 ironic + 💍 ultra + 🕸️ ironic — one gold pill between two dashed ones,
    the rarity ramp's widest spread on a single line
  </div>
  <div class="fincase" id="fin-over">
    <Finale game={finOver} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 👑 BEST RECORD OF ALL TIME</div>
  <div class="cap">
    Bought superteam past 117 wins → 👑 supersedes every named rung, but the
    luxury tax holds the total short of 162 — no 🏆 · THE PILL ROW AT ITS
    4-PILL CAP, one of each register: 👑 legendary (ink fill, gold text) · 💸
    ironic dashed · 🏅 uncommon sky · 🏛️ rare violet
  </div>
  <div class="fincase" id="fin-mariners">
    <Finale game={finMariners} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 🏆 PERFECT SEASON</div>
  <div class="cap">
    Total ≥ 162 → record caps at 162–0, exact points line beneath · FIVE
    badges qualify (👑 🏆 🔮 🧱 ✊) and the four-pill cap drops ✊ from the
    tail — the two legendaries leading two rares, the row's loudest legal
    state and the only place both legendary pills appear together
  </div>
  <div class="fincase" id="fin-perfect">
    <Finale game={finPerfect} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 💀 100-LOSS CLUB</div>
  <div class="cap">
    Washed vets (−2.0 WAR, $3.3M over cap): 62–100 on-field, exactly on the
    trigger → the dashed 💀 anti-trophy · the small bust stays under 💸's
    $15M bar · a lone ironic pill, the row at its quietest
  </div>
  <div class="fincase" id="fin-bad">
    <Finale game={finBad} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 👔 DON'T QUIT YOUR DAY JOB</div>
  <div class="cap">
    The floor of the on-field ladder: −34.0 WAR under a 41–121 skipper lands
    on exactly 0–162, where 👔 supersedes 📉 the way 👑 supersedes a named
    rung · payroll parked between 🧾 and 💵 so the axis stays silent · 👔 + 🕸️,
    an all-ironic row under the largest possible loss column
  </div>
  <div class="fincase" id="fin-dayjob">
    <Finale game={finDayjob} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 💯 100-WIN CLUB — THE RARITY FLOOR</div>
  <div class="cap">
    A 2017 Astros club on exactly 100 wins · 💯 is the set's ONLY common
    badge (gray fill, gray hairline — the one pill that doesn't get the ink
    border) shown against 🗑️ in rare violet, so the bottom of the ramp is
    visible beside a rung three steps up
  </div>
  <div class="fincase" id="fin-century">
    <Finale game={finCentury} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 💸 MORTGAGED THE FARM</div>
  <div class="cap">
    $145M of albatross contracts vs the $96.7M cap: $48.3M tax on a 78-win
    roster · 💸 + 🕸️ — the all-ironic row, where the dashed treatment has to
    carry the whole line with no filled pill to sit against
  </div>
  <div class="fincase" id="fin-mortgaged">
    <Finale game={finMortgaged} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 🧾 POCKETED THE DIFFERENCE</div>
  <div class="cap">
    $35M spent of $96.7M (36%) on a scrap-heap 76–86 roster · −2.8
    front-office penalty · cheap enough for 🧮 too, but the losing record
    picks which payroll face fires · 🧾 + 🕸️, both dashed
  </div>
  <div class="fincase" id="fin-pocketed">
    <Finale game={finPocketed} onreplay={noop} onmodes={noop} />
  </div>

  <!-- One club, five ceilings. Same 2015 Cubs roster, same skipper, same
       payroll, same hired front office, same single scout hit in every one — so
       the only thing that moves between these five is the ceiling block under
       ⭐ THE DREAM TEAM. Every finale ABOVE this point carries no ceiling fields
       and no front office, which is the old-record path: the payroll block
       renders its payroll and meter alone, and no ceiling at all. -->
  <div class="psep">FINALE · CEILING ABOVE</div>
  <div class="cap">
    The ordinary case — a club the cards could have made scoring ~21.6 clear of
    the one built. Record + exact points under the header, muted and a fraction
    of the stamp's size, and nothing said about them · each list closes with its
    own PAYROLL BLOCK in the bank box's vocabulary (owner × ballpark = payroll,
    meter, SPENT/LEFT) — the dream club at 96.6% of a smaller cap against yours
    at 91%, which is what explains a dream club carrying less WAR · the OWNER is
    the same card on both sides and earns no cue, because neither seat is
    scoutable (the ⭐ denominator stays 9)
  </div>
  <div class="fincase" id="fin-ceil-above">
    <Finale game={finCeilAbove} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · CEILING ABOVE, SAME RECORD</div>
  <div class="cap">
    The rounding edge: a ceiling genuinely higher that rounds to the SAME W–L as
    the stamp. Nothing contradicts — the points line carries the whole
    difference, the same job it does under the stamp
  </div>
  <div class="fincase" id="fin-ceil-same">
    <Finale game={finCeilSame} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 162–0 CEILING</div>
  <div class="cap">
    A ≥162 ceiling against a club that missed it — 21.85% of full-powerup games
    reach this and 0.85% cash it, so this is a common screen · the record caps
    at 162–0 and the points line keeps the number that earned it · still no
    commentary: the gap between 162–0 and the stamp is the player's to read
  </div>
  <div class="fincase" id="fin-ceil-perfect">
    <Finale game={finCeilPerfect} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · PLAYED THE CEILING</div>
  <div class="cap">
    The search found nothing better AND its own club scores exactly what the
    player's did, so the ceiling prints normally — and prints the stamp's own
    record and points. Two identical numbers IS the message
  </div>
  <div class="fincase" id="fin-ceil-met">
    <Finale game={finCeilMet} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · BEST CLUB WE FOUND</div>
  <div class="cap">
    The only finale that needs a word (3.2% of full-powerup games): the solver's
    own club scores 3.1 BELOW the one built — it lost to a line it does not
    model. The roster listed below really is worse, so printing the ceiling
    would claim a score it does not have; the label stands in and no number is
    printed
  </div>
  <div class="fincase" id="fin-ceil-matched">
    <Finale game={finCeilMatched} onreplay={noop} onmodes={noop} />
  </div>
</div>

<style>
  .lab {
    max-width: 540px;
    margin: 0 auto;
    padding: 14px 0 60px;
  }
  .labhead {
    text-align: center;
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    border: 2px dashed var(--gray-ink);
    border-radius: 11px;
    padding: 8px 12px;
    margin-bottom: 6px;
  }
  .lab :global(.psep) {
    margin-top: 22px;
  }
  .cap {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
    margin: 6px 0 8px;
    text-align: center;
  }
  .railcase {
    margin-bottom: 10px;
  }
  /* PayrollBox carries no outer margin — spacing is the caller's — so the
     gallery supplies its own. */
  .paycase {
    margin-bottom: 10px;
  }
  /* One rung per line, pills left-aligned on a shared edge so the tiers stack
     into a readable ramp; the note sits beside each. */
  .ladder {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 7px;
  }
  .lrung {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .lnote {
    font-size: 10px;
    font-weight: 700;
    color: var(--muted);
  }
  /* The finale's own brag-row geometry, including the `position: relative`
     BadgeSlot requires, so a panel anchors and clamps here the way it does
     there. */
  .howrow {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 8px;
    position: relative;
  }
  /* The rows overlay rather than reflow, so a panel opened in the first row
     lands on top of this caption — the gap is what keeps the two rows readable
     while one of them is open. */
  .edgecap {
    margin-top: 74px;
  }
  .sheetbtn {
    display: block;
    margin: 0 auto;
    font-size: 12px;
    padding: 7px 16px;
  }
  /* The .btn trim branch's other half, owed here because the scoped padding
     above outranks the recipe's re-derived pair. The trim itself arrives from
     .btn; this pair re-derives the same 37.6px the 1.55 leading built —
     2.5 + 12.07 + 8.46 + 12.07 + 2.5 — with the cap band centered by
     construction. */
  @supports (text-box: trim-both cap alphabetic) {
    .sheetbtn {
      padding-block: 12.07px;
    }
  }
  /* The finale manages its own page-level layout; box each instance so
     several can stack in one gallery. Wide (≥760px): break out of the lab's
     540px column so the finale renders its true two-column layout. */
  .fincase {
    border: 2px dashed var(--gray-ink);
    border-radius: 12px;
    padding: 0 10px 10px;
    overflow: hidden;
  }
  @media (min-width: 760px) {
    .fincase {
      width: min(96vw, 1044px);
      position: relative;
      left: 50%;
      transform: translateX(-50%);
    }
  }
</style>

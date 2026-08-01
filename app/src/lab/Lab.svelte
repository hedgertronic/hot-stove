<script lang="ts">
  /** Dev-only UI lab (?lab): edge-case galleries rendered through the REAL
   * components, fed by forged Game states from fixtures.ts. Nothing here
   * ships — App.svelte only imports this module in DEV. */
  import BadgePill from "../components/BadgePill.svelte";
  import BankBox from "../components/BankBox.svelte";
  import Finale from "../components/Finale.svelte";
  import PlayerList from "../components/PlayerList.svelte";
  import PowerupRow from "../components/PowerupRow.svelte";
  import RosterRail from "../components/RosterRail.svelte";
  import SpecialPrimePicker from "../components/SpecialPrimePicker.svelte";
  import {
    PILL_LADDER,
    bankGames,
    finaleBad,
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
    railGames,
    scoutGame,
    specialPrimeGame,
    tdGame,
  } from "./fixtures";

  const market = marketGame();
  const scout = scoutGame();
  const td = tdGame();
  const prime = primeGame();
  const hd = hdGame();
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

  // One confirm per market section; preset so the SIGN pill is visible on load.
  let confirmMarket = $state<string | null>("p:salty");
  let confirmScout = $state<string | null>(null);
  let confirmTd = $state<string | null>(null);

  // The manager career sheet is a modal; a button summons it over the lab.
  let mgrSheet = $state(false);

  const noop = () => {};
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

  <div class="psep">MARKET · HOMEGROWN ARMED</div>
  <div class="cap">
    Debut-matching rows (Ichiro, Garcia) stay live at the flat $1M;
    everyone else grays — every WAR tier represented, chips keep a faded hue
  </div>
  <PlayerList game={hd} confirmKey={null} setConfirm={noop} />

  <div class="psep">PAYROLL BOX</div>
  <div class="cap">Pre-owner (hatched, $???)</div>
  <BankBox game={banks.preOwner} />
  <div class="cap">Classic, ~39% spent</div>
  <BankBox game={banks.normal} />
  <div class="cap">Classic, ~96% spent (near cap)</div>
  <BankBox game={banks.nearCap} />
  <div class="cap">Classic, $14.3M OVER PAYROLL</div>
  <BankBox game={banks.over} />
  <div class="cap">Moneyball (fixed cap, real owners line)</div>
  <BankBox game={banks.moneyball} />
  <div class="cap">Blank Check (fixed cap)</div>
  <BankBox game={banks.blankcheck} />

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
    four, and legend and common are mutually exclusive on the on-field axis),
    so this is the only place the ramp is reviewable end to end. The last row
    is the locked silhouette, a trophy-case state that never reaches a finale.
  </div>
  <div class="ladder">
    {#each PILL_LADDER as row (row.badge.key + (row.locked ? "-locked" : ""))}
      <div class="lrung">
        <BadgePill badge={row.badge} locked={row.locked} />
        <span class="lnote">{row.note}</span>
      </div>
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
    4-PILL CAP, one of each register: 👑 legend (ink fill, gold text) · 💸
    ironic dashed · 🏅 uncommon sky · 🏛️ rare violet
  </div>
  <div class="fincase" id="fin-mariners">
    <Finale game={finMariners} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 🏆 PERFECT SEASON</div>
  <div class="cap">
    Total ≥ 162 → record caps at 162–0, exact points line beneath · FIVE
    badges qualify (👑 🏆 🔮 🧱 ✊) and the four-pill cap drops ✊ from the
    tail — the two legends leading two rares, the row's loudest legal state
    and the only place both legend pills appear together
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
  .sheetbtn {
    display: block;
    margin: 0 auto;
    font-size: 12px;
    padding: 7px 16px;
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

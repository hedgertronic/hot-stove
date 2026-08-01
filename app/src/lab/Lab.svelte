<script lang="ts">
  /** Dev-only UI lab (?lab): edge-case galleries rendered through the REAL
   * components, fed by forged Game states from fixtures.ts. Nothing here
   * ships — App.svelte only imports this module in DEV. */
  import BankBox from "../components/BankBox.svelte";
  import Finale from "../components/Finale.svelte";
  import PlayerList from "../components/PlayerList.svelte";
  import PowerupRow from "../components/PowerupRow.svelte";
  import RosterRail from "../components/RosterRail.svelte";
  import SpecialPrimePicker from "../components/SpecialPrimePicker.svelte";
  import {
    bankGames,
    finaleBad,
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

  <div class="psep">FINALE · UNDER CAP — FULL SWEEP</div>
  <div class="cap">
    Front-office-bonus face · 💍💍🚩 pedigree · 9-⭐ scouting sweep (every
    squad row starred, whole dream team green) · long-name squad row with 4
    pills + 💍 (badge wrap) · 🏠 discount row · badge trio 💯 + 💵 + 🔮
    (101 wins, 98% of cap spent, 9 scout hits)
  </div>
  <div class="fincase" id="fin-under">
    <Finale game={finUnder} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · OVER CAP — STACKED PEDIGREE</div>
  <div class="cap">
    Luxury-tax face ($19.3M over) · 7💍 + 2🚩 &gt; 8 emojis → ×N fallback ·
    1 scout hit · empty dream-team seat (—) · dream manager differs · NO
    badges (an ordinary bust stays under 💸's $25M bar)
  </div>
  <div class="fincase" id="fin-over">
    <Finale game={finOver} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 🔱 BEAT THE MARINERS</div>
  <div class="cap">
    Bought superteam: 129–33 expected record (&gt; 116 wins → 🔱) but a
    $31.3M luxury tax holds the total to 133.4 — no 🏆 · the overrun clears
    $25M, so 💸 MORTGAGED THE FARM shares the line (glory + the bill)
  </div>
  <div class="fincase" id="fin-mariners">
    <Finale game={finMariners} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 🏆 PERFECT SEASON</div>
  <div class="cap">
    Total 186.7 ≥ 162 → record caps at 162–0, exact points line beneath ·
    four badges qualify (🔱 🏆 💵 🔮) and the three-pill cap drops 🔮
  </div>
  <div class="fincase" id="fin-perfect">
    <Finale game={finPerfect} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 💀 100-LOSS CLUB</div>
  <div class="cap">
    Washed vets (4.0 WAR, $3.3M over cap): 61–101 on-field → the dashed 💀
    anti-trophy · the small bust earns no 💸
  </div>
  <div class="fincase" id="fin-bad">
    <Finale game={finBad} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 💸 MORTGAGED THE FARM</div>
  <div class="cap">
    $145M of albatross contracts vs the $96.7M cap: $48.3M tax on a 71-win
    roster, total 24.2 · 💸 is the lone (dashed) pill
  </div>
  <div class="fincase" id="fin-mortgaged">
    <Finale game={finMortgaged} onreplay={noop} onmodes={noop} />
  </div>

  <div class="psep">FINALE · 🧾 POCKETED THE DIFFERENCE</div>
  <div class="cap">
    $35M spent of $96.7M (36%) on a scrap-heap 69–93 roster · −2.8
    front-office penalty · 🧾 is the lone (dashed) pill
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

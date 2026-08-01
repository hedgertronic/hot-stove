<script lang="ts">
  import { SLOT_TYPES, type Game } from "../lib/engine.svelte";
  import { lastName, money, recordFromTotal, seedCode, signed, slotLabel, sortAwards, warTier } from "../lib/format";
  import { GAMES, GOAL_POINTS, MANAGER_PER_NET_WIN, MARINERS_WINS } from "../lib/scoring";
  import { shareBadges, shareText as shareResult } from "../lib/share";
  import AwardPill from "./AwardPill.svelte";

  let {
    game,
    onreplay,
    onmodes,
  }: { game: Game; onreplay: () => void; onmodes: () => void } = $props();

  const fin = $derived(game.finale!);

  const reduced =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  interface LedgerRow {
    key: string;
    lbl: string;
    /** Small muted text beside the label (after any chips/meter). */
    why?: string;
    /** Award pills / emoji chips rendered inline beside the label. */
    chips?: { code: string; n: number }[];
    /** Miniature spend/payroll bar rendered inline beside the label. */
    meter?: { pct: number; over: boolean };
    amt: string;
    cls: "plus" | "minus" | "zero";
  }

  const rows = $derived.by((): LedgerRow[] => {
    const p = fin.parts;
    const out: LedgerRow[] = [];
    // The base line of the ledger: expected wins, unsigned — it's the opening
    // balance every signed row below adjusts, and it sums into the total to
    // the tenth. The markup renders the animated dispWins in its place. The
    // share string keeps the integer fin.wins–fin.losses record.
    out.push({
      key: "wins",
      lbl: "Baseline wins",
      why: game.manager
        ? `50 + ${fin.totalWar.toFixed(1)} WAR + ${lastName(game.manager.name)} ${signed(p.managerWins)}`
        : `50 + ${fin.totalWar.toFixed(1)} WAR, no manager`,
      amt: p.expectedWins.toFixed(1),
      cls: "zero",
    });
    // One budget row, two faces: the tax and the bonus are mutually exclusive
    // by construction (bonus is 0 whenever spend exceeds budget), so over cap
    // the row IS the luxury tax; at/under it's the front-office bonus.
    const overCap = fin.spend > fin.budget;
    const spendPct = fin.budget > 0 ? (fin.spend / fin.budget) * 100 : 100;
    out.push({
      key: "budget",
      lbl: overCap ? "Luxury tax" : "Payroll bonus",
      why: overCap
        ? `${money(fin.spend - fin.budget)} over`
        : `${Math.round(spendPct)}% used`,
      meter: { pct: Math.min(spendPct, 100), over: overCap },
      amt: overCap ? `−${p.luxuryTax.toFixed(1)}` : signed(p.budgetBonus),
      cls: overCap
        ? p.luxuryTax > 0
          ? "minus"
          : "zero"
        : p.budgetBonus > 0
          ? "plus"
          : p.budgetBonus < 0
            ? "minus"
            : "zero",
    });
    const awardCounts = new Map<string, number>();
    for (const s of game.slots) {
      for (const a of s?.awards ?? []) {
        awardCounts.set(a, (awardCounts.get(a) ?? 0) + 1);
      }
    }
    // The skipper's Manager of the Year is trophy-case hardware too (+2 is
    // inside p.awardPoints); sortAwards parks unknown codes last, so MOY
    // trails the player pills.
    if (game.manager?.moty) awardCounts.set("MOY", 1);
    // Canonical award order (MVP → CY → … → AS) as the same pills the player
    // rows wear, with a ×N when an award repeats across the roster.
    const hardwareChips = sortAwards([...awardCounts.keys()]).map((a) => ({
      code: a,
      n: awardCounts.get(a)!,
    }));
    out.push({
      key: "awards",
      lbl: "Trophy case",
      why: hardwareChips.length > 0 ? undefined : "no award seasons",
      chips: hardwareChips.length > 0 ? hardwareChips : undefined,
      amt: signed(p.awardPoints, 0),
      cls: p.awardPoints > 0 ? "plus" : "zero",
    });
    const { rings, pennants } = game.pedigree;
    // One emoji per pedigree season — 💍💍🚩 reads as the actual trophy case.
    // Past 8 emojis (a stacked-pedigree outlier) the row would overflow its
    // single line, so it falls back to the ×N form.
    const pedigreeChips: { code: string; n: number }[] = [];
    if (rings + pennants > 8) {
      if (rings) pedigreeChips.push({ code: "💍", n: rings });
      if (pennants) pedigreeChips.push({ code: "🚩", n: pennants });
    } else {
      if (rings) pedigreeChips.push({ code: "💍".repeat(rings), n: 1 });
      if (pennants) pedigreeChips.push({ code: "🚩".repeat(pennants), n: 1 });
    }
    out.push({
      key: "pedigree",
      lbl: "Ring chasing",
      why: pedigreeChips.length > 0 ? undefined : "no rings, no pennants",
      chips: pedigreeChips.length > 0 ? pedigreeChips : undefined,
      amt: signed(p.ringPoints, 0),
      cls: p.ringPoints > 0 ? "plus" : "zero",
    });
    if (fin.best) {
      out.push({
        key: "scouting",
        lbl: "Scouting report",
        // One star per find, like the pedigree row (max 9 fits the line).
        chips: fin.scoutHits > 0 ? [{ code: "⭐".repeat(fin.scoutHits), n: 1 }] : undefined,
        why: fin.scoutHits > 0 ? undefined : "none found",
        amt: signed(p.scoutBonus, 0),
        cls: p.scoutBonus > 0 ? "plus" : "zero",
      });
    }
    return out;
  });

  let shownRows = $state(0);
  let dispWins = $state(0);
  let dispRecW = $state(0);
  let dispRecL = $state(0);
  let dispTotal = $state("0");
  let totalShown = $state(false);
  let bragsShown = $state(false);

  /** Record + tier come from the shared ladder (lib/format.recordFromTotal)
   * so the home record book resolves totals identically. PERFECT SEASON stays
   * keyed to the exact total, not the capped record. */
  const rec = $derived(recordFromTotal(fin.parts.total, GAMES, MARINERS_WINS));
  const recWins = $derived(rec.wins);
  const recLosses = $derived(rec.losses);
  const recTier = $derived(rec.tier);

  function count(set: (v: number) => void, n: number, ms: number) {
    const t0 = performance.now();
    const tick = (now: number) => {
      const prog = Math.min((now - t0) / ms, 1);
      set(n * (1 - Math.pow(1 - prog, 3)));
      if (prog < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async function confettiPop() {
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({ particleCount: 120, spread: 75, origin: { y: 0.35 } });
    } catch {
      /* confetti is decoration */
    }
  }

  /* Three beats: rows deal out on a steady cadence, a held pause before the
   * total stamp lands (with its count-up and confetti), then the brag pills
   * thunk in once the number has settled. */
  $effect(() => {
    if (reduced) {
      dispWins = fin.parts.expectedWins;
      shownRows = rows.length;
      totalShown = true;
      bragsShown = true;
      dispRecW = recWins;
      dispRecL = recLosses;
      dispTotal = fin.parts.total.toFixed(1);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < rows.length; i++) {
      timers.push(
        setTimeout(() => {
          shownRows = i + 1;
          // The base row counts up as it lands, not before — it's invisible
          // until the reveal reaches it.
          if (i === 0) count((v) => (dispWins = v), fin.parts.expectedWins, 900);
        }, 900 + i * 450),
      );
    }
    // The extra 350ms is the drumroll: one row-beat plus a hold.
    const totalAt = 900 + rows.length * 450 + 350;
    timers.push(
      setTimeout(() => {
        totalShown = true;
        // One eased clock drives the whole resolution: the record plays out
        // from 0–0 — wins and losses accruing together like a season passing
        // game by game — while the exact points tick up in lockstep beneath.
        const t0 = performance.now();
        const tick = (now: number) => {
          const prog = Math.min((now - t0) / 900, 1);
          const ease = 1 - Math.pow(1 - prog, 3);
          dispRecW = Math.round(recWins * ease);
          dispRecL = Math.round(recLosses * ease);
          dispTotal = (fin.parts.total * ease).toFixed(1);
          if (prog < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        void confettiPop();
      }, totalAt),
    );
    // Brags wait for the count-up to settle — they annotate the final number.
    timers.push(setTimeout(() => (bragsShown = true), totalAt + 1000));
    return () => timers.forEach(clearTimeout);
  });


  /* ---- Badges: three rungs plus the goal pill; at most three pills render.
   *
   * Every trigger is calibrated against 2000-game bot runs (tests/bots/,
   * baseline → powerups; frequencies in parens):
   *   on-field rung  🔱 >116 wins (0–0.1%) ⊃ 💯 ≥100 wins (2–53%) |
   *                  💀 ≥100 losses (0% — bots never tank; only a genuinely
   *                  thrown season earns the skull)
   *   money rung     💸 ≥$25M over cap (0.05–0.25%; the typical accidental
   *                  bust is single-digit $M over and stays unbadged) |
   *                  💵 payroll bonus ≥9.5, i.e. ≥97.5% of the cap spent
   *                  without busting (16–30%) | 🧾 ≤60% of the cap spent AND
   *                  a losing record (0–0.15%). The three faces are mutually
   *                  exclusive by construction: over cap zeroes the bonus,
   *                  and ≥97.5% spent can't be ≤60%.
   *   scout rung     🔮 ≥7 of the dream team actually drafted (0.25–2%)
   *   goal           🏆 total ≥162, its own axis — stacks with any rung.
   */
  const FARM_TAX_M = 25; // $M over cap before the overrun earns its pill
  const DIME_BONUS = 9.5; // payroll bonus at ≥97.5% of cap, unbusted
  const CHEAP_PCT = 0.6; // spend/cap at or below this is a pocketed payroll
  const CRYSTAL_HITS = 7; // dream-team picks found (of 8, or 9 with a manager)

  const beatMariners = $derived(fin.wins > MARINERS_WINS);
  /* 💯 is the attainable on-field rung under 🔱, which supersedes it — a
   * Mariners-beater is obviously in the club. */
  const hundredClub = $derived(fin.wins >= 100 && !beatMariners);
  const hundredLosses = $derived(fin.losses >= 100);
  const perfect = $derived(fin.parts.total >= GOAL_POINTS);
  const mortgaged = $derived(fin.spend - fin.budget >= FARM_TAX_M);
  const everyDime = $derived(fin.parts.budgetBonus >= DIME_BONUS);
  const pocketed = $derived(fin.spend <= fin.budget * CHEAP_PCT && fin.wins < fin.losses);
  const crystalBall = $derived(fin.scoutHits >= CRYSTAL_HITS);

  interface Brag {
    key: string;
    label: string;
    /** Pill treatment: "" sky (record) · club/gold/cash/scout fills ·
     * irony = the dashed anti-trophy. */
    cls: "" | "club" | "gold" | "cash" | "scout" | "irony";
  }
  const brags = $derived.by((): Brag[] => {
    const out: Brag[] = [];
    if (beatMariners) out.push({ key: "trident", label: "🔱 BEAT THE 2001 MARINERS", cls: "" });
    else if (hundredClub) out.push({ key: "club", label: "💯 100-WIN CLUB", cls: "club" });
    else if (hundredLosses) out.push({ key: "skull", label: "💀 100-LOSS CLUB", cls: "irony" });
    if (perfect) out.push({ key: "gold", label: "🏆 PERFECT SEASON", cls: "gold" });
    if (mortgaged) out.push({ key: "farm", label: "💸 MORTGAGED THE FARM", cls: "irony" });
    else if (everyDime) out.push({ key: "dime", label: "💵 SPENT EVERY DIME", cls: "cash" });
    else if (pocketed) out.push({ key: "pocket", label: "🧾 POCKETED THE DIFFERENCE", cls: "irony" });
    if (crystalBall) out.push({ key: "crystal", label: "🔮 CRYSTAL BALL", cls: "scout" });
    // Four can fire at once (🔱 + 🏆 + 💵 + 🔮 — the lab's perfect-season
    // game); the pill row caps at three, dropping from the scout end. The
    // share string keeps all of them — emoji cost nothing there.
    return out.slice(0, 3);
  });

  /** The shareable string. Facts in, string out — lib/share owns the format,
   * including the record, which it derives from the total so a shared record
   * can never disagree with the stamp above it. The grid is the finished
   * roster rather than the spin log, which is what makes it a fixed 3×3: one
   * seat per cell, the same shape every game. Badge thresholds run on
   * baseline wins, which is why they arrive as their own fact set. */
  function buildShare(): string {
    return shareResult({
      difficulty: game.config.difficulty,
      bank: game.config.bank,
      total: fin.parts.total,
      // parts.managerWins is 0 with no skipper hired, which is a legitimate
      // rung on the ladder; null is what says "nobody in the chair".
      managerWins: game.manager ? fin.parts.managerWins : null,
      roster: game.slots.map((s) => s?.war ?? null),
      badges: shareBadges({
        baselineWins: fin.wins,
        baselineLosses: fin.losses,
        total: fin.parts.total,
        spendM: fin.spend,
        budgetM: fin.budget,
        budgetBonus: fin.parts.budgetBonus,
        scoutHits: fin.scoutHits,
      }),
    });
  }

  /** Clipboard fallback swaps the button's own label (same in-place pattern
   * as the seed chip); the native share sheet is its own feedback.
   *
   * Both routes are started inside the tap's transient user activation, which
   * is why the clipboard promise is created before the sheet is awaited rather
   * than after. Awaiting the sheet spends the activation, so a write issued
   * afterwards can no longer run — desktop Chrome exposes navigator.share and
   * then rejects it with NotAllowedError, which sent every desktop share down
   * a fallback that could only fail. Starting the write first costs nothing
   * when the sheet succeeds and is the whole fix when it doesn't. */
  let shareState = $state<"idle" | "copied" | "failed">("idle");
  let shareTimer: ReturnType<typeof setTimeout> | undefined;
  async function share() {
    const text = buildShare();
    // Optional chaining, not a try: navigator.clipboard is undefined outside a
    // secure context (a phone hitting the dev server over plain http).
    const writing =
      navigator.clipboard?.writeText(text).then(
        () => true,
        () => false,
      ) ?? Promise.resolve(false);
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* dismissed, unsupported, or refused by permissions policy */
      }
    }
    shareState = (await writing) ? "copied" : "failed";
    clearTimeout(shareTimer);
    shareTimer = setTimeout(() => (shareState = "idle"), 1200);
  }

  /** Copies "#CODE" — the leading # is fine, parseSeedCode strips it.
   * Feedback swaps the chip's own text (no toast line, no layout shift). */
  let seedState = $state<"idle" | "copied" | "failed">("idle");
  let seedTimer: ReturnType<typeof setTimeout> | undefined;
  async function copySeed() {
    const code = `#${seedCode(game.seed)}`;
    try {
      await navigator.clipboard.writeText(code);
      seedState = "copied";
    } catch {
      seedState = "failed";
    }
    clearTimeout(seedTimer);
    seedTimer = setTimeout(() => (seedState = "idle"), 1200);
  }

  /** Signed players who are also on the dream team get the ⭐. */
  const starKeys = $derived.by(() => {
    const keys = new Set<string>();
    for (const b of fin.best?.picks ?? []) if (b) keys.add(`${b.id}:${b.year}:${b.team}`);
    return keys;
  });
  const starred = (s: { id: string; year: number; team: string }) =>
    starKeys.has(`${s.id}:${s.year}:${s.team}`);
</script>

<!-- Phone: the two halves are plain stacked divs, same order as ever. Wide
     (≥760px): the score story (ledger, badges, actions, seed) sits beside the
     rosters (squad + dream team) so the reveal and the receipts share the
     screen. -->
<div class="fin-cols">
<div class="fin-main">
<div class="psep">THE LEDGER</div>
<div class="ledger">
  {#each rows as row, i (row.key)}
    <div class="lrow disp" class:show={i < shownRows}>
      <span class="lbl">{row.lbl}</span>
      {#if row.chips}
        <span class="chipline">
          {#each row.chips as c (c.code)}
            {#if c.code.startsWith("💍") || c.code.startsWith("🚩") || c.code.startsWith("⭐")}
              <span class="pedchip"
                >{c.code}{#if c.n > 1}<span class="mult">×{c.n}</span>{/if}</span
              >
            {:else}
              <AwardPill code={c.code} n={c.n} />
            {/if}
          {/each}
        </span>
      {/if}
      {#if row.meter}
        <span class="minimeter" class:mover={row.meter.over}>
          <span
            class="minifill"
            class:mzero={row.meter.pct <= 0}
            style:width="{row.meter.over ? 100 : row.meter.pct}%"
          ></span>
        </span>
      {/if}
      {#if row.why}
        <span class="why">{row.why}</span>
      {/if}
      <!-- The base row shows the animated wins count-up as its amount; every
           other row's amount is the precomputed string. -->
      <span class="amt" class:plus={row.cls === "plus"} class:minus={row.cls === "minus"}
        >{row.key === "wins" ? dispWins.toFixed(1) : row.amt}</span
      >
    </div>
  {/each}
</div>

<!-- The final stamp: no box, no header — the season the points resolve into.
     The giant tier-colored W–L record is self-announcing; the exact total in
     small type beneath reconciles the ledger to the tenth while the record
     carries the drama. -->
<div class="total-stamp disp" class:show={totalShown}>
  <span class="tamt {recTier}">{dispRecW}–{dispRecL}</span>
  <span class="tpts">{dispTotal} PTS</span>
</div>

{#if bragsShown && brags.length > 0}
  <div class="brags">
    {#each brags as b, i (b.key)}
      <!-- Pills thunk in one at a time, left to right — a short trophy line,
           not a wall (the derivation caps at three). -->
      <div class="brag {b.cls}" style:animation-delay="{i * 0.12}s">{b.label}</div>
    {/each}
  </div>
{/if}

<div class="fin-actions">
  <button class="btn ghost disp" onclick={onmodes}>Modes <span class="bic">🕹️</span></button>
  <button class="btn disp" onclick={onreplay}>Replay <span class="bic">🔄</span></button>
  <button class="btn hot disp" onclick={share}>
    {#if shareState === "idle"}Share <span class="bic">📣</span>{:else if shareState === "copied"}Copied 🔥{:else}Copy failed{/if}
  </button>
</div>

<button class="seedchip disp" class:ok={seedState === "copied"} title="Copy seed" onclick={copySeed}>
  {seedState === "idle" ? `GAME #${seedCode(game.seed)}` : seedState === "copied" ? "COPIED ✓" : "COPY FAILED"}
</button>
</div>

<div class="fin-side">
<div class="squad disp">
  <div class="psep">YOUR SQUAD</div>
  {#each game.slots as slot, i}
    {#if slot}
      <div class="qrow">
        <span class="qpos">{slotLabel(SLOT_TYPES[i])}</span>
        <span class="qmid">
          <span class="qname"
            >{#if starred(slot)}<span class="emo qstar">⭐</span>{/if}{slot.name}
            <i>{slot.year} {slot.team}</i></span
          >
          <span class="qbadges">
            {#if slot.hero}<span class="emo">🏠</span>{/if}
            {#each sortAwards(slot.awards) as a}
              <AwardPill code={a} />
            {/each}
            {#if slot.ws}<span class="emo">💍</span>{:else if slot.pen}<span class="emo">🚩</span>{/if}
          </span>
        </span>
        <span class="qwar {warTier(slot.war)}">{slot.war.toFixed(1)}</span>
      </div>
    {/if}
  {/each}
  {#if game.manager}
    <div class="qrow skiprow">
      <span class="qpos">MGR</span>
      <span class="qmid">
        <span class="qname"
          >{#if fin.managerHit}<span class="emo qstar">⭐</span>{/if}{game.manager.name}
          <i>{game.manager.year} {game.manager.team}</i></span
        >
        <!-- The finale is where hidden hardware comes out, so the skipper's
             Manager of the Year shows in every mode — same pill, same
             awards-then-pedigree order as the player rows above. -->
        <span class="qbadges"
          >{#if game.manager.moty}<AwardPill code="MOY" />{/if}{#if game.manager.ws}<span
              class="emo">💍</span
            >{:else if game.manager.pen}<span class="emo">🚩</span>{/if}</span
        >
      </span>
      <span class="qwar">{signed(fin.parts.managerWins)} W</span>
    </div>
  {/if}
</div>

{#if fin.best}
  <div class="squad disp">
    <div class="psep">⭐ THE DREAM TEAM</div>
    {#each fin.best.picks as pick, i}
      {@const mine =
        pick != null &&
        game.slots.some((s) => s && s.id === pick.id && s.year === pick.year && s.team === pick.team)}
      <div class="qrow" class:dreamhit={mine}>
        <span class="qpos">{slotLabel(SLOT_TYPES[i])}</span>
        {#if pick}
          <!-- Awards show WHY the solver chose this season — they count in
               its objective now, not just WAR. -->
          <span class="qmid">
            <span class="qname">{pick.name} <i>{pick.year} {pick.team}</i></span>
            <span class="qbadges">
              {#each sortAwards(pick.awards) as a}
                <AwardPill code={a} />
              {/each}
              {#if pick.ws}<span class="emo">💍</span>{:else if pick.pen}<span class="emo">🚩</span>{/if}
            </span>
          </span>
          <span class="qwar {warTier(pick.war)}">{pick.war.toFixed(1)}</span>
        {:else}
          <span class="qname empty">—</span>
        {/if}
      </div>
    {/each}
    {#if fin.bestManager}
      <div class="qrow" class:dreamhit={fin.managerHit}>
        <span class="qpos">MGR</span>
        <span class="qmid">
          <span class="qname"
            >{fin.bestManager.name} <i>{fin.bestManager.year} {fin.bestManager.team}</i></span
          >
          <!-- MotY is worth +2 in the solver's objective, so the pill shows
               WHY this skipper won the seat — the same reason the dream
               players wear their award pills. Optional-chained: the flag is
               absent on pre-MotY saved finales. -->
          <span class="qbadges"
            >{#if fin.bestManager?.moty}<AwardPill code="MOY" />{/if}{#if fin.bestManager.ws}<span
                class="emo">💍</span
              >{:else if fin.bestManager.pen}<span class="emo">🚩</span>{/if}</span
          >
        </span>
        <span class="qwar">{signed(fin.bestManager.netWins * MANAGER_PER_NET_WIN)} W</span>
      </div>
    {/if}
  </div>
{/if}
</div>
</div>

<style>
  /* Wide: score story beside the rosters. Each squad's psep header carries
     its own dashed rule, so the side column needs no extra separators — the
     first squad just tucks up to align with the head. */
  @media (min-width: 760px) {
    .fin-cols {
      display: grid;
      grid-template-columns: minmax(0, 10fr) minmax(0, 9fr);
      gap: 28px;
      align-items: start;
      max-width: 1020px;
      margin: 0 auto;
    }
    /* Both columns open with a psep header, so the first squad sheds its
       stacked-layout gap to sit level with THE LEDGER. */
    .fin-side > .squad:first-child {
      margin-top: 0;
    }
  }
  /* Brag badges pop with the total, right under the stamp they qualify —
     up to three pills on one wrapping, centered line. */
  .brags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 8px;
    margin-top: 12px;
  }
  .brag {
    border: 2px solid var(--ink);
    border-radius: 999px;
    background: var(--sky);
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 3px 12px;
    animation: thunk-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  .brag.gold {
    background: var(--yellow);
  }
  /* Quieter than 🔱's sky — the club is the attainable rung. */
  .brag.club {
    background: var(--card);
  }
  /* Money-precision green; the cap spent to the last percent. */
  .brag.cash {
    background: var(--green-wash);
  }
  /* The scouting chase wears the one warm fill no other pill uses. */
  .brag.scout {
    background: var(--pink);
  }
  /* The anti-trophy: ironic badges (💀 💸 🧾) get the ghost treatment —
     dashed hairline, no fill, muted ink. A citation, not a prize. */
  .brag.irony {
    border-style: dashed;
    border-color: var(--gray-ink);
    background: transparent;
    color: var(--muted);
  }
  @keyframes thunk-in {
    from {
      opacity: 0;
      transform: scale(0.6);
    }
  }
  /* Reduced motion: pills are simply there — no thunk, no stagger. */
  @media (prefers-reduced-motion: reduce) {
    .brag {
      animation: none;
    }
  }
  .ledger {
    display: grid;
    /* minmax(0,…): the track must be able to shrink below the rows' intrinsic
       width, or one long why-string widens every row past the phone screen. */
    grid-template-columns: minmax(0, 1fr);
    gap: 7px;
  }
  /* Every row is one line — label, then its visual (pills / emoji chips /
     mini meter) and small text, amount on the right — at one shared height. */
  .lrow {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 44px;
    border: 2.5px solid var(--ink);
    border-radius: 11px;
    background: var(--card);
    padding: 6px 12px;
    opacity: 0;
    transform: translateY(10px) scale(0.97);
  }
  .lrow.show {
    opacity: 1;
    transform: none;
    transition:
      opacity 0.3s,
      transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .lbl {
    font-weight: 800;
    font-size: 13.5px;
    flex: none;
  }
  .why {
    font-size: 10.5px;
    color: var(--muted);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Trophy case row: the same award pills the player rows wear, wrapping only
     if a stacked roster collects many distinct awards. */
  .chipline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
    min-width: 0;
  }
  .mult {
    font-size: 8px;
    margin-left: 2px;
  }
  /* Pedigree chips: the emoji carries the color, so no pill border. Slight
     tracking keeps repeated emoji (💍💍🚩) from fusing into one blob. */
  .pedchip {
    display: inline-flex;
    align-items: center;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.5;
    letter-spacing: 0.1em;
  }
  /* Miniature of the BankBox meter — same colors/hatch, inline row-scaled. */
  .minimeter {
    display: block;
    width: 96px;
    flex: none;
    height: 8px;
    border: 1.5px solid var(--ink);
    border-radius: 999px;
    background: var(--card);
    overflow: hidden;
  }
  .minifill {
    display: block;
    height: 100%;
    background: var(--green);
    border-right: 1.5px solid var(--ink);
  }
  .minifill.mzero {
    border-right: 0;
    background: transparent;
  }
  .minimeter.mover .minifill {
    background: repeating-linear-gradient(
      -45deg,
      var(--orange) 0 8px,
      var(--orange-deep) 8px 16px
    );
    border-right: 0;
  }
  .amt {
    margin-left: auto;
    font-weight: 800;
    font-size: 16px;
    white-space: nowrap;
  }
  .amt.plus {
    color: var(--green);
  }
  .amt.minus {
    color: var(--orange);
  }
  /* The final stamp: unboxed, unlabeled, and by far the biggest type on the
     page — the season record the points resolve into. Every other section
     opens with a psep header; the payoff is the one block that doesn't need
     a name. Whitespace alone separates it from the ledger, and it sits
     centered on the same axis as the brags, buttons, and seed chip, so the
     whole payoff stack reads as one ceremony. The exact points sit quiet
     beneath the record — the tenth-precise number the ledger actually sums
     to. */
  .total-stamp {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 14px;
    opacity: 0;
  }
  .total-stamp.show {
    opacity: 1;
    animation: stamp-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes stamp-in {
    from {
      opacity: 0;
      transform: scale(0.82);
    }
  }
  .tamt {
    font-size: 54px;
    font-weight: 900;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
  }
  /* The record wears the game's WAR-ladder palette, keyed to its win count —
     the same color language every player chip already taught. */
  .tamt.neg {
    color: var(--war-neg);
  }
  .tamt.low {
    color: var(--war-low);
  }
  .tamt.mid {
    color: var(--war-mid);
  }
  .tamt.high {
    color: var(--war-high);
  }
  .tamt.star {
    color: var(--war-star);
  }
  .tamt.elite {
    /* Brighter than --war-elite on purpose: at 54px/900 the token's #c98a08
       reads brown; true gold needs the extra chroma at stamp size. */
    color: #e0a010;
  }
  /* The exact points, quiet and tabular under the record — it reconciles the
     ledger (rows sum to this, not to the rounded record) and tells 162.5
     apart from a 185 blowout when the record caps at 162–0. */
  .tpts {
    margin-top: 2px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  /* The exits keep their distance: the stamp (and any brags) is the payoff
     moment, and the buttons are the next scene. This override lives BELOW the
     wide-layout block, so it must carry its own media query to win. */
  .fin-actions {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 9px;
    margin-top: 28px;
  }
  @media (min-width: 760px) {
    /* The score column has spare height beside the rosters — a wider moat. */
    .fin-actions {
      margin-top: 48px;
    }
  }
  .fin-actions .btn {
    min-height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 7px 8px;
    font-size: 13px;
  }
  .bic {
    font-size: 19px;
    line-height: 1;
  }
  .btn.ghost {
    background: transparent;
    border-style: dashed;
    color: var(--muted);
  }
  /* The game's seed — quiet, mono; tap to copy it for PLAY A SEED #. */
  .seedchip {
    display: block;
    margin: 10px auto 0;
    background: none;
    border: 0;
    padding: 4px 8px;
    cursor: pointer;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: var(--muted);
    /* Wide enough for the longest label so the copy feedback can't jiggle it. */
    min-width: 15ch;
  }
  .seedchip.ok {
    color: var(--green-deep);
  }
  /* Each squad opens with a global .psep header (label inline with the
     dashed rule, same as FRONT OFFICE / PLAYERS on the draft screen), so
     the block itself carries no separator of its own. */
  .squad {
    margin-top: 16px;
  }
  .qrow {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--card);
    /* Card-level box weight (2.5px), matching the market/ledger rows. */
    border: 2.5px solid var(--ink);
    border-radius: 10px;
    padding: 5px 9px;
    margin-bottom: 6px;
  }
  .qpos {
    width: 36px;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--muted);
    flex: none;
  }
  /* Name and badges share a line when they fit; the badges wrap below when a
     decorated player runs out of room (narrow phones). The name never shrinks
     to make space for pills — past the row width it ellipsizes instead. */
  .qmid {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 4px;
    overflow: hidden;
  }
  .qname {
    font-weight: 800;
    font-size: 13px;
    flex: none;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .qname i {
    font-style: normal;
    color: var(--muted);
    font-size: 11px;
    font-weight: 700;
  }
  .qbadges {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: none;
  }
  .emo {
    font-size: 12px;
    line-height: 1;
  }
  /* Star prefix inside a name — the margin (not markup whitespace, which
     Svelte may collapse) guarantees the gap before the name. */
  .qstar {
    margin-right: 4px;
  }
  /* Default (no tier class) is the manager "+W" rows: wins added, plain green. */
  .qwar {
    margin-left: auto;
    font-weight: 800;
    font-size: 13px;
    color: var(--green);
    flex: none;
  }
  .qwar.high {
    color: var(--war-high);
  }
  .qwar.elite {
    color: var(--war-elite);
  }
  .qwar.star {
    color: var(--war-star);
  }
  .qwar.low {
    color: var(--gray-ink);
  }
  .qwar.neg {
    color: var(--war-neg);
  }
  .qwar.mid {
    color: var(--war-mid);
  }
  .skiprow {
    background: var(--pink);
  }
  .skiprow .qwar {
    color: var(--ink);
  }
  /* The dream team's only "you found this one" cue is the green tint; the
     matching squad row carries the ⭐ — one cue per list, no repetition. */
  .qrow.dreamhit {
    background: var(--green-wash);
  }
  .qname.empty {
    color: var(--gray-ink);
  }
</style>

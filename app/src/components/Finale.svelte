<script lang="ts">
  import { bragRow } from "../lib/badges";
import { track } from "../lib/analytics";
  import { ownerFor } from "../lib/data";
  import { SLOT_TYPES, type Game } from "../lib/engine.svelte";
  import { lastName, money, recordFromTotal, seedCode, signed, slotLabel, sortAwards, warTier } from "../lib/format";
  import { GAMES, MANAGER_PER_NET_WIN, MARINERS_WINS } from "../lib/scoring";
  import { shareText as shareResult } from "../lib/share";
  import {
    countryDef,
    passport,
    passportItems,
    type PassportItem,
  } from "../lib/settings";
  import AwardPill from "./AwardPill.svelte";
  import BadgeSlot from "./BadgeSlot.svelte";
  import Passport from "./Passport.svelte";
  import PayrollBox, { FIXED_CAP_CLUB } from "./PayrollBox.svelte";

  let {
    game,
    onreplay,
    onmodes,
    resolved = false,
  }: {
    game: Game;
    onreplay: () => void;
    onmodes: () => void;
    /** This finale has already been watched — it was restored from storage, not
     * just earned. The reveal is a payoff for the game that produced it; a
     * reload is not that game, and re-dealing the ledger and re-firing the
     * confetti every refresh turns the payoff into a toll. Renders the settled
     * state directly, down the same branch prefers-reduced-motion already
     * takes. */
    resolved?: boolean;
  } = $props();

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
    /** Miniature spend/payroll bar rendered inline beside the label — the club
     * itself, not a precomputed share, because PayrollBox draws it and
     * PayrollBox is what decides how a payroll looks. */
    meter?: { budget: number; spend: number };
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
      meter: { budget: fin.budget, spend: fin.spend },
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
   * thunk in once the number has settled.
   *
   * Two states skip all three and render the finished screen: a player who has
   * asked for reduced motion, and a finale restored from storage, which has
   * already been watched once. Both want the same thing — every row shown, the
   * stamp up, the counters at their final values, the brag pills visible, and
   * no confetti — so both take one branch, and it returns before a single timer
   * is created, which is why there is nothing to clean up. */
  $effect(() => {
    if (reduced || resolved) {
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


  /* ---- Badges: the pill row is a render of fin.badges, nothing more.
   *
   * Every trigger, label, emoji, and measured frequency lives in lib/badges —
   * this component resolves keys to definitions and stops. The engine already
   * ran `earnedBadges` at the finale and wrote the keys into the result, so
   * the pills, the share string, and the trophy case are the same list by
   * construction rather than by three agreeing copies of the thresholds.
   *
   * `?? []` and the BADGE_BY_KEY filter cover a finale restored from storage
   * that predates the badge field, and a key retired from the set after a save
   * was written — either way the row renders empty instead of throwing. */
  /* Every badge earned, no cut. The row used to hold four and drop the rest to
   * save pixels, which meant a club that earned six was shown a club that
   * earned four — and a badge cut for space reads exactly like a badge not
   * earned. The row wraps, the sheet scrolls, and the share string was already
   * uncapped, so the pill row was the one surface understating the result.
   *
   * `?? []` on both arguments covers a finale restored from a save older than
   * either field: an empty row, and no flags, rather than a throw. */
  const brags = $derived(bragRow(fin.badges ?? [], fin.newBadges ?? []));

  /** The one open badge in the row, by key — the same one-at-a-time reveal the
   * trophy case runs, through the same BadgeSlot. A badge earned here explains
   * itself here, so a player never has to go find the case to learn what they
   * just did. */
  let openBrag = $state<string | null>(null);

  /** The shareable string. Facts in, string out — lib/share owns the format,
   * including the record, which it derives from the total so a shared record
   * can never disagree with the stamp above it. The grid is the finished
   * roster rather than the spin log, which is what makes it a fixed 3×3: one
   * seat per cell, the same shape every game. Badges go over as the keys the
   * engine resolved, uncapped — the string shows every one the pill row had to
   * drop. */
  function buildShare(): string {
    return shareResult({
      difficulty: game.config.difficulty,
      bank: game.config.bank,
      total: fin.parts.total,
      // parts.managerWins is 0 with no skipper hired, which is a legitimate
      // rung on the ladder; null is what says "nobody in the chair".
      managerWins: game.manager ? fin.parts.managerWins : null,
      roster: game.slots.map((s) => s?.war ?? null),
      badges: fin.badges ?? [],
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
    track("share");
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

  /* ---- THE CEILING: what the dream club would have gone.
   *
   * Read, never recomputed. `bestPossibleRecord` came out of the same
   * lib/format.recordFromTotal the stamp above is built from, so the two
   * records sit on one ladder by construction rather than by two call sites
   * agreeing. Both fields are optional: a finale restored from a save written
   * before the ceiling existed has no answer, and "no ceiling known" renders
   * nothing at all rather than a hole. */
  const ceilRec = $derived(fin.bestPossibleRecord ?? null);
  const ceilTotal = $derived(fin.bestPossibleTotal ?? null);
  /** The solver's own UNCLAMPED total. `bestPossibleTotal` is floored at the
   * club the player actually built, so the two differ exactly when the search
   * lost to a line it does not model (✌️ Double Play taking two picks off one
   * card, or the reel landing on the same card twice) — and in that case the
   * dream club listed below genuinely scores less than the ceiling. Absent on
   * old saves and on fixtures that predate the field. */
  const solved = $derived(fin.best?.total ?? null);
  /** When the printed ceiling would be a number the club below it does not
   * score. `playedTheCeiling` covers two situations: the search confirming the
   * club the player built, and the search losing to a line it does not model —
   * and only in the second does the dream club on screen score LESS than the
   * ceiling floored at the player's total. With no solved total to check, the
   * two are indistinguishable, so the same suppression applies. Compared at the
   * tenth the finale renders. */
  const ceilUnsound = $derived(
    fin.playedTheCeiling === true && (solved == null || fin.parts.total - solved > 0.05),
  );

  /* ---- THE PASSPORT: where this club came from.
   *
   * The only place in the game a birth country is ever printed while a club is
   * on screen, and the one place the no-hunting rule relaxes. Nothing in the
   * market, the rail or the pickers shows where a man was born, precisely so a
   * country can never be shopped for; here the season is finished and no pick
   * can be made in response, so naming what the club turned out to hold costs
   * nothing and is the moment the souvenir is actually earned.
   *
   * A country nobody has ever fielded before wears the same NEW chip a
   * first-ever badge wears and leads the row the same way, because it is the
   * same claim about the same kind of object and a second vocabulary for
   * "this one is new" would be one to learn for nothing.
   *
   * THE WHOLE PASSPORT, not this club's slice of it. The panel used to list the
   * countries on the roster and nothing else, which is the narrower and worse
   * object: it told a player what they already had in front of them, and hid
   * the thing the moment is actually about — that tonight's club added a stamp
   * to a collection. Showing the career and flagging what tonight put in it
   * makes the new one legible AGAINST something, and gives a club that added
   * nothing new a souvenir anyway.
   *
   * It carries the numbers for the same reason: this is the passport, so it
   * counts what the passport counts — unique players per country across every
   * game. `passportItems` is the trophy case's own builder, so the two panels
   * cannot disagree about a single figure on a single stamp. No grayed slots
   * here, though: the empty half of the board is context for a collection being
   * browsed, and this is a scoreboard.
   *
   * Which countries are new is read out of the lifetime passport rather than
   * handed over by the engine, which means it is true the moment this component
   * renders instead of waiting on a field the engine does not write.
   * `recordHistory` runs before the finale is shown, so this game is already in
   * the log: a country on tonight's roster with ONE visit is a country this
   * club is the only record of, which is exactly "never fielded before". A
   * restored finale reads the same, since the row is still there and still the
   * only one. Note that both halves are required — a one-visit country NOT on
   * tonight's roster is impossible, but reading visits alone would flag it if
   * it ever became possible.
   *
   * It fails toward celebrating rather than withholding, twice. A history row
   * that never landed — a full or disabled localStorage — leaves the country
   * unknown to the passport, and an unknown country reads as new. And a season
   * played before history rows carried countries at all contributes no visit,
   * so a country first met back then reads as new the next time it appears.
   * Neither is recoverable: the log holds no roster and never has. Both name a
   * real country the club really held, which is the whole content of the
   * chip — only the chip can be generous. */
  const clubCountries = $derived.by((): PassportItem[] => {
    const tonight = new Set<string>();
    for (const s of game.slots) {
      const raw = s?.bc;
      if (typeof raw === "string" && raw.trim() !== "") tonight.add(raw.trim());
    }
    const visits = new Map(passport().map((s) => [s.country, s.visits]));
    const fresh = new Set(
      [...tonight].filter((c) => (visits.get(c) ?? 1) <= 1),
    );
    const items = passportItems(fresh);
    // A country tonight's club held that the lifetime passport has no row for
    // at all — the storage failure above. It still gets a stamp, because the
    // panel's subject is where these men came from and the log's silence is not
    // the player's problem.
    const known = new Set(items.map((i) => i.country));
    const orphans: PassportItem[] = [...tonight]
      .filter((c) => !known.has(c))
      .map((c) => {
        const def = countryDef(c);
        return {
          country: c,
          flag: def?.flag ?? "",
          rarity: def?.rarity ?? null,
          count: null,
          fresh: true,
          locked: false,
          title: null,
        };
      });
    // The new ones lead, the same order `bragRow` puts the badge pills in and
    // for the same reason: the flagged one is what the player is here to see.
    return [...orphans, ...items].sort((a, b) => Number(b.fresh) - Number(a.fresh));
  });

  /** The front office a club ran, or null under a fixed cap — where payroll is
   * a constant and there is no owner to hire or ballpark to buy. */
  interface FrontOffice {
    owner: string;
    ownerBudget: number;
    park: string;
    mult: number;
  }
  /** The player's, when there is one. Read off game.owner / game.stadium, both
   * of which StoredFinale archives, so a restored finale renders the same. */
  const myFront = $derived.by((): FrontOffice | null =>
    game.owner && game.stadium
      ? {
          owner: game.owner.name,
          ownerBudget: game.owner.budget,
          park: game.stadium.park,
          mult: game.stadium.mult,
        }
      : null,
  );
  /** The dream club's. The solver stores card coordinates and never the
   * owner's name (it does not load owners.json), so the name resolves here off
   * the same table the draft screen reads. */
  const dreamFront = $derived.by((): FrontOffice | null => {
    const o = fin.best?.owner;
    const p = fin.best?.park;
    return o && p
      ? {
          owner: ownerFor(game.owners, o.franchise, o.year),
          ownerBudget: o.budget,
          park: p.park,
          mult: p.mult,
        }
      : null;
  });
</script>

<!-- Each club's front office, as the payroll it bought rather than as two more
     roster rows. Owner and ballpark produce no WAR, and a list of WAR-bearing
     rows is the one place they must not sit: the eye reads a row in that list
     as a contributor. What they actually do is set a number — owner budget ×
     ballpark multiplier = payroll — which is exactly the object the player has
     been reading all game, so it is exactly the component that renders it.
     PayrollBox takes plain values rather than a Game, which is what lets the
     solver's club — a club no Game exists for — render through the same code.

     `pending` stays false in both: a finished club with no front office on
     record has nothing still coming, so it shows its payroll and no TBD names.

     No cue in either copy. Neither seat is scoutable, so a player whose owner
     happens to be the dream owner has found nothing. -->
{#snippet payroll(front: FrontOffice | null, budget: number, spend: number)}
  <!-- Under a fixed cap nobody was hired, so the hires line carries the owner
       of the club the mode borrows its payroll from — the same line the bank
       box shows all game, which is what keeps the box one height across every
       mode. The club is PayrollBox's constant so both surfaces name the same
       one; only the lookup happens here. -->
  {@const fixedClub = FIXED_CAP_CLUB[game.config.bank]}
  <div class="paywrap">
    <PayrollBox
      bank={game.config.bank}
      {budget}
      {spend}
      ownerName={front?.owner ??
        (fixedClub ? ownerFor(game.owners, fixedClub.team, fixedClub.year) : null)}
      ownerBudget={front?.ownerBudget ?? null}
      parkName={front?.park ?? null}
      parkMult={front?.mult ?? null}
    />
  </div>
{/snippet}

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
        <!-- The payroll box's own bar, at ledger scale. The budget row is the
             payroll story in one line, and the bar it shows has to be the bar
             the player read all game — a lookalike built here is the copy that
             drifted last time. -->
        <div class="minimeter">
          <PayrollBox
            mini
            bank={game.config.bank}
            budget={row.meter.budget}
            spend={row.meter.spend}
          />
        </div>
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
    {#each brags as b, i (b.def.key)}
      <!-- The pill and the tap-to-explain are BadgeSlot's, shared with the home
           trophy case, so a badge looks and behaves the same the moment it is
           earned as it does in the case. `animate` asks for the thunk-in
           entrance; this seat supplies the left-to-right stagger below.
           `display: contents` (see .bragseat): the wrapper carries the index
           and generates no box, so the button and the reveal panel BadgeSlot
           emits stay direct flex children of .brags and the panel's containing
           block is still .brags. A wrapper that generated a box would fence the
           panel inside one pill's width. -->
      <span class="bragseat" style="--i: {i}">
        <BadgeSlot
          badge={b.def}
          animate={!resolved}
          fresh={b.fresh}
          open={openBrag === b.def.key}
          ontoggle={() => (openBrag = openBrag === b.def.key ? null : b.def.key)}
        />
      </span>
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
    <div class="qrow skiprow war-{warTier(fin.parts.managerWins)}">
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
      <!-- The rung the row is already wearing, on the numeral that earned it.
           This read plain green while the fill and the frame around it read
           gold, which said two different things about one skipper. -->
      <span class="qwar {warTier(fin.parts.managerWins)}">{signed(fin.parts.managerWins)} W</span>
    </div>
  {/if}
  <!-- The payroll this club ran, closing the list. A footer, not a header: the
       seats are what the player came to see, and the front office is the
       envelope they were bought inside. fin.spend and fin.budget are required
       fields, so this renders on a finale of any age. -->
  {@render payroll(myFront, fin.budget, fin.spend)}
</div>

{#if clubCountries.length > 0}
  <!-- Its own short block under the squad it belongs to, and not a column in
       the roster rows: a birth country belongs to a man, but the thing being
       shown is a property of the CAREER, and eight rows each carrying a flag
       would read as eight facts instead of one. Nothing renders at all for a
       player whose log holds no country — every save written before the field
       existed, and every restored finale older than it. -->
  <div class="squad disp">
    <div class="psep">PASSPORT</div>
    <Passport stamps={clubCountries} label="Countries fielded" />
  </div>
{/if}

{#if fin.best}
  <div class="squad disp">
    <div class="psep">⭐ THE DREAM TEAM</div>
    <!-- What this club would have gone: the stamp's own two lines — record
         over exact points — at a fraction of its type size, directly under the
         header so it captions the roster it belongs to. No words: the player's
         record is a few inches up the same screen and the subtraction is
         theirs to do. Without it the dream club has no total at all, and a
         solver that trades WAR for payroll bonus looks broken rather than
         clever.
         The one exception is a ceiling the club below does not actually
         score — there the number would be the lie, so the label replaces it. -->
    {#if ceilTotal != null && ceilRec}
      <div class="ceil">
        {#if ceilUnsound}
          <span class="ctag">BEST CLUB WE FOUND</span>
        {:else}
          <span class="crec">{ceilRec.wins}–{ceilRec.losses}</span>
          <span class="cpts">{ceilTotal.toFixed(1)} PTS</span>
        {/if}
      </div>
    {/if}
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
      {@const bestWins = fin.bestManager.netWins * MANAGER_PER_NET_WIN}
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
        <!-- Same rule for the dream club's skipper: the eight seats above it
             carry their rung on the numeral, and this one had been the only
             row in either list reading a hue it had not earned. -->
        <span class="qwar {warTier(bestWins)}">{signed(bestWins)} W</span>
      </div>
    {/if}
    <!-- The payroll the dream club would have run, in the same place and the
         same shape YOUR SQUAD's sits in above — so the two clubs' front offices
         compare straight across, which is the only reason to show the solved
         one at all. A club spending 96% of its cap against one spending 78% is
         the answer to "why is the dream team's WAR lower than mine".
         Both figures are optional: absent on a finale restored from a save that
         predates them, and the block simply doesn't render. -->
    {#if fin.best.budget != null && fin.best.spend != null}
      {@render payroll(dreamFront, fin.best.budget, fin.best.spend)}
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
     up to four pills on one wrapping, centered line. Every pill is nowrap, so
     the row breaks between pills and never inside one — which costs nothing,
     because the widest pill in the set (🔱 MATCHED THE 2001 MARINERS, 232px)
     still fits the row's width on a 360px screen. The pills themselves are
     BadgeSlot's; this rule owns layout only.
     `position: relative` is BadgeSlot's contract: the row is the containing
     block for an opened badge's panel, so the panel is clamped to this box and
     floats over the stamp and the buttons instead of displacing them. */
  .brags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 8px;
    margin-top: 12px;
    position: relative;
  }
  /* The left-to-right deal. BadgePill's `animate` supplies the thunk; the order
     the pills arrive in is the ROW's business, so the delay lives here.
     Counted, not enumerated. This used to be one hand-written rule per seat,
     which was serviceable while the row held at most four pills and is not now
     that it holds every badge earned — a club with nine would have had six
     pills arrive together. `--i` is the seat's index, set by the markup, and
     one rule covers any count.
     The seat generates no box (`display: contents`), so it changes nothing
     about the row's layout or about where BadgeSlot's reveal panel is fenced;
     it exists only to carry that index and to be the thing the delay is set on.
     It reaches THROUGH the button to the pill, because the animation is on the
     pill and a delay set on the button would apply to nothing.
     The last seat lands at 0.12s × index, so nine pills finish in about a
     second — the reveal is a deal, not a queue.
     No reduced-motion override is needed: BadgePill drops the animation
     entirely there, and a delay on nothing is nothing. */
  .bragseat {
    display: contents;
  }
  .bragseat > :global(button .brag) {
    animation-delay: calc(var(--i) * 0.12s);
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
  /* The slot the payroll bar sits in. Only the width is decided here — how
     wide a bar this row can spare — because everything inside it is PayrollBox
     drawing the same bar it draws on the board. */
  .minimeter {
    width: 96px;
    flex: none;
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
  /* Every numeral in both lists carries a tier class, players and skippers
     alike, so the bare `.qwar` color is a fallback nothing reaches — kept as
     the one honest default for a value with no rung (Eye Test hides WAR, not
     this row) rather than deleted and re-derived the next time a row is
     added. */
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
    color: var(--war-low);
  }
  .qwar.neg {
    color: var(--war-neg);
  }
  .qwar.mid {
    color: var(--war-mid);
  }
  /* The hired skipper's row wears the rung its wins earned, fill and frame
     together — the hue at rung 2 inside the hue at rung 8, which is the pair
     every WAR chip in the game has been teaching. It is the same seat, the same
     rung and the same tokens `RosterRail` paints its manager chair with, so the
     board and the finale describe one manager the same way instead of two.
     The eight player rows above keep card white and carry their rung on the
     numeral alone: eight tinted rows would be eight competing fills, and the
     skipper is the one row whose value has nowhere else to live — its "+14.0 W"
     is on a different scale from the WAR beside it and cannot be read against
     them.
     `.qrow.dreamhit` below outweighs nothing here: no row is ever both, since
     the squad list owns `skiprow` and the dream list owns `dreamhit`. */
  .qrow.skiprow.war-neg {
    background: var(--war-neg-fill);
    border-color: var(--war-neg);
  }
  .qrow.skiprow.war-low {
    background: var(--war-low-fill);
    border-color: var(--war-low);
  }
  .qrow.skiprow.war-mid {
    background: var(--war-mid-fill);
    border-color: var(--war-mid);
  }
  .qrow.skiprow.war-high {
    background: var(--war-high-fill);
    border-color: var(--war-high);
  }
  .qrow.skiprow.war-star {
    background: var(--war-star-fill);
    border-color: var(--war-star);
  }
  .qrow.skiprow.war-elite {
    background: var(--war-elite-fill);
    border-color: var(--war-elite);
  }
  /* Ink on a rung-2 fill, which is app.css's own rule for text on these six
     washes and not a rule about this row: the worst pair measures 9.52:1 and
     the best 13.41:1. Tinting the numeral to match its fill is the alternative
     and it runs 2.17:1 to 3.77:1 on 13px type. The rung is already said twice
     on this row, by the fill and by the frame; the numeral's job is the
     number. */
  .skiprow .qwar {
    color: var(--ink);
  }
  /* One rung darker than the player rows' sub-lines take. Those sit on card
     white, a single known ground; these sit on whichever of six washes the
     skipper's rung supplies, and violet-2 is the darkest — --muted measures
     3.39:1 there against 4.37:1 for --muted-2. One token, chosen for the worst
     rung, so the line reads the same on all six. */
  .skiprow .qpos,
  .skiprow .qname i {
    color: var(--muted-2);
  }
  /* The dream team's only "you found this one" cue is the green tint; the
     matching squad row carries the ⭐ — one cue per list, no repetition. */
  .qrow.dreamhit {
    background: var(--green-wash);
    border-color: var(--green-8);
  }
  .qname.empty {
    color: var(--gray-ink);
  }
  /* The payroll block's own spacing. PayrollBox carries no outer margin — it
     sits in a sticky HUD column in one surface and closes a roster list in the
     other, and those want different air. Here it is the foot of a list. */
  .paywrap {
    margin: 2px 0 4px;
  }
  /* THE CEILING, captioning the dream team: the stamp's own two lines — record
     over exact points — at a fraction of its type size, so the two read as the
     same object at two ranks and nobody mistakes the counterpoint for the
     headline. Deliberately untinted: the tier palette is the stamp's, and a
     second colored record at size would be a second scoreboard. */
  .ceil {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0 0 10px;
    text-align: center;
  }
  /* Stands in for the record on the one finale where the number would not be
     true of the club listed beneath it. */
  .ctag {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--muted);
  }
  .crec {
    font-size: 24px;
    font-weight: 900;
    line-height: 1.15;
    color: var(--muted-2);
    font-variant-numeric: tabular-nums;
  }
  .cpts {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>

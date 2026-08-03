<script lang="ts">
  import { bragRow } from "../lib/badges";
import { track } from "../lib/analytics";
  import { ownerFor } from "../lib/data";
  import { SLOT_TYPES, type Game } from "../lib/engine.svelte";
  import { lastName, money, recordFromTotal, seedCode, signed, slotLabel, sortAwards, warTier } from "../lib/format";
  import {
    GAMES,
    MANAGER_PER_NET_WIN,
    MARINERS_WINS,
    WBC_CHAMPION_POINTS,
    WBC_RUNNERUP_POINTS,
  } from "../lib/scoring";
  import { shareText as shareResult } from "../lib/share";
  import { countryDef, passport, type PassportItem } from "../lib/settings";
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
    const { rings, pennants, wbcChampions, wbcRunnersUp } = game.pedigree;
    // One emoji per honour the club's seasons won — 💍💍🚩🌐 reads as the
    // actual trophy case. October's rings and pennants and March's Classic
    // medals share this row because they share this ledger line, so the glyph
    // count is all four and so is the fallback's threshold: past 8 emojis (a
    // stacked-pedigree outlier) the row would overflow its single line, so it
    // falls back to the ×N form.
    const pedigreeChips: { code: string; n: number }[] = [];
    if (rings + pennants + wbcChampions + wbcRunnersUp > 8) {
      if (rings) pedigreeChips.push({ code: "💍", n: rings });
      if (pennants) pedigreeChips.push({ code: "🚩", n: pennants });
      if (wbcChampions) pedigreeChips.push({ code: "🌐", n: wbcChampions });
      if (wbcRunnersUp) pedigreeChips.push({ code: "🎌", n: wbcRunnersUp });
    } else {
      if (rings) pedigreeChips.push({ code: "💍".repeat(rings), n: 1 });
      if (pennants) pedigreeChips.push({ code: "🚩".repeat(pennants), n: 1 });
      if (wbcChampions) pedigreeChips.push({ code: "🌐".repeat(wbcChampions), n: 1 });
      if (wbcRunnersUp) pedigreeChips.push({ code: "🎌".repeat(wbcRunnersUp), n: 1 });
    }
    out.push({
      key: "pedigree",
      lbl: "Ring chasing",
      // Names all four things the row can now be empty of, in one phrase
      // short enough to survive the narrow phone: spelled out as "no rings,
      // no pennants, no medals" the line ellipsizes at 320px.
      why: pedigreeChips.length > 0 ? undefined : "nothing won",
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
        // One decimal, unlike the trophy case and ring rows above: a scout
        // point is worth half, so this row lands on .5 at every odd count and
        // a whole-number rendering would not add up to the total.
        amt: signed(p.scoutBonus),
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
  /** Seconds between pills as the row deals. Nine badges finish in about a
   * second at this step — a deal, not a queue. */
  const BRAG_STEP = 0.12;

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
   * THIS CLUB, COUNTED THIS CLUB. Every stamp names a country one of tonight's
   * eight men was born in, and its number is how many of tonight's men that
   * was — six Americans read USA ×6. The panel is built straight off
   * `game.slots` for that reason, so the countries and the counts answer the
   * same question and the header over them ("Countries fielded") is literally
   * true of both.
   *
   * The lifetime figure is the trophy case's job and is a different number
   * about a different subject: across a career USA ×24 is a fact about the
   * collection, and printed here — inches under a nine-man roster — it reads as
   * a claim about the roster, which is the one thing it is not. The two panels
   * therefore run two builders on purpose. `passportItems` still serves the
   * case, unchanged.
   *
   * The number counts distinct MEN, the same definition the case's number
   * carries, which is why the map holds a Set of player ids rather than a
   * tally. Tonight nobody can appear twice — one seat, one signing — so the
   * Set's size and a counter agree; the Set is what keeps them agreeing if a
   * mode ever lets one man fill two seats.
   *
   * No grayed slots here: the empty half of the board is context for a
   * collection being browsed, and this is a scoreboard.
   *
   * ORDER: biggest count first, and a new country ahead of an equal one. The
   * count is the new information tonight — where this club actually came from —
   * so the country that supplied the most men leads. (The trophy case sorts by
   * rarity instead: that panel is a collection and a collection is read by what
   * is scarce.)
   *
   * Which countries are new is read out of the lifetime passport rather than
   * handed over by the engine, which means it is true the moment this component
   * renders instead of waiting on a field the engine does not write.
   * `recordHistory` runs before the finale is shown, so this game is already in
   * the log: a country on tonight's roster with ONE visit is a country this
   * club is the only record of, which is exactly "never fielded before". A
   * restored finale reads the same, since the row is still there and still the
   * only one.
   *
   * It fails toward celebrating rather than withholding, twice. A history row
   * that never landed — a full or disabled localStorage — leaves the country
   * unknown to the passport, and an unknown country reads as new. And a season
   * played before history rows carried countries at all contributes no visit,
   * so a country first met back then reads as new the next time it appears.
   * Neither is recoverable: the log holds no roster and never has. Both name a
   * real country the club really held, which is the whole content of the
   * chip — only the chip can be generous. Building off the roster is also what
   * retires the orphan branch this used to carry: a country the log has no row
   * for is no longer a country the panel has to rescue, because the panel never
   * asked the log which countries to draw. */
  const clubCountries = $derived.by((): PassportItem[] => {
    const byCountry = new Map<string, Set<string>>();
    for (const s of game.slots) {
      if (!s) continue;
      const bc = typeof s.bc === "string" ? s.bc.trim() : "";
      if (bc === "") continue;
      const men = byCountry.get(bc) ?? new Set<string>();
      men.add(s.id);
      byCountry.set(bc, men);
    }
    const visits = new Map(passport().map((s) => [s.country, s.visits]));
    return [...byCountry]
      .map(([country, men]) => {
        const def = countryDef(country);
        return {
          country,
          flag: def?.flag ?? "",
          rarity: def?.rarity ?? null,
          count: men.size,
          fresh: (visits.get(country) ?? 1) <= 1,
          // No hover detail. The case's tooltip spells out a career — first
          // fielded, players across seasons — and that sentence beside a
          // one-club count is two subjects on one stamp.
          title: null,
        };
      })
      .sort((a, b) => b.count - a.count || Number(b.fresh) - Number(a.fresh));
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
            <!-- The chip's own glyph says which renderer it wants: an award
                 code ("MVP", "CY") is a pill, an emoji run is bare type. Every
                 emoji the ledger can emit is listed here, so a new one — a
                 Classic medal, say — has to be added or it falls through to
                 AwardPill and renders as an unknown award. -->
            {#if c.code.startsWith("💍") || c.code.startsWith("🚩") || c.code.startsWith("⭐") || c.code.startsWith("🌐") || c.code.startsWith("🎌")}
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
           entrance and `delay` deals the row left to right.
           The stagger is a NUMBER rather than a selector or a wrapper, and both
           of those were tried. A `:nth-of-type` rule has to be written out once
           per seat, which stopped working when the row uncapped; a span
           carrying an index broke BadgeSlot outright, because it measures its
           reveal panel against `btnEl.parentElement` and a `display: contents`
           wrapper is a parent with no box to measure. The order is still the
           row's business — the row just hands it over instead of encoding it in
           the DOM. -->
      <BadgeSlot
        badge={b.def}
        animate={!resolved}
        delay={i * BRAG_STEP}
        fresh={b.fresh}
        open={openBrag === b.def.key}
        ontoggle={() => (openBrag = openBrag === b.def.key ? null : b.def.key)}
      />
    {/each}
  </div>
{/if}

{#if clubCountries.length > 0}
  <!-- Directly under the badges, unlabelled and in the same column, because it
       is the same kind of object: what this season turned up that is worth
       keeping. A stamp is already legibly a stamp — small, square-cornered,
       flag-led — where the badges above it are capsules, so the shape does the
       work a "PASSPORT" header used to do and the row costs no vertical rhythm
       to introduce.
       It sat beside the roster for one round, on the reasoning that a birth
       country belongs to the men listed there. True, and beside the point: next
       to eight seats a row of flags reads as a ninth fact about the club rather
       than as a souvenir of it. Here it closes the payoff stack — record,
       badges, stamps — and is the last thing read before the exits.
       Nothing renders at all for a club whose seats carry no country — every
       save written before the field existed, and every restored finale older
       than it. -->
  <!-- `disp` because Passport sets no font of its own — it inherits, so the
       same stamp renders in Nunito inside the trophy sheet and would have
       dropped to system sans out here the moment it left the `.squad disp`
       block it used to sit in. -->
  <div class="clubpass disp">
    <Passport stamps={clubCountries} label="Countries fielded" />
  </div>
{/if}

<!-- All-caps, like every other action in the game. These three read Title Case
     while HOME's own row two taps away read PLAY / LAST GAME / PLAY A SEED,
     which made one control look like two.
     RUN IT BACK, not "Replay". The button starts a NEW season in the same mode
     on a fresh seed — it does not replay anything, and "replay" is the exact
     word for what the seed chip below it actually does. It is also the widest
     of the three labels, which is why the row pins `white-space` below. -->
<div class="btnrow fin-actions">
  <button class="btn ghost disp" onclick={onmodes}>MODES <span class="bic">🕹️</span></button>
  <button class="btn disp" onclick={onreplay}>RUN IT BACK <span class="bic">🔄</span></button>
  <button class="btn hot disp" onclick={share}>
    {#if shareState === "idle"}SHARE <span class="bic">📣</span>{:else if shareState === "copied"}COPIED <span
        class="bic">🔥</span
      >{:else}COPY FAILED{/if}
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
      <div class="qrow war-{warTier(slot.war)}">
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
            <!-- March's medal beside October's, and INDEPENDENT of it: the
                 Classic is played in the spring of the same card season, so one
                 man can wear a ring and a medal both (2017 Alex Bregman did).
                 🌐 champion, 🎌 finalist — the globe for the tournament that
                 puts the whole world in one bracket, the crossed flags for the
                 side that got there and lost. Not 🥇/🥈: those are the glyphs
                 inside the MVP and CY award pills sitting on this very row, and
                 a bare medal next to them reads as a pill that failed to
                 render. Until now the medal was worth points on the ledger and
                 had no mark on the man who won it.
                 YOUR SQUAD only. The dream team's rows below cannot carry one:
                 `BestPick` has no `wbc` field, so the solver's club knows
                 nothing about medals — a gap in bestroster.ts, not something
                 this component can answer. -->
            {#if slot.wbc === WBC_CHAMPION_POINTS}<span class="emo">🌐</span>{:else if slot.wbc === WBC_RUNNERUP_POINTS}<span
                class="emo">🎌</span
              >{/if}
          </span>
        </span>
        <span class="qwar">{slot.war.toFixed(1)}</span>
      </div>
    {/if}
  {/each}
  {#if game.manager}
    <div class="qrow war-{warTier(fin.parts.managerWins)}">
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
  <!-- The payroll this club ran, closing the list. A footer, not a header: the
       seats are what the player came to see, and the front office is the
       envelope they were bought inside. fin.spend and fin.budget are required
       fields, so this renders on a finale of any age. -->
  {@render payroll(myFront, fin.budget, fin.spend)}
</div>

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
    <!-- What the two treatments mean, said once. An uncaptioned visual
         distinction is a puzzle; four words is the whole explanation.
         No pronoun and no sentence: `tests/finale-ceiling` holds this block to
         saying nothing ABOUT itself — no tagline, no near-miss callout, no
         consolation — and a legend has to read as a key rather than as the
         beginning of one. -->
    <div class="dtkey">TINTED = SIGNED · PLAIN = UNSIGNED</div>
    <!-- DRAFTED vs NOT, and app.css's rung rule already draws it — no new
         device, and specifically not a dashed border, which is the ARMED
         channel every tappable seat in the game spends. A season the player
         actually signed is COMMITTED, so it wears its rung as fill and frame
         the way YOUR SQUAD's rows above do. A season they never had was never
         committed to anything, so it gets the market treatment: white cardstock
         in --line with its WAR moved out onto a .warchip. That is the same pair
         of surfaces the draft screen ran all game — the club you own is tinted,
         the men you are still choosing between are chips in a column — so the
         dream team reads as "here is what you took and here is what was on the
         board" without teaching anything new.
         The ⭐ stays. It marks the same seats, and it is the mark the scouting
         ledger row counts, so removing it would leave that row pointing at
         nothing. -->
    {#each fin.best.picks as pick, i}
      {@const mine =
        pick != null &&
        game.slots.some((s) => s && s.id === pick.id && s.year === pick.year && s.team === pick.team)}
      <div class="qrow {pick && mine ? `war-${warTier(pick.war)}` : ''}">
        <span class="qpos">{slotLabel(SLOT_TYPES[i])}</span>
        {#if pick}
          <!-- Awards show WHY the solver chose this season — they count in
               its objective now, not just WAR. -->
          <span class="qmid">
            <span class="qname"
              >{#if mine}<span class="emo qstar">⭐</span>{/if}{pick.name}
              <i>{pick.year} {pick.team}</i></span
            >
            <span class="qbadges">
              {#each sortAwards(pick.awards) as a}
                <AwardPill code={a} />
              {/each}
              {#if pick.ws}<span class="emo">💍</span>{:else if pick.pen}<span class="emo">🚩</span>{/if}{#if pick.wbc === WBC_CHAMPION_POINTS}<span
                  class="emo">🌐</span
                >{:else if pick.wbc === WBC_RUNNERUP_POINTS}<span class="emo">🎌</span>{/if}
            </span>
          </span>
          {#if mine}
            <span class="qwar">{pick.war.toFixed(1)}</span>
          {:else}
            <span class="warchip {warTier(pick.war)}">{pick.war.toFixed(1)}</span>
          {/if}
        {:else}
          <span class="qname empty">—</span>
        {/if}
      </div>
    {/each}
    {#if fin.bestManager}
      {@const bestWins = fin.bestManager.netWins * MANAGER_PER_NET_WIN}
      <div class="qrow war-{warTier(bestWins)}">
        <span class="qpos">MGR</span>
        <span class="qmid">
          <span class="qname"
            >{#if fin.managerHit}<span class="emo qstar">⭐</span>{/if}{fin.bestManager.name}
            <i>{fin.bestManager.year} {fin.bestManager.team}</i></span
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
        <span class="qwar">{signed(bestWins)} W</span>
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
    border: 2.5px solid var(--line);
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
    color: var(--record-elite);
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
  /* Cells and glyph come from the shared `.btnrow` in app.css; only the column
     count, the moat above it and the phone's label fit are this row's own.
     THE MOAT STAYS 28px, because it is doing the same job it always was: the
     stamp (and any brags) is the payoff moment and the buttons are the next
     scene, and with nothing between them the gap is the whole separation. A
     finale whose seats carry no birth country — every save written before the
     field existed — renders no passport at all, and that finale is exactly the
     one the 28 was measured for.
     This block lives BELOW the wide-layout rule, so the ≥760px moat must carry
     its own media query to win. */
  .fin-actions {
    grid-template-columns: 1fr 1fr 1fr;
    margin-top: 28px;
  }
  /* WITH the passport in the gap, half that. The separation is now an object
     rather than a distance, so the air on both sides of it can match: 8px
     above the stamps, 14px below. Adjacent siblings, so the two margins
     COLLAPSE — `.clubpass` sets `margin-bottom: 14px` and neither box has a
     border, padding or a formatting context between them, so the pair resolves
     to the larger rather than their sum. Leaving 28 here would win that
     collapse and re-open the moat the passport was put there to close.
     The adjacent-sibling selector is what keeps the two cases apart: no
     passport, no override, and the 28 above still stands. */
  .clubpass + .fin-actions {
    margin-top: 14px;
  }
  /* ONE LINE, ALWAYS. A wrapped label stands the row up to 58px — 78px at
     320px, where it breaks three ways — and the row's job is three equal 48px
     cells at one baseline.
     `1fr` is `minmax(auto, 1fr)`, so each track is floored at its MIN-CONTENT:
     three tracks that do not fit overflow the row rather than shrinking, which
     is why the fit has to be arithmetic rather than a hope.
     THE PHONE BUYS THE FIT OUT OF THE CELL'S OWN PADDING, not out of the
     glyph. Stock `.btnrow` cells are 8px of side padding on a 9px gap, and at
     13px with the glyph that is 352px of demand against a 332px column at a
     360px screen (the viewport less 28px of `#app` padding). Trimming to 3px
     and 6px returns 36px — demand 316px, and the row closes with 16px spare.
     A button 48px tall and ~90px wide is nowhere near its touch minimum, so
     the padding is the cheapest thing in the row to spend; the glyph is not,
     because `.btnrow` in app.css exists to keep the finale's row and HOME's
     one control in two places and the glyph is half of what makes them look
     it.
     Sized for the WIDEST label, so the row is stable under the rename: RUN IT
     BACK measures 90.2px in the bundled Nunito at 13px/0.04em against PLAY
     AGAIN's 85.8px. The 4.4px is inside the 16px of headroom, which is the
     whole point of measuring — the old row had none and was wrapping at every
     phone width already. */
  .fin-actions .btn {
    white-space: nowrap;
  }
  @media (max-width: 759px) {
    .fin-actions {
      gap: 6px;
    }
    .fin-actions .btn {
      padding-left: 3px;
      padding-right: 3px;
    }
  }
  /* The breakpoint `.bic` already steps its glyph down at, and the label steps
     with it. The narrow phone is the one width the trimmed padding alone does
     not close: 292px of column against 307px of demand at 13px. 11.5px brings
     it to 285px and the row fits with 7px spare — the smaller `.bic` (15px,
     from app.css) is already counted in that.
     11.5 rather than 12 because 12 lands on 292.7px against a 292px column —
     a 0.7px miss is a miss, and one that would come back the moment a font
     fell back or a device rounded the other way. */
  @media (max-width: 359px) {
    .fin-actions .btn {
      font-size: 11.5px;
    }
  }
  @media (min-width: 760px) {
    /* The score column has spare height beside the rosters — a wider moat.
       Both selectors, and the compound one is why: `.clubpass + .fin-actions`
       is (0,2,0) against this rule's (0,1,0), so a bare `.fin-actions` here
       would LOSE to the phone override on every wide screen that renders a
       passport — media queries carry no specificity of their own. Matching the
       compound is what makes the wide layout win it back. */
    .fin-actions,
    .clubpass + .fin-actions {
      margin-top: 48px;
    }
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
    border: 2.5px solid var(--line);
    border-radius: 10px;
    padding: 5px 9px;
    margin-bottom: 6px;
  }
  /* --muted-2 rather than --muted, on both sub-lines: these sit on whichever
     of six washes the row's rung supplies rather than on card white, and
     violet-2 is the darkest of them — --muted measures 3.39:1 there against
     4.37:1 for --muted-2. One token, chosen for the worst rung, so the line
     reads the same on all six. */
  .qpos {
    width: 36px;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--muted-2);
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
    color: var(--muted-2);
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
  /* Ink, on every row, because every row is now tinted. app.css's rule for
     type on a rung-2 fill is ink and this is that rule rather than one about
     these rows: the worst pair measures 9.52:1 and the best 13.41:1, where a
     numeral tinted to match its own fill runs 2.17:1 to 3.77:1 at 13px. The
     rung is said twice already, by the fill and by the frame; the numeral's
     job is the number. */
  .qwar {
    margin-left: auto;
    font-weight: 800;
    font-size: 13px;
    color: var(--ink);
    flex: none;
  }
  /* EVERY seat wears the rung it earned, fill and frame together — the hue at
     rung 2 inside the hue at rung 8, the pair every WAR chip in the game has
     been teaching, and the same tokens `RosterRail` paints its chairs with. So
     the board and the finale describe one club the same way instead of two.
     Both lists, both skippers: a row is a row.
     This used to be the skipper's row alone, on the reasoning that eight
     tinted rows would be eight competing fills. What that actually produced was
     one row shouting on a page of white ones — and because the mid rung IS
     green, a +2.6 W skipper read as a highlight rather than as a rung. Tinting
     all of them turns the column into the ladder it was always describing: the
     eye reads gold-gold-violet-blue down the edge and the club's shape is
     legible before a single number is. */
  .qrow.war-neg {
    background: var(--war-neg-fill);
    border-color: var(--war-neg);
  }
  .qrow.war-low {
    background: var(--war-low-fill);
    border-color: var(--war-low);
  }
  .qrow.war-mid {
    background: var(--war-mid-fill);
    border-color: var(--war-mid);
  }
  .qrow.war-high {
    background: var(--war-high-fill);
    border-color: var(--war-high);
  }
  .qrow.war-star {
    background: var(--war-star-fill);
    border-color: var(--war-star);
  }
  .qrow.war-elite {
    background: var(--war-elite-fill);
    border-color: var(--war-elite);
  }
  /* Tucked to the badge row above it rather than spaced as a section of its
     own — same column, same idea, one beat apart. The bottom margin is the
     gap to the actions; it collapses against theirs, and both are 14 so the
     one that wins is the one that was intended.
     No `overflow`, no `position`, no `transform`, and deliberately none: a
     stamp's open panel is absolutely positioned, and any of the three here
     would clip it, re-origin it, or trap it. It needs nothing from this box
     either — `Passport` sets `position: relative` on the stamp row itself, so
     the panel's containing block and its horizontal fence are both inside the
     component that draws it, the way `.brags` above does for BadgeSlot. */
  .clubpass {
    margin: 8px 0 14px;
  }
  /* What the dream team's two row treatments mean. It reads as a caption
     rather than as a rule of the game, so it takes the ceiling's own quiet
     small-caps rather than a psep of its own — the header two lines up already
     said what the block is. */
  .dtkey {
    margin: 0 0 8px;
    text-align: center;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--muted);
  }
  /* An unsigned dream seat's WAR, in the market's own chip. `.qwar` is the
     committed rows' numeral and this is the other half of the same pair, so it
     is a different element rather than the same one reclassed: the chip's
     26.275px height and 13.5px type are measured in app.css and `.qwar`'s
     scoped 13px would out-specify them and quietly undo that.
     `flex: none` because the row is a flex line — the chip's 42px minimum
     would otherwise be shrunk away by a long name beside it. */
  .qrow .warchip {
    margin-left: auto;
    flex: none;
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

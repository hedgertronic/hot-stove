<script lang="ts">
  import { track } from "../lib/analytics";
  import { bragRow } from "../lib/badges";
  import { balancewrap } from "../lib/balancewrap";
  import { wrapnudge } from "../lib/wrapnudge";
  import { ownerFor } from "../lib/data";
  import { SLOT_TYPES, type Game } from "../lib/engine.svelte";
  import { costTier, lastName, money, recordFromTotal, seedCode, signed, slotLabel, sortAwards, statValue, warTier, type WarTier } from "../lib/format";
  import {
    GAMES,
    MANAGER_PER_NET_WIN,
    MARINERS_WINS,
    WBC_CHAMPION_ID,
    WBC_RUNNERUP_ID,
  } from "../lib/scoring";
  import { shareText as shareResult } from "../lib/share";
  import { countryDef, loadCues, markFinaleTourSeen, passport, type PassportItem } from "../lib/settings";
  import AwardPill from "./AwardPill.svelte";
  import BadgeSlot from "./BadgeSlot.svelte";
  import Passport from "./Passport.svelte";
  import FinaleInstructs from "./FinaleInstructs.svelte";
  import PayrollBox, { FIXED_CAP_CLUB } from "./PayrollBox.svelte";

  let {
    game,
    onreplay,
    onmodes,
    resolved = false,
    replay = false,
    tourPing = 0,
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
    /** This finale is someone else's season, rebuilt from a shared game code
     * rather than played here. RUN IT BACK and MODES are meaningless on it —
     * one starts a fresh game in a mode the viewer did not choose, the other
     * walks out of a screen they walked into from home — so the row collapses
     * to one way back. Everything that reads or shares the season stays: it is
     * a finale, and the whole point of the code was to be looked at. */
    replay?: boolean;
    /** Bumped by the help sheet's REPLAY INSTRUCTS: each bump opens the
     * finale tour on demand, PAST the finaleTourSeen cue — an explicit
     * request outranks "already seen". The cue itself is never cleared. */
    tourPing?: number;
  } = $props();

  const fin = $derived(game.finale!);

  const reduced =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** THE EMPTY SHELF, drawn once for all three trophy rows.
   *
   * Round nine replaced the pedigree row's phrase "nothing won" with a single
   * cobweb on the argument that every POPULATED state of that row is pure
   * emoji, so its empty state should speak the same language. The argument was
   * never specific to rings: the trophy case deals award pills and the
   * scouting report deals ⭐s, and both were still answering in sentences —
   * "no award seasons", "none found" — so one finale could show three empty
   * shelves in two different vocabularies, and a player reading down the
   * ledger had to work out that the words and the glyph meant the same thing.
   *
   * Each row decides for ITSELF, so the three can never disagree about how an
   * empty shelf looks: a club with rings but no hardware shows 💍 on one line
   * and 🕸️ on the next, which is the honest picture of that season.
   *
   * A glyph also cannot ellipsize at 320px the way "no rings, no pennants, no
   * medals" did, and it carries no cap band — hence `bare`, which keeps the
   * cap trim off it (see the `.why` markup below). */
  const COBWEB = { why: "🕸️", bare: true } as const;

  interface LedgerRow {
    key: string;
    lbl: string;
    /** Small muted text beside the label (after any chips/meter). */
    why?: string;
    /** `why` is a bare glyph, not type: it has no cap band for the trim to
     * measure, so it renders without `.chiplbl`. Set by `COBWEB` alone. */
    bare?: boolean;
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
    // One budget row, three faces: over cap the row IS the luxury tax;
    // at/under it's the front-office swing, named by its sign — a negative
    // swing (spend below half the cap, budgetBonus's zero crossing) reads
    // "Payroll penalty", break-even and up reads "Payroll bonus". The tax and
    // the swing are mutually exclusive by construction (the swing is 0
    // whenever spend exceeds budget).
    const overCap = fin.spend > fin.budget;
    const spendPct = fin.budget > 0 ? (fin.spend / fin.budget) * 100 : 100;
    out.push({
      key: "budget",
      lbl: overCap ? "Luxury tax" : p.budgetBonus < 0 ? "Payroll penalty" : "Payroll bonus",
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
      ...(hardwareChips.length > 0 ? {} : COBWEB),
      chips: hardwareChips.length > 0 ? hardwareChips : undefined,
      amt: signed(p.awardPoints, 0),
      cls: p.awardPoints > 0 ? "plus" : "zero",
    });
    const { rings, pennants, wbcChampions, wbcRunnersUp } = game.pedigree;
    // One emoji per honour the club's seasons won — 💍💍🚩🥇 reads as the
    // actual trophy case. October's rings and pennants and March's Classic
    // medals share this row because they share this ledger line, so the glyph
    // count is all four and so is the fallback's threshold: past 8 emojis (a
    // stacked-pedigree outlier) the row would overflow its single line, so it
    // falls back to the ×N form.
    const pedigreeChips: { code: string; n: number }[] = [];
    if (rings + pennants + wbcChampions + wbcRunnersUp > 8) {
      if (rings) pedigreeChips.push({ code: "💍", n: rings });
      if (pennants) pedigreeChips.push({ code: "🚩", n: pennants });
      if (wbcChampions) pedigreeChips.push({ code: "🥇", n: wbcChampions });
      if (wbcRunnersUp) pedigreeChips.push({ code: "🥈", n: wbcRunnersUp });
    } else {
      // One chip for the whole run: separate chips per honour put .chipline's
      // 3px flex gap at each honour boundary, so 💍💍ᐧ🥇 spaced wider than
      // 💍💍 sat together and the medals looked detached from the rings.
      // The medals sit a touch airier than the rings — that is Apple's own
      // glyph cell (measured 2026-08-10: medals carry ~0.17em of drawn-in
      // side air where rings and pennants carry ~0.03em), and the run keeps
      // the font's spacing the way every other emoji in the app does
      // (owner call, same day: no kerning against the platform face).
      const run =
        "💍".repeat(rings) + "🚩".repeat(pennants) + "🥇".repeat(wbcChampions) + "🥈".repeat(wbcRunnersUp);
      if (run) pedigreeChips.push({ code: run, n: 1 });
    }
    out.push({
      key: "pedigree",
      lbl: "Ring chasing",
      // The row the cobweb started on; the reasoning now lives on COBWEB
      // itself, where the other two trophy rows can read it.
      ...(pedigreeChips.length > 0 ? {} : COBWEB),
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
        ...(fin.scoutHits > 0 ? {} : COBWEB),
        // Whole points, whole figure: a find is worth SCOUT_HIT_POINTS, which
        // is 1, so this row prints integers the way the ring row above does —
        // "+4", never "+4.0".
        amt: signed(p.scoutBonus, 0),
        cls: p.scoutBonus > 0 ? "plus" : "zero",
      });
    }
    return out;
  });

  /* THE FINALE'S OWN INSTRUCTS, first finale only. Held until passShown —
   * the reveal's last beat — so the tour never dims a ledger mid-deal, plus
   * one settled beat so the passport stamps finish thunking in. The cue is
   * read at mount-decision time (not module load): a second finale in the
   * same session must see the first one's mark. */
  let finaleTour = $state(false);
  $effect(() => {
    if (!passShown || finaleTour || loadCues().finaleTourSeen) return;
    const t = setTimeout(() => (finaleTour = true), reduced || resolved ? 0 : 900);
    return () => clearTimeout(t);
  });
  /* The replay request: the help sheet's button bumps tourPing and the tour
   * opens immediately, seen-cue or not. Tracked against the value seen at
   * MOUNT, not against zero: the App-level counter outlives this component,
   * so a later finale (next season, a reopened archive) mounts with the old
   * bumps still in it — and a stale ping must not open a tour nobody asked
   * for, or dim a ledger that is still dealing (Sol review, 2026-08-10). */
  // svelte-ignore state_referenced_locally -- the mount-time value IS the point
  let seenPing = tourPing;
  $effect(() => {
    if (tourPing > seenPing) {
      seenPing = tourPing;
      finaleTour = true;
    }
  });

  let shownRows = $state(0);
  let dispWins = $state(0);
  let dispRecW = $state(0);
  let dispRecL = $state(0);
  let dispTotal = $state("0");
  let totalShown = $state(false);
  let bragsShown = $state(false);
  let passShown = $state(false);
  /** The dream team, held back until the record exists to read it against. */
  let dreamShown = $state(false);

  /** Record + tier come from the shared ladder (lib/format.recordFromTotal)
   * so the home record book resolves totals identically. PERFECT SEASON stays
   * keyed to the exact total, not the capped record. */
  const rec = $derived(recordFromTotal(fin.parts.total, GAMES, MARINERS_WINS));
  const recWins = $derived(rec.wins);
  const recLosses = $derived(rec.losses);
  const recTier = $derived(rec.tier);

  /** Each tier's -2 wash token: the same six-rung palette the WAR chips and the
   * record stamp use, re-purposed as a foreshadow tint on the scorecard rows.
   * One map, driven by recTier — the stamp already owns that value, and a second
   * derivation of the breakpoints is a second source of truth waiting to drift.
   * Gray has no standard -2 token; --gray-bg is the warm near-parchment that
   * stands in for it across the whole app. */
  const TIER_WASH: Record<WarTier, string> = {
    neg:   "var(--red-2)",
    low:   "var(--gray-bg)",
    mid:   "var(--green-2)",
    high:  "var(--blue-2)",
    star:  "var(--violet-2)",
    elite: "var(--gold-2)",
  };
  const lrowFore = $derived(TIER_WASH[recTier]);
  /* The wash's paired line — the same tier's saturated rung off the war
   * ladder, the fill/line relationship every washed surface wears (war chips,
   * team tiles, the dream team's signed rows). */
  const lrowLine = $derived(`var(--war-${recTier})`);

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

  /* Five beats: rows deal out on a steady cadence, a held pause before the
   * total stamp lands (with its count-up and confetti), the brag pills thunk in
   * once the number has settled — and the dream team comes in beside them, in
   * the other column, on the same cue — then the passport closes the stack once
   * the last pill has landed.
   *
   * The dream team is the one beat that exists to WITHHOLD rather than to pace.
   * It is the ceiling: the best club the player could have signed, and reading
   * it while the ledger is still dealing gives away the verdict before the
   * season that earned it. Its only hard requirement is "not before the stamp",
   * which the badges' cue satisfies with a beat to spare.
   *
   * The order is the payoff read in the order it was earned — the record, then
   * what the record won, then where the club that won it came from — and every
   * beat waits for the one before it to FINISH rather than firing on a fixed
   * clock: the badge row deals left to right at BRAG_STEP a pill, so the
   * passport's cue is measured off the last pill, not off the first.
   *
   * Two states skip all five and render the finished screen: a player who has
   * asked for reduced motion, and a finale restored from storage, which has
   * already been watched once. Both want the same thing — every row shown, the
   * stamp up, the counters at their final values, the brag pills, the dream
   * team and the passport visible, and no confetti — so both take one branch,
   * and it returns
   * before a single timer is created, which is why there is nothing to clean
   * up. */
  // Re-asserts App.svelte's phase-flip scroll from AFTER this DOM has
  // replaced the game's: the flip's own scrollTo can land while the taller
  // game page is still mounted, and some mobile browsers then re-anchor
  // mid-page. The document is the scroller (see the .brail note below), so
  // window scroll is the whole reset. No reactive reads — runs once on mount.
  $effect(() => {
    // Smooth for App's reason (its phase-flip effect): the two scrolls fire
    // around the same DOM swap, and an instant snap here would override the
    // glide the flip just started. Same reduced-motion carve-out.
    const glide =
      typeof matchMedia === "function" &&
      !matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: glide ? "smooth" : "auto" });
  });

  $effect(() => {
    if (reduced || resolved) {
      dispWins = fin.parts.expectedWins;
      shownRows = rows.length;
      totalShown = true;
      bragsShown = true;
      passShown = true;
      dreamShown = true;
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
        // Confetti is a cheer, and a cheer that fires on most finales is
        // wallpaper. The stamped record is the thing the pop celebrates, so
        // the stamp decides — and only its top rung earns the burst: the
        // gold (elite, 155+) stamp. Everything below lands in the quiet
        // company of its own tier color.
        if (recTier === "elite") void confettiPop();
      }, totalAt),
    );
    // Brags wait for the count-up to settle — they annotate the final number.
    const bragsAt = totalAt + 1000;
    timers.push(setTimeout(() => (bragsShown = true), bragsAt));
    // The dream team rides the badges' cue exactly, in the other column. It is
    // a WITHHELD beat rather than a paced one: the ceiling read beside a ledger
    // still dealing tells the player how the season ends before the season
    // does, so the only requirement is "after the stamp", and the badges are
    // already the beat that annotates the stamp.
    timers.push(setTimeout(() => (dreamShown = true), bragsAt));
    // The stamps land one held beat after the LAST brag pill has FINISHED its
    // 0.45s thunk-in (BadgePill's own animation, which starts after the pill's
    // (i × BRAG_STEP) delay) — the same 350ms hold the stamp takes after the
    // ledger, so the pause before each payoff is the same pause. Counting pill
    // STARTS instead of finishes shaved the hold to ~20ms. A club that earned
    // no badges follows the stamp by hold + thunk; close enough to one beat
    // that the arithmetic needs no special case for it.
    const lastBragDone = Math.max(0, brags.length - 1) * BRAG_STEP * 1000 + 450;
    timers.push(setTimeout(() => (passShown = true), bragsAt + lastBragDone + 350));
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

  /** Copies the whole decision log prefixed with `@` — the @ is the game-code
   * sigil, telling the home entry to route the paste straight to replay rather
   * than testing it for seed shape. Prefix added here so game.debugLog() stays
   * unprefixed and `window.__hotstove.debugLog()` pastes the same way. Read off
   * the game itself rather than storage, so a season reopened out of the archive
   * hands over ITS code and not the last one played. Label swaps in place — no
   * toast, no layout shift. */
  let gameState = $state<"idle" | "copied" | "failed">("idle");
  let gameTimer: ReturnType<typeof setTimeout> | undefined;
  async function copyGame() {
    try {
      await navigator.clipboard.writeText(`@${game.debugLog()}`);
      gameState = "copied";
    } catch {
      gameState = "failed";
    }
    clearTimeout(gameTimer);
    gameTimer = setTimeout(() => (gameState = "idle"), 1200);
  }
  /** The seed alone, #-prefixed — the string the home entry deals a fresh
   * counting game from, beside the game code's read-only replay. */
  let seedState = $state<"idle" | "copied" | "failed">("idle");
  let seedTimer: ReturnType<typeof setTimeout> | undefined;
  async function copySeed() {
    try {
      await navigator.clipboard.writeText(`#${seedCode(game.seed)}`);
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
   * The caption prints the dream club's OWN score and derives its record from
   * it through the same lib/format.recordFromTotal the stamp above is built
   * from, so the two records sit on one ladder by construction. Every source
   * field is optional: a finale restored from a save written before the
   * ceiling existed has no answer, and "no ceiling known" renders nothing at
   * all rather than a hole. */
  const ceilTotal = $derived(fin.bestPossibleTotal ?? null);
  /** The solver's own UNCLAMPED total. `bestPossibleTotal` is floored at the
   * club the player actually built, so the two differ exactly when the search
   * lost to a real line — ✌️ Double Play and repeat landings are modeled, so
   * what remains is 🏠 Homegrown (unmodeled on purpose, so the badge stays
   * earnable) and the search's own shortlist gap — and in that case the dream
   * club listed below genuinely scores less than the ceiling. Absent on old
   * saves and on fixtures that predate the field. */
  const solved = $derived(fin.best?.total ?? null);
  /** What the caption prints: the SOLVED total when the finale carries one —
   * the club actually listed beneath it — falling back to the stored ceiling
   * for finales saved before the field existed. The engine's
   * `bestPossibleTotal` is floored at the player's own total, so on a season
   * that beat the search it names the wrong club; the caption's one job is to
   * be true of the roster it sits on. Showing the dream club's real record
   * even when the player's beats it is the point — 🦉 OUTSCOUTED is a claim
   * about exactly this number, and a suppressed record made the badge read as
   * a bug. */
  const capTotal = $derived(solved ?? ceilTotal);
  const capRec = $derived(
    capTotal === null ? null : recordFromTotal(capTotal, GAMES, MARINERS_WINS),
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
<div class="psep">THE SCORECARD</div>
<div class="ledger" style="--fore: {lrowFore}; --fline: {lrowLine}">
  {#each rows as row, i (row.key)}
    <div class="lrow disp" class:show={i < shownRows}>
      <!-- The label and amount wear .chiplbl so the trim branch seats their
           cap bands on the row's geometric middle — the same axis the emoji
           chips (💍/⭐, centered by their pinned chipbox) already sit on.
           Untrimmed, the type rode Nunito's 0.0235em cap-high line-box seat
           (~0.3–0.4px at these sizes) and read as the emojis hanging low
           beside it. `.why` wears the trim too when it carries type (the
           baseline formula visibly floated above the trimmed label without
           it) and stays bare for the 🕸️ cobweb, which has no cap band for the
           trim to measure. The bare-ness rides `row.bare` — a flag COBWEB
           sets — rather than a string comparison against the glyph, so the
           three trophy rows that now share it cannot fall out of step with
           whatever the glyph happens to be. -->
      <span class="lbl chiplbl">{row.lbl}</span>
      {#if row.chips}
        <span class="chipline">
          {#each row.chips as c (c.code)}
            <!-- The chip's own glyph says which renderer it wants: an award
                 code ("MVP", "CY") is a pill, an emoji run is bare type. Every
                 emoji the ledger can emit is listed here, so a new one — a
                 Classic medal, say — has to be added or it falls through to
                 AwardPill and renders as an unknown award. -->
            {#if c.code.startsWith("💍") || c.code.startsWith("🚩") || c.code.startsWith("⭐") || c.code.startsWith("🥇") || c.code.startsWith("🥈")}
              <span class="chipbox pedchip"
                ><span class="erun">{c.code}</span>{#if c.n > 1}<span class="mult chiplbl">×{c.n}</span>{/if}</span
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
        <span class="why" class:chiplbl={!row.bare}>{row.why}</span>
      {/if}
      <!-- The base row shows the animated wins count-up as its amount; every
           other row's amount is the precomputed string. -->
      <span class="amt chiplbl" class:plus={row.cls === "plus"} class:minus={row.cls === "minus"}
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

{#if brags.length > 0 || clubCountries.length > 0}
  <!-- badge-strip: shared flex row for badge pills and passport stamps.
       .brags holds badge BadgeSlots (conditional on beat); .clubpass holds
       Passport's .stamps via display:contents so .stamps becomes a flex item
       of this row. visibility:hidden on .clubpass gates stamps before their
       beat — visibility IS inherited through display:contents, unlike opacity,
       which is why the old opacity:0 let stamp animations run silently. -->
  <!-- balancewrap: the trophy case's even-count wrapping, so the ceremony
       row never deals two full lines and a one-chip orphan. Keyed on the
       beats that add chips to the strip (brags mount at their beat; stamps
       hold space from the first frame). -->
  <div class="badge-strip" use:balancewrap={`${bragsShown ? brags.length : 0}|${clubCountries.length}`}>
    {#if bragsShown && brags.length > 0}
      <div class="brags">
        {#each brags as b, i (b.def.key)}
          <!-- The pill and the tap-to-explain are BadgeSlot's, shared with the
               home trophy case. `animate` asks for the thunk-in entrance and
               `delay` deals the row left to right.
               The stagger is a NUMBER rather than a selector or a wrapper — a
               `:nth-of-type` rule has to be written out once per seat; a span
               carrying an index broke BadgeSlot because it measures its reveal
               panel against `btnEl.parentElement` and a `display: contents`
               wrapper has no box to measure. -->
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
      <!-- `disp` because Passport sets no font of its own.
           MOUNTED FROM THE FIRST FRAME — display:contents on .clubpass makes
           .stamps a direct flex item of .badge-strip, so it reserves its space
           and flows inline with the badges from the start. visibility:hidden
           holds it invisible before the passport beat; .show flips it visible.
           `animate` waits for passShown: applied at the beat the stamps deal
           left to right; applied at mount they would finish inside the first
           second and the row would appear already settled. -->
      <div class="clubpass disp" class:show={passShown}>
        <Passport
          stamps={clubCountries}
          label="Countries fielded"
          animate={!resolved && passShown}
          step={BRAG_STEP}
        />
      </div>
    {/if}
  </div>
{/if}

<!-- All-caps, like every other action in the game. These three read Title Case
     while HOME's own row two taps away read PLAY / LAST GAME / PLAY A SEED,
     which made one control look like two.
     RUN IT BACK, not "Replay". The button starts a NEW season in the same mode
     on a fresh seed — it does not replay anything, and "replay" is the exact
     word for what the seed chip below it actually does. It is also the widest
     of the three labels, which is why the row pins `white-space` below.
     Each label rides in a `.chiplbl`, like PLAY's on the home screen: the
     cells are flex boxes, so a bare label is an anonymous flex item the cap
     trim cannot reach (app.css's chipbox doctrine), and wrapped it is a block
     container the trim seats on center. The glyphs stay bare flex items —
     no cap band, centered by the box alone. -->
<div class="btnrow fin-actions">
  {#if replay}
    <button class="btn ghost disp" onclick={onmodes}
      ><span class="chiplbl">BACK</span> <span class="bic">↩️</span></button
    >
  {:else}
    <button class="btn ghost disp" onclick={onmodes}
      ><span class="chiplbl">MODES</span> <span class="bic">🕹️</span></button
    >
    <button class="btn disp" onclick={onreplay}
      ><span class="chiplbl">RUN IT BACK</span> <span class="bic">🔄</span></button
    >
  {/if}
  <button class="btn hot disp" onclick={share}>
    {#if shareState === "idle"}<span class="chiplbl">SHARE</span> <span class="bic">📣</span
      >{:else if shareState === "copied"}<span class="chiplbl">COPIED</span> <span class="bic">🔥</span
      >{:else}<span class="chiplbl">COPY FAILED</span>{/if}
  </button>
</div>

<!-- The two codes a season answers to, told apart by sigil. SEED # copies the
     bare seed — the home entry deals a fresh counting game from it. GAME @
     shows the same 7 chars as a short id and copies the FULL game code with
     its @ prefix (never printed — 50–70 characters), which the home entry
     replays read-only. Labels swap in place as feedback. -->
<div class="codes">
  <button
    class="seedchip disp"
    class:ok={seedState === "copied"}
    title="Copy the seed code for these cards"
    aria-label="Copy the seed code for these cards"
    onclick={copySeed}
  >
    {seedState === "idle" ? `SEED #${seedCode(game.seed)}` : seedState === "copied" ? "COPIED ✓" : "COPY FAILED"}
  </button>
  <button
    class="seedchip disp"
    class:ok={gameState === "copied"}
    title="Copy the full game code: replays this exact season"
    aria-label="Copy the full game code: replays this exact season"
    onclick={copyGame}
  >
    {gameState === "idle" ? `GAME @${seedCode(game.seed)}` : gameState === "copied" ? "COPIED ✓" : "COPY FAILED"}
  </button>
</div>
</div>

<div class="fin-side">
<div class="squad disp">
  <div class="psep">YOUR SQUAD</div>
  {#if game.manager}
    <div class="qrow">
      <span class="qpos">MGR</span>
      <span class="qmid" use:wrapnudge={2.6}>
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
      <!-- Bare like the rail's MGR chip: no room for a WINS unit in the
           chip's small cut, positive drops the plus the way WAR does, and a
           negative keeps the minus that says the bench cost wins. -->
      <span class="warchip sm {warTier(fin.parts.managerWins)}">{statValue(fin.parts.managerWins)}</span>
    </div>
  {/if}
  {#each game.slots as slot, i}
    {#if slot}
      <div class="qrow">
        <span class="qpos">{slotLabel(SLOT_TYPES[i])}</span>
        <span class="qmid" use:wrapnudge={2.6}>
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
                 🥇 champion, 🥈 finalist — medal glyphs that read as WBC
                 hardware at a glance. The dream team's rows below wear the
                 same pair off `pick.wbc` — the solver carries, prices and
                 scores medals the way it does rings. -->

            {#if slot.wbc === WBC_CHAMPION_ID}<span class="emo">🥇</span>{:else if slot.wbc === WBC_RUNNERUP_ID}<span
                class="emo">🥈</span
              >{/if}
          </span>
        </span>
        <span class="qsal {costTier(slot.costPaid)}">{money(slot.costPaid)}</span>
        <span class="warchip sm {warTier(slot.war)}">{slot.war.toFixed(1)}</span>
      </div>
    {/if}
  {/each}
  <!-- The payroll this club ran, closing the list. A footer, not a header: the
       seats are what the player came to see, and the front office is the
       envelope they were bought inside. fin.spend and fin.budget are required
       fields, so this renders on a finale of any age. -->
  {@render payroll(myFront, fin.budget, fin.spend)}
</div>

{#if fin.best}
  <!-- HELD BACK UNTIL THE RECORD HAS LANDED. The ceiling is the one number on
       this screen that can spoil another: a player still watching their own
       ledger deal out, with the club they could have signed already sitting
       beside it, reads the verdict before the season it belongs to. So the
       block waits for the stamp and comes in with the badge pills — the beat
       that annotates the record, which is exactly what a ceiling does.
       Mounted from the first frame and revealed by a class, the rule the
       passport follows for the same reason: this is the taller of the two
       columns, and a block that appeared mid-reveal would resize the page under
       a player who is reading it. -->
  <div class="squad dream disp" class:show={dreamShown}>
    <div class="psep">⭐ THE DREAM TEAM</div>
    <!-- What this club would have gone: the stamp's own two lines — record
         over exact points — at a fraction of its type size, directly under the
         header so it captions the roster it belongs to. No words: the player's
         record is a few inches up the same screen and the subtraction is
         theirs to do. Without it the dream club has no total at all, and a
         solver that trades WAR for payroll bonus looks broken rather than
         clever.
         Always the DREAM CLUB'S OWN record — even when the player's beats it.
         A season that outbuilt the search earns 🦉 OUTSCOUTED, and the badge
         only lands if the number it beat is on screen to be beaten. -->
    {#if capTotal != null && capRec}
      <div class="ceil">
        <span class="crec">{capRec.wins}–{capRec.losses}</span>
        <span class="cpts">{capTotal.toFixed(1)} PTS</span>
      </div>
    {/if}
    <!-- DRAFTED vs NOT, and the two states are told apart by WEIGHT rather than
         by a legend. A signed season is the full row on white cardstock,
         identical to YOUR SQUAD's above; a season the player never got sits
         behind a dashed outline with its whole contents washed out — name,
         year, award pills, WAR chip, all of it at one opacity. Faded IS missed,
         which is the thing a caption was being asked to say and the thing the
         rows can say themselves. The dash is safe here and only here — nothing
         at the finale is tappable or armed, so the ARMED channel it serves
         everywhere in play has no traffic on this screen to collide with (see
         app.css, WHERE THE RUNG IS WORN).
         No ⭐ on these rows. The star is the scouting mark and it belongs to
         the club the player actually built — repeated here it marked the same
         men twice, which made the dream list look like a second scoreboard
         rather than the counterfactual it is. YOUR SQUAD still wears every
         one, so the scouting ledger row above still points at something. -->
    {#if fin.bestManager}
      {@const bestWins = fin.bestManager.netWins * MANAGER_PER_NET_WIN}
      <!-- The skipper answers to the same treatment as the seats: solid and
           full-strength when the player's own hire IS the dream skipper,
           dashed-and-washed when the dream club found a better one. -->
      <div class="qrow" class:missed={!fin.managerHit} class:signed={fin.managerHit}>
        <span class="qpos">MGR</span>
        <span class="qmid" use:wrapnudge={2.6}>
          <span class="qname"
            >{fin.bestManager.name}
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
        <span class="warchip sm {warTier(bestWins)}">{statValue(bestWins)}</span>
      </div>
    {/if}
    {#each fin.best.picks as pick, i}
      {@const mine =
        pick != null &&
        game.slots.some((s) => s && s.id === pick.id && s.year === pick.year && s.team === pick.team)}
      <div class="qrow" class:missed={pick != null && !mine} class:signed={pick != null && mine}>
        <span class="qpos">{slotLabel(SLOT_TYPES[i])}</span>
        {#if pick}
          <!-- Awards show WHY the solver chose this season — they count in
               its objective now, not just WAR. -->
          <span class="qmid" use:wrapnudge={2.6}>
            <span class="qname"
              >{pick.name}
              <i>{pick.year} {pick.team}</i></span
            >
            <span class="qbadges">
              {#each sortAwards(pick.awards) as a}
                <AwardPill code={a} />
              {/each}
              {#if pick.ws}<span class="emo">💍</span>{:else if pick.pen}<span class="emo">🚩</span>{/if}{#if pick.wbc === WBC_CHAMPION_ID}<span
                  class="emo">🥇</span
                >{:else if pick.wbc === WBC_RUNNERUP_ID}<span class="emo">🥈</span>{/if}
            </span>
          </span>
          {#if pick.cost != null}<span class="qsal {costTier(pick.cost)}">{money(pick.cost)}</span>{/if}
          <span class="warchip sm {warTier(pick.war)}">{pick.war.toFixed(1)}</span>
        {:else}
          <span class="qname empty">—</span>
        {/if}
      </div>
    {/each}
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

{#if finaleTour}
  <FinaleInstructs
    onclose={() => {
      finaleTour = false;
      markFinaleTourSeen();
    }}
  />
{/if}

<style>
  /* THE ONE GAP BETWEEN THE PAYOFF STACK AND THE EXITS.
     The record, the badges and the passport are one ceremony; MODES / RUN IT
     BACK / SHARE are the next scene, and this is the whole separation between
     them. It is a single distance at every width on purpose: the phone and the
     desktop are the same screen at two sizes, and two numbers here made the
     finale read as two different layouts rather than one. Whatever block ends
     the stack — the passport, or the stamp alone on a finale whose seats carry
     no country — the air below it is this. */
  .fin-cols {
    --stack-to-actions: 28px;
  }
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
    /* Left score-story column sticks while the taller squads column scrolls.
       align-items: start on .fin-cols is the prerequisite — a stretch item
       can't stick. Scroller is the document; no overflow ancestor to break it.
       top: 10px matches the game board's .gleft sticky offset. */
    .fin-main {
      position: sticky;
      top: 10px;
    }
    /* Both columns open with a psep header, so the first squad sheds its
       stacked-layout gap to sit level with THE SCORECARD. */
    .fin-side > .squad:first-child {
      margin-top: 0;
    }
  }
  /* Outer wrapping row shared by badge pills and passport stamps.
     Flex-wrap so both kinds flow together on the same visual line, with the
     stamps continuing right after the last badge. Margin-top here (not on
     .brags) because the strip as a whole opens the space, whether badges,
     stamps, or both are present. */
  .badge-strip {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-start;
    gap: 6px;
    margin-top: 12px;
    /* The containing block for any opened badge or stamp panel — both kinds
       of slot are direct flex items here (their group divs are
       display:contents), so the strip is the one box PillSlot's offsetParent
       measurement finds, and the panel fences at the strip's full width. */
    position: relative;
  }
  /* No box: badges are flex items of the strip itself, so stamps continue on
     the same visual line after the last badge and either kind wraps
     mid-group. */
  .brags {
    display: contents;
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
    /* The foreshadow wash's paired line: the record tier's saturated rung
       (--fline, set beside --fore on .ledger), falling back to the neutral
       frame if the pair somehow lands unset. A wash never appears without
       its line. */
    border: 2.5px solid var(--fline, var(--line));
    border-radius: 11px;
    /* --fore (set on .ledger by recTier, the same value the stamp colors) is
       the final tier's own -2 wash, at QUARTER strength into the rows'
       parchment base. The strength has been walked repeatedly (all owner
       calls): full-saturation read too dark, 50% still read too dark, so
       25% stands — the palest wash that still leans toward the tier the
       full-saturation --fline border names. The tint is a foreshadow, not a
       reveal — rows are already this color before a single one deals,
       because recTier reads fin.parts.total, which never moves during the
       reveal. The fallback (--ground) guards against a CSS computed-value
       invalidation if --fore somehow lands unset. */
    background: color-mix(in srgb, var(--fore, var(--ground)) 25%, color-mix(in srgb, var(--ground) 55%, var(--card)));
    padding: 6px 12px;
    opacity: 0;
    transform: translateY(10px) scale(0.97);
  }
  /* At night the FILL keeps the day formula — its tint step off the
     parchment base matches the day register (the whole night palette
     inverts direction the same way) — but the BORDER dims: the night -8
     rungs are bright saturated lines tuned for 2px rings on washes, and at
     this 2.5px weight on the near-black ground the full rung read as a
     neon glow beside the day card's moderate punch (owner call,
     2026-08-11). 65% into the card lands the day read — tier hue obvious,
     no glow — sitting between SpinBanner's 72% night ring lift and the
     50% mix that under-reads. */
  :global([data-theme="dark"]) .lrow {
    border-color: color-mix(in srgb, var(--fline, var(--line)) 65%, var(--card));
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
    /* This is the row's one overflow-clipping element, and the cap trim pulls
       the content box's bottom up to the alphabetic baseline — which put the
       clip edge THROUGH the descenders and the round glyphs' baseline
       overshoot (shaved-flat 0s, owner screenshot 2026-08-10). overflow
       clips at the PADDING box, so symmetric padding pushes the clip edge
       clear on both sides and the negative margins hand the space back;
       symmetric, so flex centering is untouched. 0.35em covers Nunito's
       ~0.29em descent with margin. */
    padding-block: 0.35em;
    margin-block: -0.35em;
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
     tracking keeps repeated emoji (💍💍🚩) from fusing into one blob.
     app.css's `.chipbox`, so the ×N beside a ring is centered on the same
     axis the ring is rather than on a line box the ledger's leading sized.
     The chip's own run is emoji and stays a bare item — no cap band to trim —
     while the ×N wears `.chiplbl` like every other run of type in a chip. */
  .pedchip {
    --chip-h: 18px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.1em;
  }
  /* The chip's emoji run, as an element a correction can reach. An emoji has
     no cap band for the trim to measure, so the box alone centers it — and
     WebKit seats a bare emoji run 0.5–0.67px HIGH in these chips where Blink
     centers it (measured: tools/probe_centering.py, pedchip specimens). The
     nudge is WebKit-fenced with the -apple-system-body probe because it
     corrects that engine's seating, not the recipe. */
  .erun {
    display: block;
  }
  @supports (font: -apple-system-body) {
    .erun {
      transform: translateY(0.5px);
    }
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
  /* The record wears the game's WAR-ladder palette, keyed to its win count.
     The color is app.css's record ladder — `.tamt.elite` and its five
     siblings, the same six rules the record book and the seasons list read.
     Only the stamp's size and the weight are this surface's own. */
  /* The exact points, quiet and tabular under the record — it reconciles the
     ledger (rows sum to this, not to the rounded record) and tells 162.5
     apart from a 185 blowout when the record caps at 162–0. */
  .tpts {
    margin-top: 2px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.1em;
    /* The tracking, given back — flex-centered, so the trailing step seated
       the ink a half-step left (app.css's .warchip .unit documents the leak). */
    margin-inline-end: -0.1em;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  /* Cells and glyph come from the shared `.btnrow` in app.css; only the column
     count, the gap above it and the phone's label fit are this row's own. */
  .fin-actions {
    grid-template-columns: 1fr 1fr 1fr;
    margin-top: var(--stack-to-actions);
  }
  /* THE LABEL WRAPS; THE ROW DOES NOT SQUEEZE.
     RUN IT BACK is the widest label in the game's action row, and on a 320px
     phone three equal cells cannot hold it on one line. The row used to buy
     that line back out of the cell padding and then out of the type size, which
     bought it: at 11.5px caps the exits read as the smallest text on a screen
     whose headline is 54px, and every width was one font fallback away from
     wrapping anyway.
     So the label breaks over two lines and the break is dressed rather than
     prevented — centered, on a 1.25 line-height that puts two lines of 13px
     caps at 32.5px inside the shared 48px cell, so the wrapped button is the
     same height as the two beside it and the row keeps its baseline.
     `.btnrow` is a grid with the default `align-items: stretch`, which is what
     makes MODES and SHARE match RUN IT BACK for free if a narrower phone ever
     does stand the cell taller. Nothing here may set `align-items`.
     Wrapping also retires the overflow this row could not otherwise avoid:
     `1fr` is `minmax(auto, 1fr)`, so a track is floored at its min-content —
     with a nowrap label that floor is the whole phrase and three of them
     overflow the row, and with a wrapping one it is the longest word. */
  .fin-actions .btn {
    text-align: center;
    line-height: 1.25;
  }
  @media (max-width: 759px) {
    .fin-actions {
      gap: 6px;
    }
    .fin-actions .btn {
      padding-left: 6px;
      padding-right: 6px;
    }
  }
  .btn.ghost {
    background: transparent;
    border-style: dashed;
    color: var(--muted);
  }
  /* The two code chips sit on one line under the button row, centered, and
     wrap on a narrow phone rather than shrinking their labels. 14px of air
     between them: they read as two different offers, not one split label. */
  .codes {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin-top: 10px;
  }
  /* The season's codes — quiet, mono; tap to copy. */
  .seedchip {
    display: block;
    margin: 0;
    background: none;
    border: 0;
    padding: 4px 8px;
    cursor: pointer;
    text-align: center;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.14em;
    /* The tracking, given back as start padding: a centered run's trailing
       step seats the ink a half-step left, and padding-left of one step
       shifts it back (app.css's .warchip .unit documents the leak). */
    padding-left: calc(8px + 0.14em);
    color: var(--muted);
    /* Wide enough for the longest label the chip can show ("GAME @0KF12OY")
       so the copy feedback can't jiggle the chip. */
    min-width: 13ch;
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
  /* THE DREAM TEAM'S CARDSTOCK IS NOT THE SQUAD'S. YOUR SQUAD is what happened
     and its rows are the game's one player-row look, white cardstock, the same
     paper the market rows and the rail were drawn on. These rows are what was
     AVAILABLE — a club that never took the field — and on identical paper the
     two stacks read as one roster in two halves.
     So the stock changes, on the ROWS rather than behind them. A panel behind
     the block would tint the gutters and leave the cards themselves white,
     which distinguishes the container and not the thing; the card is what the
     player is looking at, so the card is what has to feel different.
     Diagonal stripes rather than a flat gray. Flat gray on a row is the
     universal look of a row that is switched off — the exact wrong reading for
     the best club on the screen — where a stripe reads as a different STOCK,
     watermarked paper, which is what this is.
     45deg because everything else on the surface runs horizontal: the rows, the
     separators, the ledger. A diagonal is the one direction not already
     spoken.
     SUBTLETY IS THE WHOLE CONSTRAINT, because unlike a section background this
     one sits directly under type. --gray-bg cut to 45% against --card puts
     roughly two points of luminance between the stripe and the ground — enough
     to see the texture, far too little to move the contrast under a name, an
     award pill or the WAR chip, all of which are drawn against --card's ink
     ratio and keep it. 3px on a 9px period: wide enough not to shimmer at
     small sizes, fine enough to stay texture rather than pattern.
     signed rows tinted green, missed rows keep dashed border and faded contents. */
  /* A dream row the player DID sign: quiet green wash so signed seats read
     apart from the plain card without competing with the WAR chip's own color.
     Empty seats (pick == null) carry neither .signed nor .missed. */
  /* The wash/line pair: --green-wash thinned into the card for the fill,
     --green (the saturated form of the same hue) for the border — the same
     relationship the war chip ladder uses (green-2 fill → green-8 line). */
  .squad.dream .qrow.signed {
    background: color-mix(in srgb, var(--green-wash) 30%, var(--card));
    border-color: var(--green);
  }
  /* The ledger rows' night border dim, on the same reasoning: a 2.5px -8
     rung reads as a neon glow on the night card where the day card wears
     it as moderate punch. Same 65% landing. */
  :global([data-theme="dark"]) .squad.dream .qrow.signed {
    border-color: color-mix(in srgb, var(--green) 65%, var(--card));
  }
  .squad.dream {
    /* Held until the fifth beat; see below. */
    opacity: 0;
  }
  /* THE FIFTH BEAT, and the only one that is a WITHHOLDING rather than a
     flourish. It rides the badge pills' cue: the record has landed, so the
     ceiling can be read against it.
     Same language as the ledger rows above — a rise and a fade at the ledger
     row's own duration — so the ceiling arrives as part of the same reveal
     rather than as a panel sliding in from somewhere else. A transform in a
     KEYFRAME, which resolves back to none: this block contains a passport-less
     but payroll-bearing column, and a persistent transform would make it a
     containing block for anything absolutely positioned inside it. */
  .squad.dream.show {
    opacity: 1;
    animation: dream-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes dream-in {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .squad.dream.show {
      animation: none;
    }
  }
  .qrow {
    display: flex;
    align-items: center;
    /* 9px — the row's own padding, so the salary-to-chip gap equals the
       chip-to-edge air (the one-number rule the board's rows follow). */
    gap: 9px;
    background: var(--card);
    /* Card-level box weight (2.5px), matching the market/ledger rows. */
    border: 2.5px solid var(--line);
    border-radius: 10px;
    padding: 5px 9px;
    margin-bottom: 6px;
  }
  /* --muted-2 on both sub-lines — the same token the rail's seats use, so the
     two roster surfaces read identically. */
  .qpos {
    /* Sized to UTIL plus a hair, the rail's own lane rule — the column
       aligns the names without overhanging a short code. */
    width: 31px;
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    color: var(--muted-2);
    flex: none;
    /* Left-aligned to the row's padding, matching the rail's seats: centered,
       a short code floated free of the stroke while the chip sat pulled
       inside it, and the row read heavy-left/cramped-right. */
    text-align: left;
  }
  /* Name and badges share a line when they fit; the badges wrap below when a
     decorated player runs out of room (narrow phones). The name never shrinks
     to make space for pills — past the row width it ellipsizes instead. */
  /* The paid price beside the WAR chip — the rail seats' salary read at
     finale scale, wearing the market's costTier colors (green cheap, ink mid,
     orange spendy). The dream rows show the listed price the solver charged
     its payroll. */
  .qsal {
    flex: none;
    font-weight: 800;
    font-size: 11px;
    white-space: nowrap;
  }
  .qsal.cheap {
    color: var(--green);
  }
  .qsal.spendy {
    color: var(--orange);
  }
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
  /* EVERY row is white cardstock with the rung on its chip — app.css's one
     player-row look, the same anatomy as the market rows the club was drafted
     from and the rail it was built on. Full-row tint was tried here and
     retired: eight competing washes buried the comparison the column exists
     for, while the chips align down the right edge and the eye reads
     gold-gold-violet-blue off them just the same. */
  /* Tucked to the badge row above it rather than spaced as a section of its
     own — same column, same idea, one beat apart. It carries no bottom margin:
     the distance to the exits belongs to `.fin-actions`, which owns it for
     every finale whether this block draws or not.
     No `overflow`, no `position`, and no PERSISTENT `transform`, deliberately:
     a stamp's open panel is absolutely positioned, and any of the three here
     would clip it, re-origin it, or trap it. It needs nothing from this box
     either — `Passport` sets `position: relative` on the stamp row itself, so
     the panel's containing block and its horizontal fence are both inside the
     component that draws it, the way `.brags` above does for BadgeSlot. The
     entrance below is an ANIMATION for exactly that reason: the transform lives
     in a keyframe and resolves back to none, where a transitioned `transform`
     would have to sit in the resting rule and re-origin every panel opened
     afterwards. */
  /* display:contents makes .clubpass generate no box — Passport's .stamps
     becomes a direct flex item of .badge-strip, so stamps flow inline with
     the badge pills. visibility:hidden (NOT opacity:0) gates stamps before
     the passport beat: visibility is an inherited CSS property and propagates
     through display:contents to .stamps and every pill inside it; opacity
     does not inherit, so the old opacity:0 let stamp animations run silently
     inside an invisible wrapper. The stamp entrance runs on the STAMPS (via
     the Passport animate prop), not on this wrapper. */
  .clubpass {
    display: contents;
    visibility: hidden;
  }
  /* The fourth beat flips visibility on. No layout shift: the stamps already
     reserved their space (display:contents still lets .stamps take up room). */
  .clubpass.show {
    visibility: visible;
  }
  /* Every row's WAR rides the chip's small cut (app.css's .warchip.sm — a
     modifier on the one chip, sized for these tighter rows). Only layout facts
     live here. `flex: none` because the row is a flex line — the chip's
     minimum width would otherwise be shrunk away by a long name beside it. */
  .qrow .warchip {
    margin-left: auto;
    flex: none;
    /* No inset pull: the chip stops at the row's full padding, the same air
       the position code gets on the left — the balanced read the rail's
       seats settled on. */
  }
  /* A dream seat the player never signed: the outline goes dashed and the row's
     CONTENTS wash out — name, year, award pills, chip, every part of it at one
     opacity. Dashed is safe on this screen because nothing here is tappable;
     see app.css, WHERE THE RUNG IS WORN.
     The fade is on the CHILDREN, never on `.qrow.missed` itself. Opacity on the
     row would take the dashed border down with it, and the border is the half
     of the pair that has to stay at full strength — a washed-out dash on a
     washed-out row is one weak signal instead of two clear ones.
     0.5 was the chip's number when the chip was the only thing fading, and it
     stays the number now that the whole row does. It composes with the striped
     stock above rather than fighting it: the stripe moves the ground by about
     two points of luminance, so a name at half strength lands in the same place
     over a stripe as over the card between them, and the row stays plainly a
     row rather than a ghost. */
  .qrow.missed {
    border-style: dashed;
  }
  .qrow.missed > * {
    opacity: 0.5;
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
    /* The tracking, given back — flex-centered like .tpts above. */
    margin-inline-end: -0.1em;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
</style>

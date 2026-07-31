<script lang="ts">
  import { SLOT_TYPES, type Game } from "../lib/engine.svelte";
  import { lastName, money, seedCode, signed, slotLabel, sortAwards, warTier } from "../lib/format";
  import { BANKS, DIFFICULTIES } from "../lib/modes";
  import { GOAL_POINTS, MANAGER_PER_NET_WIN, MARINERS_WINS } from "../lib/scoring";
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
    cls: "base" | "plus" | "minus" | "zero";
  }

  const rows = $derived.by((): LedgerRow[] => {
    const p = fin.parts;
    const out: LedgerRow[] = [];
    out.push({
      key: "wins",
      lbl: "Expected wins",
      why: game.manager
        ? `50 base + ${fin.totalWar.toFixed(1)} WAR + ${lastName(game.manager.name)} ${signed(p.managerWins)}`
        : `50 base + ${fin.totalWar.toFixed(1)} team WAR · no manager`,
      amt: p.expectedWins.toFixed(1),
      cls: "base",
    });
    // One budget row, two faces: the tax and the bonus are mutually exclusive
    // by construction (bonus is 0 whenever spend exceeds budget), so over cap
    // the row IS the luxury tax; at/under it's the front-office bonus.
    const overCap = fin.spend > fin.budget;
    const spendPct = fin.budget > 0 ? (fin.spend / fin.budget) * 100 : 100;
    out.push({
      key: "budget",
      lbl: overCap ? "Luxury tax" : "Front-office bonus",
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
  let dispW = $state(0);
  let dispL = $state(0);
  let dispTotal = $state("0");
  let totalShown = $state(false);

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

  $effect(() => {
    if (reduced) {
      dispW = fin.wins;
      dispL = fin.losses;
      shownRows = rows.length + 1;
      totalShown = true;
      dispTotal = fin.parts.total.toFixed(1);
      return;
    }
    count((v) => (dispW = v), fin.wins, 900);
    count((v) => (dispL = v), fin.losses, 900);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i <= rows.length; i++) {
      timers.push(
        setTimeout(() => {
          shownRows = i + 1;
          if (i === rows.length) {
            totalShown = true;
            const t0 = performance.now();
            const tick = (now: number) => {
              const prog = Math.min((now - t0) / 700, 1);
              dispTotal = (fin.parts.total * (1 - Math.pow(1 - prog, 3))).toFixed(1);
              if (prog < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            void confettiPop();
          }
        }, 1000 + i * 500),
      );
    }
    return () => timers.forEach(clearTimeout);
  });

  const TIER_EMOJI = { neg: "🔴", low: "⚪", mid: "🟢", high: "🔵", star: "🟣", elite: "🟡" } as const;

  const beatMariners = $derived(fin.wins > MARINERS_WINS);
  const perfect = $derived(fin.parts.total >= GOAL_POINTS);
  const dreamDenom = $derived(fin.bestManager ? 9 : 8);

  function shareText(): string {
    const diff = DIFFICULTIES[game.config.difficulty];
    const bank = BANKS[game.config.bank];
    const tag =
      `${diff.emoji} ${diff.name.toUpperCase()}` +
      (game.config.bank !== "classic" ? ` · ${bank.emoji} ${bank.name.toUpperCase()}` : "");
    const grid = game.spinLog
      .map((e) => {
        if (e.kind === "owner") return "💰";
        if (e.kind === "stadium") return "🏟️";
        if (e.kind === "manager") return "🧢";
        if (e.kind === "swap") return "🔁";
        return TIER_EMOJI[warTier(e.war ?? 0)];
      })
      .join("");
    const { rings, pennants } = game.pedigree;
    const medals = [
      "💍".repeat(Math.min(rings, 8)),
      "🚩".repeat(Math.min(pennants, 8)),
      fin.best ? `⭐${fin.scoutHits}/${dreamDenom}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    // The seed code ends the string: paste it into PLAY A SEED # on the home
    // screen to replay this exact card sequence.
    return [
      `HOT STOVE ${tag}`,
      grid,
      `${fin.wins}–${fin.losses}${beatMariners ? " 🔱" : ""} · 💰 ${money(fin.spend)}/${money(fin.budget)}`,
      `${medals ? `${medals} · ` : ""}🏆 ${fin.parts.total.toFixed(1)}${perfect ? " · PERFECT SEASON" : ""} · #${seedCode(game.seed)}`,
    ].join("\n");
  }

  /** Clipboard fallback swaps the button's own label (same in-place pattern
   * as the seed chip); the native share sheet is its own feedback. */
  let shareState = $state<"idle" | "copied" | "failed">("idle");
  let shareTimer: ReturnType<typeof setTimeout> | undefined;
  async function share() {
    const text = shareText();
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      /* fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(text);
      shareState = "copied";
    } catch {
      shareState = "failed";
    }
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
     (≥760px): the score story (record, ledger, actions, seed) sits beside the
     rosters (squad + dream team) so the reveal and the receipts share the
     screen. -->
<div class="fin-cols">
<div class="fin-main">
<div class="fin-head disp">
  <div class="rec">{Math.round(dispW)}–{Math.round(dispL)}</div>
  {#if beatMariners && totalShown}
    <div class="brag">🔱 BEAT THE 2001 MARINERS</div>
  {/if}
  {#if perfect && totalShown}
    <div class="brag gold">🏆 PERFECT SEASON</div>
  {/if}
</div>

<div class="ledger">
  {#each rows as row, i (row.key)}
    <div class="lrow disp" class:base={row.cls === "base"} class:show={i < shownRows}>
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
      <span class="amt" class:plus={row.cls === "plus"} class:minus={row.cls === "minus"}>{row.amt}</span>
    </div>
  {/each}
  <div class="lrow total disp" class:show={totalShown}>
    <span class="lbl">Final score</span>
    <span class="amt">{dispTotal}</span>
  </div>
</div>

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
        <span class="qbadges"
          >{#if game.manager.ws}<span class="emo">💍</span>{:else if game.manager.pen}<span class="emo">🚩</span>{/if}</span
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
          <span class="qname">{pick.name} <i>{pick.year} {pick.team}</i></span>
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
          <span class="qbadges"
            >{#if fin.bestManager.ws}<span class="emo">💍</span>{:else if fin.bestManager.pen}<span class="emo">🚩</span>{/if}</span
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
    .fin-side > .squad:first-child {
      margin-top: 4px;
    }
  }
  .fin-head {
    text-align: center;
    margin: 10px 0 12px;
  }
  .rec {
    font-size: 46px;
    font-weight: 800;
    line-height: 1;
  }
  .brag {
    display: inline-block;
    margin-top: 7px;
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
    margin-left: 6px;
  }
  @keyframes thunk-in {
    from {
      opacity: 0;
      transform: scale(0.6);
    }
  }
  .ledger {
    display: grid;
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
  .lrow.base {
    background: var(--green-wash);
  }
  .amt.plus {
    color: var(--green);
  }
  .amt.minus {
    color: var(--orange);
  }
  .lrow.total {
    background: var(--yellow);
    border-width: 3px;
  }
  .lrow.total .amt {
    font-size: 21px;
  }
  .fin-actions {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 9px;
    margin-top: 13px;
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
    border: 2px solid var(--ink);
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

<script lang="ts">
  import { SLOT_TYPES, type Game } from "../lib/engine.svelte";
  import { lastName, money, signed, warTier, yy } from "../lib/format";
  import { GOAL_POINTS, MARINERS_WINS } from "../lib/scoring";

  let {
    game,
    onreplay,
    onmodes,
  }: { game: Game; onreplay: () => void; onmodes: () => void } = $props();

  const fin = $derived(game.finale!);

  const reduced =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const AWARD_NAMES: Record<string, string> = {
    MVP: "MVP",
    CY: "Cy Young",
    MVP2: "MVP runner-up",
    CY2: "Cy Young runner-up",
    MVP3: "MVP 3rd in voting",
    CY3: "Cy Young 3rd in voting",
    ROY: "Rookie of the Year",
    GG: "Gold Glove",
    SS: "Silver Slugger",
    AS: "All-Star",
  };

  interface LedgerRow {
    key: string;
    lbl: string;
    why: string;
    amt: string;
    cls: "base" | "plus" | "minus" | "zero";
  }

  function countWhy(counts: Map<string, number>, empty: string): string {
    if (counts.size === 0) return empty;
    return [...counts.entries()].map(([k, n]) => `${n} ${k}`).join(" · ");
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
    const overCap = fin.spend > fin.budget;
    out.push({
      key: "budget",
      lbl: "Front-office bonus",
      why: overCap
        ? "blew past the cap — the tax takes it from here"
        : `${money(fin.spend)} of ${money(fin.budget)} cap used (${Math.round((fin.spend / fin.budget) * 100)}%)`,
      amt: signed(p.budgetBonus),
      cls: p.budgetBonus > 0 ? "plus" : p.budgetBonus < 0 ? "minus" : "zero",
    });
    const awardCounts = new Map<string, number>();
    for (const s of game.slots) {
      for (const a of s?.awards ?? []) {
        const name = AWARD_NAMES[a] ?? a;
        awardCounts.set(name, (awardCounts.get(name) ?? 0) + 1);
      }
    }
    out.push({
      key: "awards",
      lbl: "Hardware",
      why: countWhy(awardCounts, "no award seasons"),
      amt: signed(p.awardPoints, 0),
      cls: p.awardPoints > 0 ? "plus" : "zero",
    });
    const rings = game.slots.filter((s) => s?.ws).length + (game.manager?.ws ? 1 : 0);
    const pennants = game.slots.filter((s) => s?.pen).length + (game.manager?.pen ? 1 : 0);
    const pedigree = new Map<string, number>();
    if (rings) pedigree.set(rings === 1 ? "ring 💍" : "rings 💍", rings);
    if (pennants) pedigree.set(pennants === 1 ? "pennant 🚩" : "pennants 🚩", pennants);
    out.push({
      key: "pedigree",
      lbl: "Championship pedigree",
      why: countWhy(pedigree, "no October pedigree"),
      amt: signed(p.ringPoints, 0),
      cls: p.ringPoints > 0 ? "plus" : "zero",
    });
    if (fin.best) {
      const denom = fin.bestManager ? 9 : 8;
      out.push({
        key: "scouting",
        lbl: "Scouting report",
        why:
          fin.scoutHits > 0
            ? `${fin.scoutHits} of the dream team's ${denom} made your club ⭐`
            : "none of your picks made the dream team",
        amt: signed(p.scoutBonus, 0),
        cls: p.scoutBonus > 0 ? "plus" : "zero",
      });
    }
    out.push({
      key: "tax",
      lbl: "Luxury tax",
      why: p.luxuryTax > 0 ? `${money(fin.spend - fin.budget)} over the cap` : "stayed under the cap",
      amt: `−${p.luxuryTax % 1 === 0 ? p.luxuryTax.toFixed(0) : p.luxuryTax.toFixed(1)}`,
      cls: p.luxuryTax > 0 ? "minus" : "zero",
    });
    return out;
  });

  let shownRows = $state(0);
  let dispW = $state(0);
  let dispL = $state(0);
  let dispTotal = $state("0");
  let totalShown = $state(false);
  let toast = $state("");

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

  const TIER_EMOJI = { neg: "🔴", low: "⚪", mid: "🔵", high: "🟢", elite: "🟡" } as const;

  const DIFF_TAG: Record<string, string> = {
    standard: "🔥 STANDARD",
    scout: "🔭 SCOUT",
  };
  const BANK_TAG: Record<string, string> = {
    moneyball: " · ⚾ MONEYBALL",
    blankcheck: " · 💸 BLANK CHECK",
  };

  const beatMariners = $derived(fin.wins > MARINERS_WINS);
  const perfect = $derived(fin.parts.total >= GOAL_POINTS);
  const dreamDenom = $derived(fin.bestManager ? 9 : 8);

  function shareText(): string {
    const tag = (DIFF_TAG[game.config.difficulty] ?? "") + (BANK_TAG[game.config.bank] ?? "");
    const grid = game.spinLog
      .map((e) => {
        if (e.kind === "owner") return "💰";
        if (e.kind === "stadium") return "🏟️";
        if (e.kind === "manager") return "🧢";
        if (e.kind === "swap") return "🔁";
        return TIER_EMOJI[warTier(e.war ?? 0)];
      })
      .join("");
    const rings = game.slots.filter((s) => s?.ws).length + (game.manager?.ws ? 1 : 0);
    const pennants = game.slots.filter((s) => s?.pen).length + (game.manager?.pen ? 1 : 0);
    const medals = [
      "💍".repeat(Math.min(rings, 8)),
      "🚩".repeat(Math.min(pennants, 8)),
      fin.best ? `⭐${fin.scoutHits}/${dreamDenom}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return [
      `HOT STOVE ${tag}`,
      grid,
      `${fin.wins}–${fin.losses}${beatMariners ? " 🔱" : ""} · 💰 ${money(fin.spend)}/${money(fin.budget)}`,
      `${medals ? `${medals} · ` : ""}🏆 ${fin.parts.total.toFixed(1)}/${GOAL_POINTS}${perfect ? " 🏆 PERFECT SEASON" : ""}`,
    ].join("\n");
  }

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
      toast = "Copied 🔥";
      setTimeout(() => (toast = ""), 1800);
    } catch {
      toast = "Couldn't copy";
      setTimeout(() => (toast = ""), 1800);
    }
  }

  const awardCls: Record<string, string> = {
    MVP: "mvp",
    CY: "cy",
    MVP2: "mvp",
    CY2: "cy",
    MVP3: "mvp",
    CY3: "cy",
    GG: "gg",
    SS: "ss",
    ROY: "roy",
    AS: "as",
  };
  const pillText: Record<string, string> = {
    MVP: "🥇MVP",
    CY: "🥇CY",
    MVP2: "🥈MVP",
    CY2: "🥈CY",
    MVP3: "🥉MVP",
    CY3: "🥉CY",
  };

  /** Signed players who are also on the dream team get the ⭐. */
  const starKeys = $derived.by(() => {
    const keys = new Set<string>();
    for (const b of fin.best?.picks ?? []) if (b) keys.add(`${b.id}:${b.year}:${b.team}`);
    return keys;
  });
  const starred = (s: { id: string; year: number; team: string }) =>
    starKeys.has(`${s.id}:${s.year}:${s.team}`);
</script>

<div class="fin-head disp">
  <div class="rec">{Math.round(dispW)}–{Math.round(dispL)}</div>
  <div class="sub">YOUR {new Date().getFullYear()} HOT STOVE SQUAD</div>
  {#if beatMariners && totalShown}
    <div class="brag">🔱 BEAT THE ’01 MARINERS</div>
  {/if}
  {#if perfect && totalShown}
    <div class="brag gold">🏆 PERFECT SEASON — {GOAL_POINTS}+</div>
  {/if}
</div>

<div class="ledger">
  {#each rows as row, i (row.key)}
    <div class="lrow disp" class:base={row.cls === "base"} class:show={i < shownRows}>
      <span class="mid"><span class="lbl">{row.lbl}</span><span class="why">{row.why}</span></span>
      <span class="amt" class:plus={row.cls === "plus"} class:minus={row.cls === "minus"}>{row.amt}</span>
    </div>
  {/each}
  <div class="lrow total disp" class:show={totalShown}>
    <span class="mid"
      ><span class="lbl">Final score</span><span class="why"
        >{fin.spinCount} spins · {money(fin.spend)} payroll</span
      ></span
    >
    <span class="amt">{dispTotal}</span>
  </div>
  <div class="goal disp" class:show={totalShown}>
    <div class="goaltrack">
      <div
        class="goalfill"
        class:full={perfect}
        style:width="{Math.min((fin.parts.total / GOAL_POINTS) * 100, 100)}%"
      ></div>
    </div>
    <span class="goallbl">🎯 {GOAL_POINTS}</span>
  </div>
</div>

<div class="fin-actions">
  <button class="btn disp" onclick={onreplay}>Replay ↻</button>
  <button class="btn hot disp" onclick={share}>Share 🔥</button>
</div>
{#if toast}<div class="toast disp">{toast}</div>{/if}
<button class="modesbtn disp" onclick={onmodes}>⚙ CHANGE MODE</button>

<div class="squad disp">
  <div class="squad-h">YOUR SQUAD ▾</div>
  {#each game.slots as slot, i}
    {#if slot}
      <div class="qrow">
        <span class="qpos">{SLOT_TYPES[i]}</span>
        <span class="qname"
          >{#if starred(slot)}<span class="emo">⭐</span>
          {/if}{slot.name} <i>{yy(slot.year)}</i></span
        >
        <span class="qbadges">
          {#if slot.hero}<span class="emo">🏠</span>{/if}
          {#each slot.awards as a}
            <span class="qb {awardCls[a] ?? ''}">{pillText[a] ?? a}</span>
          {/each}
          {#if slot.ws}<span class="emo">💍</span>{:else if slot.pen}<span class="emo">🚩</span>{/if}
        </span>
        <span class="qwar {warTier(slot.war)}">{slot.war.toFixed(1)}</span>
      </div>
    {/if}
  {/each}
  {#if game.manager}
    <div class="qrow skiprow">
      <span class="qpos">MGR</span>
      <span class="qname"
        >{#if fin.managerHit}<span class="emo">⭐</span>
        {/if}{game.manager.name} <i>{yy(game.manager.year)}</i></span
      >
      <span class="qbadges"
        >{#if game.manager.ws}<span class="emo">💍</span>{:else if game.manager.pen}<span class="emo">🚩</span>{/if}</span
      >
      <span class="qwar">{signed(fin.parts.managerWins)} W</span>
    </div>
  {/if}
</div>

{#if fin.best}
  <div class="squad disp">
    <div class="squad-h">⭐ THE DREAM TEAM — BEST POSSIBLE FROM YOUR SPINS</div>
    <div class="dream-sub">
      Pure WAR, cap ignored: {fin.best.totalWar.toFixed(1)} WAR vs your {fin.totalWar.toFixed(1)}.
      You found {fin.scoutHits} of {dreamDenom}.
    </div>
    {#each fin.best.picks as pick, i}
      {@const mine =
        pick != null &&
        game.slots.some((s) => s && s.id === pick.id && s.year === pick.year && s.team === pick.team)}
      <div class="qrow" class:dreamhit={mine}>
        <span class="qpos">{SLOT_TYPES[i]}</span>
        {#if pick}
          <span class="qname"
            >{#if mine}<span class="emo">⭐</span> {/if}{pick.name} <i>{yy(pick.year)} {pick.teamName}</i></span
          >
          <span class="qwar {warTier(pick.war)}">{pick.war.toFixed(1)}</span>
        {:else}
          <span class="qname empty">—</span>
        {/if}
      </div>
    {/each}
    {#if fin.bestManager}
      <div class="qrow" class:dreamhit={fin.managerHit}>
        <span class="qpos">MGR</span>
        <span class="qname"
          >{#if fin.managerHit}<span class="emo">⭐</span>
          {/if}{fin.bestManager.name} <i>{yy(fin.bestManager.year)} {fin.bestManager.teamName}</i></span
        >
        <span class="qbadges"
          >{#if fin.bestManager.ws}<span class="emo">💍</span>{:else if fin.bestManager.pen}<span class="emo">🚩</span>{/if}</span
        >
        <span class="qwar">{signed(fin.bestManager.netWins * 0.1)} W</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .fin-head {
    text-align: center;
    margin: 10px 0 12px;
  }
  .rec {
    font-size: 46px;
    font-weight: 800;
    line-height: 1;
  }
  .sub {
    font-size: 12px;
    font-weight: 700;
    color: var(--muted);
    margin-top: 3px;
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
    min-height: 290px;
  }
  .lrow {
    display: flex;
    align-items: center;
    gap: 9px;
    border: 2.5px solid var(--ink);
    border-radius: 11px;
    background: var(--card);
    padding: 8px 12px;
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
  .lrow .mid {
    display: flex;
    flex-direction: column;
  }
  .lbl {
    font-weight: 800;
    font-size: 13.5px;
  }
  .why {
    font-size: 10.5px;
    color: var(--muted);
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
  .goal {
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0;
  }
  .goal.show {
    opacity: 1;
    transition: opacity 0.4s 0.3s;
  }
  .goaltrack {
    flex: 1;
    border: 2px solid var(--ink);
    border-radius: 999px;
    height: 10px;
    overflow: hidden;
    background: var(--card);
  }
  .goalfill {
    height: 100%;
    background: var(--orange);
    border-right: 2px solid var(--ink);
    transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1) 0.3s;
  }
  .goalfill.full {
    background: var(--war-elite);
    border-right: 0;
  }
  .goallbl {
    font-size: 10px;
    font-weight: 800;
    color: var(--muted);
    flex: none;
  }
  .fin-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
    margin-top: 13px;
  }
  .toast {
    text-align: center;
    font-weight: 800;
    font-size: 12px;
    color: var(--green-deep);
    margin-top: 8px;
  }
  .modesbtn {
    display: block;
    margin: 10px auto 0;
    background: none;
    border: 0;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--muted);
    cursor: pointer;
    padding: 6px 10px;
  }
  .squad {
    margin-top: 16px;
    border-top: 2.5px dashed var(--dash);
    padding-top: 12px;
  }
  .squad-h {
    text-align: center;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: var(--muted);
    margin-bottom: 8px;
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
  .qname {
    font-weight: 800;
    font-size: 13px;
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
    margin-left: 4px;
    flex: none;
  }
  .qb {
    font-size: 9px;
    font-weight: 800;
    border: 1.5px solid var(--ink);
    border-radius: 999px;
    padding: 0 6px;
    line-height: 1.5;
  }
  .qb.mvp {
    background: var(--yellow);
  }
  .qb.cy {
    background: var(--sky);
  }
  .qb.gg {
    background: var(--green-wash);
  }
  .qb.ss {
    background: var(--lilac);
  }
  .qb.roy {
    background: var(--pink);
  }
  .qb.as {
    background: var(--amber);
  }
  .emo {
    font-size: 12px;
    line-height: 1;
  }
  .qwar {
    margin-left: auto;
    font-weight: 800;
    font-size: 13px;
    color: var(--war-high);
    flex: none;
  }
  .qwar.elite {
    color: var(--war-elite);
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
  .dream-sub {
    text-align: center;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--muted);
    margin: -3px 0 8px;
  }
  .qrow.dreamhit {
    background: var(--green-wash);
  }
  .qname.empty {
    color: var(--gray-ink);
  }
</style>

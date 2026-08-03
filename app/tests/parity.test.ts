/** Box Score ↔ Eye Test parity: the two difficulties differ ONLY in what
 * information is visible (WAR chips, award pills, manager W–L, grid pedigree).
 * Every mechanic — signing, Trade Deadline, Homegrown, Double Play stacking,
 * scoring — must behave identically, and no hidden signal may leak into Eye
 * Test through any surface. Components render via svelte/server (SSR string),
 * driven by REAL forged Game states from the lab fixtures. */
import { describe, expect, it, vi } from "vitest";
import { render } from "svelte/server";
import type { Component } from "svelte";
import Finale from "../src/components/Finale.svelte";
import PlayerList from "../src/components/PlayerList.svelte";
import PowerupRow from "../src/components/PowerupRow.svelte";
import RosterRail from "../src/components/RosterRail.svelte";
import SpecialRows from "../src/components/SpecialRows.svelte";
import TeamPicker from "../src/components/TeamPicker.svelte";
import YearPicker from "../src/components/YearPicker.svelte";
import { finaleCeilingAbove, finaleUnder, forgeGame, mkCard, mkPlayer, mkSigned, stubMeta, stubOwners } from "../src/lab/fixtures";
import { Game, SLOT_TYPES, type GameConfig } from "../src/lib/engine.svelte";
import type { Card, GameIndex } from "../src/lib/types";

// Engine save()/restore() guard storage access; give node a minimal stub.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

// Finale completion reloads seen cards through fetch; serve registered cards.
const fetchCards: Record<string, Card> = {};
vi.stubGlobal("fetch", async (url: unknown) => {
  const m = String(url).match(/cards\/([A-Z0-9]+)_(\d{4})\.json$/);
  const c = m ? fetchCards[`${m[1]}_${m[2]}`] : undefined;
  return c ? { ok: true, json: async () => c } : { ok: false, status: 404 };
});

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };
const SCOUT: GameConfig = { difficulty: "scout", bank: "classic" };

/** SSR body for a component under one game. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ssr(component: Component<any>, props: Record<string, unknown>): string {
  return render(component, { props }).body;
}

/** The same forged state rendered under both difficulties. */
function pair(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: Component<any>,
  mutate: (g: Game) => void,
  props: (g: Game) => Record<string, unknown>,
): { std: string; sct: string } {
  const gs = forgeGame(CLASSIC, mutate);
  const gc = forgeGame(SCOUT, mutate);
  return { std: ssr(component, props(gs)), sct: ssr(component, props(gc)) };
}

const listProps = (g: Game) => ({ game: g, confirmKey: null, setConfirm: () => {} });

// ---------- market rows (PlayerList) ----------

describe("PlayerList parity", () => {
  const marketCard = () =>
    mkCard({
      players: [
        mkPlayer({ id: "bonds", name: "Barry Bonds", pos: "LF", war: 11.8, cost: 32, awards: ["MVP", "GG", "SS", "AS"] }),
        mkPlayer({ id: "ichiro", name: "Ichiro Suzuki", pos: "RF", war: 7.7, cost: 14, debut: "SEA", awards: ["MVP", "ROY"] }),
        mkPlayer({ id: "garcia", name: "Freddy Garcia", pos: "SP", war: 4.9, cost: 26.1 }),
        mkPlayer({ id: "edgar", name: "Edgar Martinez", pos: "DH", war: 5.5, cost: 11, awards: ["SS", "AS"] }),
      ],
    });

  it("Eye Test rows carry no WAR chip and no award pills — salary stays", () => {
    const { std, sct } = pair(PlayerList, (g) => (g.card = marketCard()), listProps);
    expect(std).toContain("warchip");
    expect(std).toContain("11.8");
    expect(std).toContain("MVP");
    expect(sct).not.toContain("warchip");
    expect(sct).not.toContain("11.8");
    expect(sct).not.toContain("MVP");
    // The price tag is the one signal Eye Test deliberately shows.
    for (const body of [std, sct]) {
      expect(body).toContain("$32M");
      expect(body).toContain("$26.1M");
    }
  });

  it("sorts talent-first in Box Score, money-first in Eye Test", () => {
    const { std, sct } = pair(PlayerList, (g) => (g.card = marketCard()), listProps);
    // Ichiro (7.7 WAR, $14M) vs Garcia (4.9 WAR, $26.1M): WAR order and cost
    // order disagree, so the flip discriminates the sort.
    expect(std.indexOf("Ichiro Suzuki")).toBeLessThan(std.indexOf("Freddy Garcia"));
    expect(sct.indexOf("Freddy Garcia")).toBeLessThan(sct.indexOf("Ichiro Suzuki"));
  });

  it("faded-tier gray rows: the washed WAR chip exists only where a chip exists at all", () => {
    const { std, sct } = pair(
      PlayerList,
      (g) => {
        g.card = marketCard();
        // Edgar rostered → his market row grays (dead) in both modes.
        g.slots[4] = mkSigned({ id: "edgar", name: "Edgar Martinez", pos: "DH", war: 5.5, costPaid: 11 });
      },
      listProps,
    );
    for (const body of [std, sct]) expect(body).toContain("Edgar Martinez");
    // Box Score dead rows keep the washed chip; Eye Test renders none anywhere.
    expect(std).toContain("warchip");
    expect(sct).not.toContain("warchip");
  });

  it("armed 🏠 reprices debut rows to $1M in both modes; grayed rows never grow a chip in Eye Test", () => {
    const { std, sct } = pair(
      PlayerList,
      (g) => {
        g.card = marketCard(); // card franchise SEA; Ichiro debuted SEA
        g.powerups.hometown = "armed";
      },
      listProps,
    );
    for (const body of [std, sct]) expect(body).toContain("$1M");
    expect(sct).not.toContain("warchip");
  });

  it("armed TD shows the same TRADE FOR confirm in both modes", () => {
    const mut = (g: Game) => {
      g.card = marketCard();
      for (let i = 0; i < SLOT_TYPES.length; i++)
        g.slots[i] = mkSigned({ name: `Filler ${i}`, pos: ["C", "1B", "2B", "LF", "DH", "SP", "SP", "RP"][i], costPaid: 5 });
      g.powerups.tradeDeadline = "armed";
    };
    const props = (g: Game) => ({ game: g, confirmKey: "t:bonds", setConfirm: () => {} });
    const gs = forgeGame(CLASSIC, mut);
    const gc = forgeGame(SCOUT, mut);
    for (const g of [gs, gc]) expect(g.tdCandidate(g.card!.players[0])).toBe(true);
    for (const body of [ssr(PlayerList, props(gs)), ssr(PlayerList, props(gc))])
      expect(body).toContain("TRADE FOR $32M");
  });

  it("pending-pill hints are identical in both modes", () => {
    const release = pair(
      PlayerList,
      (g) => {
        g.card = marketCard();
        g.powerups.tradeDeadline = "armed";
        g.releasePick = "bonds";
      },
      listProps,
    );
    for (const body of [release.std, release.sct]) expect(body).toContain("↑ TAP WHO TO TRADE");
    const slot = pair(
      PlayerList,
      (g) => {
        g.card = marketCard();
        g.slotPick = "bonds";
      },
      listProps,
    );
    for (const body of [slot.std, slot.sct]) expect(body).toContain("↑ PICK A SLOT");
  });
});

// ---------- front office rows ----------

describe("SpecialRows parity", () => {
  // mkCard: Lou Piniella, 116–46 → (116−46) × 0.2 = "+14.0 W".
  it("Eye Test withholds the manager record and win value; the stadium ×mult stays", () => {
    const { std, sct } = pair(SpecialRows, (g) => (g.card = mkCard()), listProps);
    expect(std).toContain("116–46");
    expect(std).toContain("+14.0 W");
    expect(sct).not.toContain("116–46");
    expect(sct).not.toContain("+14.0");
    for (const body of [std, sct]) {
      expect(body).toContain("Lou Piniella");
      expect(body).toContain("×1.05"); // mechanical payroll multiplier
      expect(body).toContain("3.50M fans");
    }
  });

  it("the manager HIRE confirm carries the win value only in Box Score", () => {
    const props = (g: Game) => ({ game: g, confirmKey: "s:manager", setConfirm: () => {} });
    const gs = forgeGame(CLASSIC, (g) => (g.card = mkCard()));
    const gc = forgeGame(SCOUT, (g) => (g.card = mkCard()));
    expect(ssr(SpecialRows, props(gs))).toContain("HIRE +14.0 W");
    const sct = ssr(SpecialRows, props(gc));
    expect(sct).not.toContain("+14.0");
    expect(sct).toContain(">HIRE<"); // bare verb, no advertised hole
  });

  it("armed ⭐ ambers only the open manager tile — owner and stadium never light up", () => {
    const { std, sct } = pair(
      SpecialRows,
      (g) => {
        g.card = mkCard();
        g.powerups.prime = "armed";
      },
      listProps,
    );
    for (const body of [std, sct]) {
      // Exactly one prime-lit row: the manager's (.skip). The owner and
      // stadium tiles keep their plain hire look (not Prime targets).
      expect(body.match(/prime/g)?.length).toBe(1);
      expect(body).toMatch(/class="srow skip[^"]*\bprime\b/);
    }
  });

  it("TD trade-in of a taken special reads the same in both modes", () => {
    const mut = (g: Game) => {
      g.card = mkCard();
      g.manager = { name: "Lou Piniella", wins: 116, losses: 46, year: 2001, team: "SEA", teamName: "Seattle Mariners", ws: false, pen: true };
      g.powerups.tradeDeadline = "armed";
    };
    const props = (g: Game) => ({ game: g, confirmKey: "w:manager", setConfirm: () => {} });
    const gs = forgeGame(CLASSIC, mut);
    const gc = forgeGame(SCOUT, mut);
    for (const body of [ssr(SpecialRows, props(gs)), ssr(SpecialRows, props(gc))])
      expect(body).toContain("🔁 TRADE IN");
  });
});

// ---------- roster rail ----------

describe("RosterRail parity", () => {
  it("Eye Test seats carry no WAR figures and no manager win value", () => {
    const { std, sct } = pair(
      RosterRail,
      (g) => {
        g.card = mkCard();
        g.slots[1] = mkSigned({ name: "Bret Boone", pos: "2B", war: 5.2, costPaid: 9 });
        g.manager = { name: "Lou Piniella", wins: 116, losses: 46, year: 2001, team: "SEA", teamName: "Seattle Mariners", ws: false, pen: true };
      },
      (g) => ({ game: g }),
    );
    expect(std).toContain("rwar");
    expect(std).toContain("5.2");
    expect(std).toContain("+14.0 W");
    expect(sct).not.toContain("rwar");
    expect(sct).not.toContain("5.2");
    expect(sct).not.toContain("+14.0");
    for (const body of [std, sct]) {
      expect(body).toContain("Boone");
      expect(body).toContain("Piniella");
    }
  });
});

// ---------- reroll grids (Season Ticket / Relocate pedigree gating) ----------

/** Index with per-season pedigree + era divisions, for the grid pickers. */
const gridIndex: GameIndex = {
  yearMin: 1995,
  yearMax: 2001,
  cards: [
    { team: "SEA", year: 1995, franchise: "SEA", name: "Seattle Mariners", lg: "AL", div: "W", pen: true },
    { team: "SEA", year: 2001, franchise: "SEA", name: "Seattle Mariners", lg: "AL", div: "W" },
    { team: "NYY", year: 2001, franchise: "NYY", name: "New York Yankees", lg: "AL", div: "E", ws: true },
    { team: "ARI", year: 2001, franchise: "ARI", name: "Arizona Diamondbacks", lg: "NL", div: "W" },
  ],
};

function gridGame(config: GameConfig): Game {
  const g = new Game(stubMeta, gridIndex, stubOwners, 12345, config);
  Object.defineProperty(g, "save", { value: () => {} });
  g.phase = "landed";
  g.choicesLeft = 1;
  g.card = mkCard(); // SEA 2001
  return g;
}

describe("grid pedigree parity", () => {
  it("Season Ticket year grid: 💍/🚩 in Box Score only", () => {
    const props = (g: Game) => ({ game: g, onclose: () => {} });
    const std = ssr(YearPicker, props(gridGame(CLASSIC)));
    const sct = ssr(YearPicker, props(gridGame(SCOUT)));
    expect(std).toContain("🚩"); // SEA 1995 pennant
    expect(sct).not.toContain("🚩");
    expect(sct).not.toContain("💍");
    for (const body of [std, sct]) expect(body).toContain("1995");
  });

  it("Relocate team grid: division groups in both modes, pedigree in Box Score only", () => {
    const props = (g: Game) => ({ game: g, colors: { franchises: {} }, onclose: () => {} });
    const std = ssr(TeamPicker, props(gridGame(CLASSIC)));
    const sct = ssr(TeamPicker, props(gridGame(SCOUT)));
    expect(std).toContain("💍"); // NYY 2001 won it all
    expect(sct).not.toContain("💍");
    expect(sct).not.toContain("🚩");
    for (const body of [std, sct]) {
      expect(body).toContain("AL EAST");
      expect(body).toContain("AL WEST");
      expect(body).toContain("NL WEST");
      expect(body).toContain("NYY");
    }
  });
});

// ---------- powerup pills ----------

describe("PowerupRow parity", () => {
  it("armed labels are byte-identical across modes (the row never reads difficulty)", () => {
    const mut = (g: Game) => {
      g.card = mkCard({ players: [mkPlayer({ name: "Filler", pos: "C" })] });
      g.powerups.doublePlay = "armed";
      g.powerups.tradeDeadline = "armed";
      g.powerups.hometown = "armed";
      g.powerups.prime = "armed";
      g.choicesLeft = 2;
    };
    const props = (g: Game) => ({ game: g, onSeasonTicket: () => {}, onRelocate: () => {} });
    const { std, sct } = pair(PowerupRow, mut, props);
    expect(sct).toBe(std);
    // All four armed at once, which is legal and is the case the row's width
    // budget is written against: no row may exceed 34 label characters in any
    // armed combination, or the 3+3 lattice breaks on a 390px phone.
    for (const label of ["✌️ PICK TWO…", "🔁 TAP A TRADE…", "🏠 SIGN AT $1M…", "⭐ TAP A PLAYER…"])
      expect(std).toContain(label);
    expect(std).not.toContain("DONE");
    // Mid-release-pick the TD pill asks who goes — same in both modes.
    const rp = pair(
      PowerupRow,
      (g) => {
        mut(g);
        g.releasePick = "x";
      },
      props,
    );
    expect(rp.sct).toBe(rp.std);
    expect(rp.std).toContain("🔁 WHO GOES?");
  });
});

// ---------- finale ----------

describe("Finale parity", () => {
  it("the finale reveals everything in both modes — markup is byte-identical", () => {
    const std = finaleUnder();
    const sct = finaleUnder();
    sct.config.difficulty = "scout";
    const props = (g: Game) => ({ game: g, onreplay: () => {}, onmodes: () => {} });
    const a = ssr(Finale, props(std));
    const b = ssr(Finale, props(sct));
    expect(b).toBe(a);
    // Full reveal: ledger, WAR figures, award pills, pedigree, 🏠 marker.
    expect(a).toContain("THE LEDGER");
    expect(a).toContain("8.5"); // A-Rod's WAR on the squad card
    expect(a).toContain("MVP");
    expect(a).toContain("💍");
    expect(a).toContain("🏠");
    expect(a).toContain("PTS");
  });

  it("the ceiling and the dream front office are identical in both modes too", () => {
    // finaleUnder above predates the ceiling fields, so it cannot cover this
    // markup at all. The ceiling is a record, a points total, an owner's name,
    // a payroll and a ballpark multiplier — every one of them a quantity Eye
    // Test hides DURING a game, and every one of them revealed at the finale
    // like the rest. The claim is the same one the case above makes: the finale
    // has no mode.
    const std = finaleCeilingAbove();
    const sct = finaleCeilingAbove();
    sct.config.difficulty = "scout";
    const props = (g: Game) => ({ game: g, onreplay: () => {}, onmodes: () => {} });
    const a = ssr(Finale, props(std));
    expect(ssr(Finale, props(sct))).toBe(a);
    const rec = std.finale!.bestPossibleRecord!;
    expect(a).toContain(`${rec.wins}–${rec.losses}`);
    expect(a).toContain(`${std.finale!.bestPossibleTotal!.toFixed(1)} PTS`);
    expect(a).toContain("Hiroshi Yamauchi");
    expect(a).toContain("Network Associates Coliseum");
    expect(a).toContain("SPENT");
  });
});

// ---------- engine mechanics parity ----------

/** Run the same script under both difficulties; the resulting state must be
 * indistinguishable (visibility getters aside, the engine has no mode). */
function bothEngines(mutate: (g: Game) => void, act: (g: Game) => void) {
  const snap = (g: Game) =>
    JSON.parse(
      JSON.stringify({
        slots: g.slots,
        powerups: g.powerups,
        choicesUsed: g.choicesUsed,
        choicesLeft: g.choicesLeft,
        spend: g.spend,
        releasePick: g.releasePick,
        slotPick: g.slotPick,
        phase: g.phase,
      }),
    );
  const run = (config: GameConfig) => {
    const g = forgeGame(config, mutate);
    act(g);
    return snap(g);
  };
  const std = run(CLASSIC);
  expect(run(SCOUT)).toEqual(std);
  return std;
}

describe("engine mechanics parity", () => {
  const tdCard = () =>
    mkCard({
      players: [
        // RP: relievers never reach FLEX, so exactly one seat is eligible.
        mkPlayer({ id: "in-rp", name: "Trade-In Reliever", pos: "RP", war: 6, cost: 12 }),
        mkPlayer({ id: "in-if", name: "Trade-In Infielder", pos: "2B", war: 4, cost: 8 }),
        mkPlayer({ id: "home", name: "Homegrown Kid", pos: "LF", war: 3, cost: 14, debut: "SEA" }),
        mkPlayer({ id: "away", name: "Outsider", pos: "RF", war: 5, cost: 9, debut: "NYY" }),
      ],
    });
  const fullRoster = (g: Game) => {
    const seats = ["C", "1B", "2B", "LF", "DH", "SP", "SP", "RP"];
    seats.forEach(
      (pos, i) => (g.slots[i] = mkSigned({ id: `fill${i}`, name: `Filler ${i}`, pos, costPaid: 5 })),
    );
  };

  it("TD swap (single eligible seat) commits identically", () => {
    const std = bothEngines(
      (g) => {
        g.card = tdCard();
        fullRoster(g);
        g.powerups.tradeDeadline = "armed";
      },
      (g) => g.tdTapPlayer(g.card!.players[0]),
    );
    expect(std.slots[7].id).toBe("in-rp");
    expect(std.powerups.tradeDeadline).toBe("spent");
    expect(std.choicesUsed).toBe(1);
  });

  it("TD release picker (multi-seat) resolves identically", () => {
    const std = bothEngines(
      (g) => {
        g.card = tdCard();
        fullRoster(g);
        g.powerups.tradeDeadline = "armed";
      },
      (g) => {
        const p = g.card!.players[1]; // IF: two occupied IF seats
        g.tdTapPlayer(p);
        g.tdRelease(p, 2);
      },
    );
    expect(std.slots[2].id).toBe("in-if");
  });

  it("🏠 signs the debut row at the $1M flat and blocks non-debut rows, identically", () => {
    const std = bothEngines(
      (g) => {
        g.card = tdCard();
        g.powerups.hometown = "armed";
      },
      (g) => {
        expect(g.rowPlayable(g.card!.players[3])).toBe(false); // Outsider grayed
        expect(g.priceFor(g.card!.players[2])).toBe(1);
        g.signPlayer(g.card!.players[2]);
      },
    );
    const signed = std.slots.find((s: { id: string } | null) => s?.id === "home");
    expect(signed.costPaid).toBe(1);
    expect(signed.hero).toBe(true);
    expect(std.powerups.hometown).toBe("spent");
  });

  it("TD + 🏠 stacked: a debut-eligible trade-in commits at the discount, both spend", () => {
    const std = bothEngines(
      (g) => {
        g.card = tdCard();
        fullRoster(g);
        g.powerups.tradeDeadline = "armed";
        g.powerups.hometown = "armed";
      },
      (g) => {
        const kid = g.card!.players[2]; // Homegrown Kid: OF seat + FLEX both occupied
        g.tdTapPlayer(kid);
        g.tdRelease(kid, 3);
      },
    );
    expect(std.slots[3].id).toBe("home");
    expect(std.slots[3].costPaid).toBe(1);
    expect(std.powerups.tradeDeadline).toBe("spent");
    expect(std.powerups.hometown).toBe("spent");
  });

  it("DP + 🏠 stacked: discounted pick one, full-price pick two, identically", () => {
    const std = bothEngines(
      (g) => {
        g.card = tdCard();
        g.powerups.doublePlay = "armed";
        g.powerups.hometown = "armed";
        g.choicesLeft = 2;
      },
      (g) => {
        g.signPlayer(g.card!.players[2]); // $1M homegrown
        g.signPlayer(g.card!.players[3]); // filter lifted → plain $9M sign
      },
    );
    expect(std.spend).toBe(10);
    expect(std.powerups.doublePlay).toBe("spent");
    expect(std.choicesUsed).toBe(2);
  });

  it("the finale scores identically for identical clubs", async () => {
    fetchCards.SEA_2001 = mkCard({
      players: [mkPlayer({ id: "in-c", name: "Trade-In Catcher", pos: "C", war: 6, cost: 12 })],
    });
    const finish = async (config: GameConfig) => {
      const g = forgeGame({ ...config, bank: "moneyball" }, (gg) => {
        gg.card = mkCard();
        fullRoster(gg);
        gg.seen = [{ team: "SEA", year: 2001 }];
        gg.powerups.tradeDeadline = "spent";
      });
      g.hireManager();
      await vi.waitFor(() => expect(g.phase).toBe("finale"));
      return g.finale!;
    };
    const std = await finish(CLASSIC);
    const sct = await finish(SCOUT);
    expect(sct.parts).toEqual(std.parts);
    expect([sct.wins, sct.losses, sct.scoutHits]).toEqual([std.wins, std.losses, std.scoutHits]);
    expect(sct.best).toEqual(std.best);
  });
});

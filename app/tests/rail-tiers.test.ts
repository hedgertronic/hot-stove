/** The in-play roster rail: white seats whose WAR rides a compact chip, at
 * every width. Two contracts are load-bearing here.
 *
 * 1. No hardware in the rail. Players never wear their award pills in a seat,
 *    so the manager doesn't wear MOY either; the pill is finale-only. The
 *    manager's `moty` flag is display-suppressed, not dropped — the finale
 *    still reads it off the same object.
 * 2. The rung obeys the difficulty ladder. The seat's `war-*` class is the
 *    fact-carrier that colors the chip (the class sets app.css's --rung pair;
 *    the chip inherits and spends it), so it is gated on `showWar` exactly
 *    like the chip's numeral: Eye Test must emit no tier token and no chip at
 *    all, or the color leaks the talent read the mode hides.
 *
 * Same SSR-string approach as parity.test.ts / moy-parity.test.ts. */
import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import type { Component } from "svelte";
import PlayerList from "../src/components/PlayerList.svelte";
import RosterRail from "../src/components/RosterRail.svelte";
import { forgeGame, mkCard, mkPlayer, mkSigned } from "../src/lab/fixtures";
import type { Game, GameConfig } from "../src/lib/engine.svelte";

// Engine save()/restore() guard storage access; give node a minimal stub.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };
const SCOUT: GameConfig = { difficulty: "scout", bank: "classic" };

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
): { std: string; sct: string; gs: Game; gc: Game } {
  const gs = forgeGame(CLASSIC, mutate);
  const gc = forgeGame(SCOUT, mutate);
  return { std: ssr(component, props(gs)), sct: ssr(component, props(gc)), gs, gc };
}

const railProps = (g: Game) => ({ game: g });

/** A Manager of the Year skipper in the MGR seat. */
const hireMoty = (g: Game) => {
  g.card = mkCard({ managerMoty: true });
  g.manager = {
    name: "Lou Piniella",
    wins: 116,
    losses: 46,
    year: 2001,
    team: "SEA",
    teamName: "Seattle Mariners",
    ws: false,
    pen: true,
    moty: true,
  };
};

describe("roster rail hardware", () => {
  it("the MGR seat wears no MOY pill, MotY skipper or not, in either mode", () => {
    const { std, sct } = pair(RosterRail, hireMoty, railProps);
    for (const body of [std, sct]) {
      expect(body).toContain("Piniella"); // the seat itself still renders
      expect(body).not.toContain("MOY");
    }
  });

  it("suppressing the pill leaves the manager's moty flag on the game", () => {
    const { gs, gc } = pair(RosterRail, hireMoty, railProps);
    // The finale reads game.manager.moty for the trophy case — display-only
    // suppression must not have touched the data.
    for (const g of [gs, gc]) expect(g.manager?.moty).toBe(true);
  });
});

describe("roster rail WAR tier bands", () => {
  // Two distinct tiers, so a hardcoded single class can't satisfy the test:
  // 5.2 WAR is "high" (4–6), 2.1 is "mid" (2–4).
  const seatTiers = (g: Game) => {
    g.card = mkCard();
    g.slots[0] = mkSigned({ id: "boone", name: "Bret Boone", pos: "C", war: 5.2 });
    g.slots[1] = mkSigned({ id: "salty", name: "Jarrod Saltalamacchia", pos: "1B", war: 2.1 });
  };

  it("Box Score seats carry their tier band class", () => {
    const { std } = pair(RosterRail, seatTiers, railProps);
    expect(std).toContain("war-high");
    expect(std).toContain("war-mid");
  });

  it("Eye Test seats carry no tier token at all — color would leak WAR", () => {
    const { sct } = pair(RosterRail, seatTiers, railProps);
    expect(sct).toContain("Boone"); // the seats render; only the tier is gone
    expect(sct).toContain("Saltalamacchia");
    expect(sct).not.toContain("war-");
  });

  it("the WAR value rides a chip, gated exactly like the tier token", () => {
    const { std, sct } = pair(RosterRail, seatTiers, railProps);
    expect(std).toContain("5.2");
    expect(std).toContain("warchip"); // the value's carrier is the chip
    expect(sct).not.toContain("5.2");
    expect(sct).not.toContain("warchip"); // Eye Test draws no chip at all
  });

  // The seats above hire nobody, so they cannot cover the manager's gate: with
  // no manager the tier is "" whatever the mode says. The skipper rides the
  // same six-rung ladder as the players — Piniella's 2001 (116–46 → +14.0 W)
  // is the elite rung, which the share string has always printed as 🟨 — so it
  // needs the same two assertions the seats get, on its own fixture.
  const mgrElite = (g: Game) => {
    g.card = mkCard();
    g.manager = {
      name: "Lou Piniella",
      wins: 116,
      losses: 46,
      year: 2001,
      team: "SEA",
      teamName: "Seattle Mariners",
      ws: false,
      pen: true,
    };
  };

  it("Box Score tiers the manager's seat and his +wins on the players' ladder", () => {
    const { std } = pair(RosterRail, mgrElite, railProps);
    expect(std).toContain("war-elite");
    // Bare and signed on the chip — no W/WINS unit in the rail's small rows.
    expect(std).toContain("+14.0");
    expect(std).not.toContain("+14.0 W");
  });

  it("Eye Test hides the manager's tier and his +wins — both would leak the read", () => {
    const { sct } = pair(RosterRail, mgrElite, railProps);
    expect(sct).toContain("Piniella"); // the seat renders; only the tier is gone
    expect(sct).not.toContain("war-");
    expect(sct).not.toContain("+14.0");
  });
});

/** The MGR seat's rung, which the seat's single tier token drives — the class
 * sets the --rung pair and the seat's CHIP is what inherits and wears it; the
 * seat itself stays white cardstock. Three things follow from that and each
 * gets an assertion.
 *
 * The token is the only carrier, so it has to be present exactly once and it
 * has to be the right rung — a seat that emitted two would hand the chip
 * whichever pair the stylesheet happened to list last.
 *
 * The token has to move with the record. A skipper's rung comes from net wins
 * × MANAGER_PER_NET_WIN, which is a different arithmetic from a player's raw
 * WAR, so the rungs are pinned across the ladder rather than at one point:
 * 116–46 is +14.0 (elite), 90–72 is +3.6 (mid), 81–81 is +0.0 (low), and
 * 60–102 is −8.4 (neg). A ladder pinned only at the top passes on a constant.
 *
 * And Eye Test has to emit none of it — no token, no chip. That gate was
 * already load-bearing for the numeral; a colored chip is a louder leak.
 *
 * The colors themselves are not asserted: they are CSS, jsdom does not resolve
 * custom properties, and the look is a screenshot job. The class is what proves
 * the state. */
describe("the hired manager's seat wears its rung", () => {
  const RUNGS: [string, number, number, string][] = [
    ["elite", 116, 46, "+14.0"],
    ["mid", 90, 72, "+3.6"],
    ["low", 81, 81, "+0.0"],
    ["neg", 60, 102, "−8.4"],
  ];

  const hire = (wins: number, losses: number) => (g: Game) => {
    g.card = mkCard();
    g.manager = {
      name: "Lou Piniella",
      wins,
      losses,
      year: 2001,
      team: "SEA",
      teamName: "Seattle Mariners",
      ws: false,
      pen: false,
    };
  };

  /** The seat's own opening tag, so a player cell's token can't answer for it.
   * Matched on the class LIST rather than on its head, because the compiler's
   * own scoping class shares that attribute and its position is not ours. */
  function mgrTag(body: string): string {
    const m = body.match(/<div class="[^"]*\bmgr\b[^"]*"/);
    expect(m).not.toBeNull();
    return m![0];
  }

  for (const [rung, w, l, plusW] of RUNGS) {
    it(`${w}–${l} (${plusW}) puts exactly one token, war-${rung}, on the seat`, () => {
      const { std } = pair(RosterRail, hire(w, l), railProps);
      const tag = mgrTag(std);
      expect(tag).toContain("filled");
      expect(tag).toContain(`war-${rung}`);
      expect(tag.match(/war-/g)).toHaveLength(1);
      expect(std).toContain(plusW);
    });

    it(`Eye Test leaves the ${w}–${l} seat untinted`, () => {
      const { sct } = pair(RosterRail, hire(w, l), railProps);
      const tag = mgrTag(sct);
      expect(tag).toContain("filled"); // the seat is still hired
      expect(tag).not.toContain("war-");
      expect(sct).not.toContain(plusW);
    });
  }
});

/** ⭐ PRIMETIME's reach across the market rows, which is a different question
 * from whether the landed season can be bought.
 *
 * `rowPlayable` answers "can this season be signed right now" and 🏠 Homegrown
 * is one of its inputs: an armed discount grays every row that did not debut
 * with this franchise. A career sheet sells seasons off cards the reel never
 * landed on, at list price, so the discount has no claim on it — routing ⭐
 * through `rowPlayable` shrank an armed ⭐ to the debut players, silently, and
 * that is the pair a player is most likely to arm together.
 *
 * The row's LOOK is what this asserts, because the look is what tells the
 * player the tap exists: a browsable row must not render `dead`. The routing
 * behind it reads the same `primeBrowsable` predicate, so one gate answers
 * both — which is the property that keeps them from drifting apart again. */
describe("PRIMETIME reaches rows the market has grayed", () => {
  // "XXX" is the fixtures' default debut franchise and the card is SEA, so
  // this player is exactly what an armed 🏠 grays and an armed ⭐ must still
  // be able to browse.
  const bothArmed = (g: Game) => {
    g.card = mkCard({
      players: [mkPlayer({ id: "bonds", name: "Barry Bonds", pos: "LF", war: 11.8, cost: 32 })],
    });
    g.powerups.hometown = "armed";
    g.powerups.prime = "armed";
  };

  it("an armed Homegrown does not gray a row an armed PRIMETIME can browse", () => {
    const { std } = pair(PlayerList, bothArmed, (g) => ({
      game: g,
      confirmKey: null,
      setConfirm: () => {},
    }));
    expect(std).toContain("Bonds");
    expect(std).toContain("prime"); // the browse affordance is on the row
    expect(std).not.toContain("dead");
  });

  it("Homegrown alone still grays it — the discount's own filter is intact", () => {
    const { std } = pair(
      PlayerList,
      (g) => {
        bothArmed(g);
        g.powerups.prime = "ready";
      },
      (g) => ({ game: g, confirmKey: null, setConfirm: () => {} }),
    );
    expect(std).toContain("dead");
  });
});

describe("Trade Deadline release hint", () => {
  it("the pending pill reads TAP WHO TO TRADE in both modes", () => {
    const { std, sct } = pair(
      PlayerList,
      (g) => {
        g.card = mkCard({
          players: [mkPlayer({ id: "bonds", name: "Barry Bonds", pos: "LF", war: 11.8, cost: 32 })],
        });
        g.powerups.tradeDeadline = "armed";
        g.releasePick = "bonds";
      },
      (g) => ({ game: g, confirmKey: null, setConfirm: () => {} }),
    );
    for (const body of [std, sct]) {
      expect(body).toContain("↑ TAP WHO TO TRADE");
      expect(body).not.toContain("TRADE AWAY");
    }
  });
});

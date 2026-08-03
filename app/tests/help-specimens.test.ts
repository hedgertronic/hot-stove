/** The help sheet's specimens are REAL seasons at their REAL numbers.
 *
 * Every figure in HowToPlay names a man, a club and a year, so a wrong WAR or a
 * wrong price is the sheet stating a falsehood about a real person's season —
 * and the sheet's own caption says a seat's border color IS that player's WAR
 * tier, so an invented number makes the ladder it teaches wrong too. That is
 * exactly what shipped for one round: a manager chair labelled `star` beside a
 * hand-typed "+9.4 W", which is `elite`.
 *
 * Every figure is now checked against data/cards, and the tiers are derived in
 * the component rather than written down. This test is the half the component
 * cannot do for itself: it reads the specimens back out of the rendered sheet
 * and finds each one on a card.
 *
 * Rendered SSR rather than in jsdom — the sheet fetches nothing and its markup
 * is a pure function of its fixtures, so a string is the whole subject.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import HelpModal from "../src/components/HelpModal.svelte";
import { MANAGER_PER_NET_WIN } from "../src/lib/scoring";
import { signed, warTier } from "../src/lib/format";

interface Row {
  id: string;
  name: string;
  war: number;
  cost: number;
  pos: string;
}
interface CardRow {
  year: number;
  team: string;
  wins: number;
  losses: number;
  manager: string | null;
  players: Row[];
}

const DATA = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..", "data");
const INDEX = JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf8")) as {
  cards: { team: string; year: number }[];
};
const CARDS: CardRow[] = INDEX.cards.map(
  (c) =>
    JSON.parse(
      fs.readFileSync(path.join(DATA, "cards", `${c.team}_${c.year}.json`), "utf8"),
    ) as CardRow,
);

const card = (team: string, year: number): CardRow => {
  const hit = CARDS.find((c) => c.team === team && c.year === year);
  if (!hit) throw new Error(`no card for ${team} ${year}`);
  return hit;
};
/** Last name, the way the rail shortens one — the specimens print that form. */
const surname = (full: string) => full.split(" ").slice(1).join(" ");

const BODY = render(HelpModal, { props: { onclose: () => {} } }).body;

describe("the help sheet's player specimens", () => {
  /** [club, year, surname, the WAR the sheet prints] */
  const SEASONS: [string, number, string, number][] = [
    ["LAD", 1997, "Piazza", 8.7],
    ["ATL", 1995, "Maddux", 10.8],
  ];

  it.each(SEASONS)("prints %s %d %s at the WAR the card carries", (team, year, last, war) => {
    const p = card(team, year).players.find((x) => surname(x.name) === last);
    expect(p, `${last} is not on ${team} ${year}`).toBeDefined();
    expect(p!.war).toBe(war);
    // …and the sheet really is showing it, seat and season line together.
    expect(BODY).toContain(`>${last}<`);
    expect(BODY).toContain(`${year} ${team}`);
    expect(BODY).toContain(`>${war.toFixed(1)}<`);
  });

  it("gives each seat the rung its own number earns", () => {
    // The caption's claim, checked rather than assumed. `war-star` on an 8.7 is
    // the failure this whole file exists for.
    for (const [, , , war] of SEASONS) {
      expect(BODY, `${war} should wear war-${warTier(war)}`).toContain(`war-${warTier(war)}`);
    }
    // 8.7 and 10.8 are both elite, so the two seats must NOT be showing two
    // different rungs — and neither may be the manager's.
    expect(warTier(8.7)).toBe("elite");
    expect(warTier(10.8)).toBe("elite");
  });

  it("prints the market row's man at his real WAR and his real price", () => {
    // Pedro's 1999, the sheet's "generational season with hardware on it".
    const p = card("BOS", 1999).players.find((x) => surname(x.name) === "Martínez")!;
    expect(p.war).toBe(9.8);
    expect(p.cost).toBe(54.6);
    expect(BODY).toContain("9.8");
    expect(BODY).toContain("$54.6M");
  });

  it("prints the gray row's man at his real WAR and his real price", () => {
    const p = card("TEX", 1999).players.find((x) => surname(x.name) === "Rodríguez")!;
    expect(p.war).toBe(6.4);
    expect(p.cost).toBe(44);
    expect(BODY).toContain("$44M");
  });
});

describe("the help sheet's manager specimen", () => {
  it("shows Cox's real 1995 record through the engine's own expression", () => {
    const c = card("ATL", 1995);
    expect(c.manager).toBe("Bobby Cox");
    expect([c.wins, c.losses]).toEqual([90, 54]);
    const wins = (c.wins - c.losses) * MANAGER_PER_NET_WIN;
    expect(BODY).toContain(`${signed(wins)} W`);
    // The half that broke: the chair's rung has to be the rung that number
    // earns, not a hand-picked one that looks about right.
    expect(BODY).toContain(`war-${warTier(wins)}`);
    expect(warTier(wins)).toBe("star");
  });
});

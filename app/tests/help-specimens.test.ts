/** The help sheet's specimens are REAL seasons at their REAL numbers.
 *
 * Every figure in HowToPlay names a man, a club and a year, so a wrong WAR or a
 * wrong price is the sheet stating a falsehood about a real person's season —
 * and the sheet's own caption says a seat's chip color IS that player's WAR
 * tier, so an invented number makes the ladder it teaches wrong too. That is
 * exactly what shipped for one round: a manager chair labelled `star` beside a
 * hand-typed "+9.4", which is `elite`.
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
import {
  MANAGER_PER_NET_WIN,
  PENNANT_POINTS,
  RING_POINTS,
  WBC_CHAMPION_POINTS,
  WBC_RUNNERUP_POINTS,
} from "../src/lib/scoring";
import { money, posLabel, signed, warTier } from "../src/lib/format";
import { eligibleTypes } from "../src/lib/eligibility";
import { ownerFor } from "../src/lib/data";
import type { CardPlayer, Owners } from "../src/lib/types";

interface CardRow {
  year: number;
  team: string;
  wins: number;
  losses: number;
  manager: string | null;
  park: string;
  attendance: number;
  stadiumMult: number;
  budget: number;
  /** The app's own row type, not a narrowing of it: the utility specimen below
   * runs a card player through `posLabel` and `eligibleTypes`, which read
   * fields (`posG`) a hand-listed subset would have to remember to carry. */
  players: CardPlayer[];
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

/** Every chair the sheet draws, as [class attribute, contents]. A seat holds
 * only `<b>`, `<span>`, `<i>` and `<em>`, so the first closing div or button
 * after one opens is that seat's own.
 *
 * THE SCOPE IS THE POINT. This file's job is to prove a chair's rung is
 * DERIVED from the number beside it, and it used to prove it by finding
 * `war-star` anywhere in the sheet — which worked only while exactly one
 * element on the page could emit a `war-` token. The sheet now draws a rung on
 * five seats across three specimens, so a page-wide search would pass no matter
 * what any single chair wore: an assertion that can no longer fail when the
 * thing it guards breaks. Cutting each chair out and reading ITS class is what
 * keeps the proof honest as specimens are added. */
const SEATS = [
  ...BODY.matchAll(/<(?:div|button) class="((?:cell|mgr)[^"]*)"[^>]*>([\s\S]*?)<\/(?:div|button)>/g),
];
/** Every chair bearing this name — a man can hold two (Maddux sits in the rail
 * and again in the trade picker), and both have to wear his rung. */
const seatsOf = (name: string): string[] =>
  SEATS.filter((m) => m[2].includes(`>${name}<`)).map((m) => m[1]);

/** The extractor above is a regex over rendered markup, so it can DEGRADE
 * silently: give RailSeat a wrapper element and every match truncates at the
 * wrong closing tag, `seatsOf` returns nothing for everybody, and a test whose
 * every assertion is "each seat found wears the right rung" passes over an
 * empty set. Pinning the count is what makes that failure loud instead — nine
 * chairs: five in the rail (the manager plus four seats), two lit by the slot
 * picker, two by the trade picker. A specimen added or removed lands here
 * first, which is the correct place for it to land. */
it("finds every chair the sheet draws", () => {
  expect(SEATS).toHaveLength(9);
});

describe("the help sheet's player specimens", () => {
  /** [club, year, surname, the WAR the sheet prints] — every seat the sheet
   * draws with a name on it, rail and trade picker alike. */
  const SEASONS: [string, number, string, number][] = [
    ["LAD", 1997, "Piazza", 8.7],
    ["ATL", 1995, "Maddux", 10.8],
    ["ATL", 1995, "Smoltz", 4.5],
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
    // The caption's claim, checked on the seat that makes it. `war-star` on an
    // 8.7 is the failure this whole file exists for.
    for (const [, , last, war] of SEASONS) {
      const seats = seatsOf(last);
      expect(seats.length, `${last} has no seat on the sheet`).toBeGreaterThan(0);
      for (const cls of seats) expect(cls, `${last} at ${war}`).toContain(`war-${warTier(war)}`);
    }
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

  it("draws the slot picker over a man who really is eligible at two spots", () => {
    // The specimen claims two things a made-up row could not: that Zobrist's
    // 2009 earned him BOTH the IF and the OF seat, and that the tag over his
    // name is what the game's own `posLabel` makes of those game counts. Both
    // are read back off the card here — a hand-typed "2B/OF" beside a
    // hand-picked pair of lit seats would be the help sheet teaching
    // eligibility wrong, which is the same failure as a hand-picked rung.
    const p = card("TBR", 2009).players.find((x) => surname(x.name) === "Zobrist")!;
    expect(eligibleTypes(p)).toContain("IF");
    expect(eligibleTypes(p)).toContain("OF");
    expect(p.war).toBe(8.6);
    expect(p.cost).toBe(1);
    expect(BODY).toContain(`>${posLabel(p)}<`);
    expect(BODY).toContain(">Ben Zobrist<");
    expect(BODY).toContain(">8.6<");
    expect(BODY).toContain("$1M");
    // Two lit seats and an instruction, which is the screen those two
    // eligibilities actually produce.
    expect(BODY).toContain("↑ PICK A SLOT");
  });
});

describe("the help sheet's manager specimen", () => {
  it("shows Cox's real 1995 record through the engine's own expression", () => {
    const c = card("ATL", 1995);
    expect(c.manager).toBe("Bobby Cox");
    expect([c.wins, c.losses]).toEqual([90, 54]);
    const wins = (c.wins - c.losses) * MANAGER_PER_NET_WIN;
    // The chair's chip prints the signed value bare — no W/WINS unit fits the
    // rail's small rows, and the tag-to-tag match proves nothing rides after it.
    expect(BODY).toContain(`>${signed(wins)}<`);
    // The half that broke: the chair's rung has to be the rung that number
    // earns, not a hand-picked one that looks about right. Read off the chair's
    // own element — see SEATS above for why the page-wide search this replaces
    // could not fail any more.
    expect(seatsOf("Cox")).toEqual([expect.stringContaining(`war-${warTier(wins)}`)]);
    expect(warTier(wins)).toBe("star");
  });
});

describe("the help sheet's front-office specimens", () => {
  const c = card("ATL", 1995);

  it("draws the three tiles off the ATL 1995 card's own figures", () => {
    // Owner budget, park, attendance, multiplier — each read back off the card
    // the sheet claims to be quoting.
    expect(BODY).toContain(money(c.budget));
    expect(BODY).toContain(c.park);
    expect(BODY).toContain(`×${c.stadiumMult.toFixed(2)}`);
    expect(BODY).toContain(`${(c.attendance / 1e6).toFixed(2)}M fans`);
    // The skipper's chip: bare value then the WINS unit, SpecialRows' own
    // shape — a positive drops its plus, the unit says the scale.
    const wins = (c.wins - c.losses) * MANAGER_PER_NET_WIN;
    expect(BODY).toMatch(new RegExp(`class="val[^"]*">${wins.toFixed(1).replace(".", "\\.")}<`));
    expect(BODY).toContain(">WINS<");
  });

  it("names the owner the data held in the chair that year", () => {
    const owners = JSON.parse(fs.readFileSync(path.join(DATA, "owners.json"), "utf8")) as Owners;
    const owner = ownerFor(owners, "ATL", 1995);
    expect(owner).toBe("Ted Turner");
    expect(BODY).toContain(owner);
  });

  it("prices the payroll specimens off the same owner and ballpark", () => {
    // Owner budget × park multiplier, the engine's own expression — the box's
    // headline payroll has to be the product of the two tiles above it.
    expect(BODY).toContain(money(c.budget * c.stadiumMult));
  });
});

describe("the help sheet is a diagram, not a control surface", () => {
  const BUTTONS = [...BODY.matchAll(/<button[^>]*>/g)].map((m) => m[0]);

  it("renders every embedded specimen control inert", () => {
    // The components that render buttons — RailSeat's pickable seats (two lit
    // by the slot picker, two by the trade picker) and SpecialRows' three
    // tiles — all take the specimen flag, which puts the native `inert`
    // attribute on them: no tab stop, no click, no promise of one.
    const specimens = BUTTONS.filter((b) => /class="[^"]*(?:cell|srow)/.test(b));
    expect(specimens).toHaveLength(7);
    for (const b of specimens) expect(b).toContain("inert");
  });

  it("leaves exactly two live buttons: the Sheet's own exits", () => {
    const live = BUTTONS.filter((b) => !b.includes("inert"));
    expect(live).toHaveLength(2); // the corner ✕ and GOT IT
  });
});

describe("the help sheet's scoring copy", () => {
  it("prices each ring-chasing emoji off its own scoring constant", () => {
    const RINGS: [string, number][] = [
      ["💍", RING_POINTS],
      ["🚩", PENNANT_POINTS],
      ["🌐", WBC_CHAMPION_POINTS],
      ["🎌", WBC_RUNNERUP_POINTS],
    ];
    for (const [emo, pts] of RINGS) {
      // The glyph, its label, then its price — read off the rendered row so a
      // retuned constant cannot leave the sheet quoting last round's number.
      const row = new RegExp(`${emo}</span><span class="rlbl[^"]*">[^<]+</span><b class="rpts[^"]*">\\+${pts}<`);
      expect(BODY).toMatch(row);
    }
  });

  it("puts TROPHY CASE above RING CHASING, and uses the game's section device", () => {
    const trophy = BODY.indexOf("TROPHY CASE");
    const rings = BODY.indexOf("RING CHASING");
    expect(trophy).toBeGreaterThan(-1);
    expect(rings).toBeGreaterThan(trophy);
    // Every section header is the board's own .psep dashed-rule device.
    expect(BODY).toContain('class="psep');
    expect(BODY).not.toContain("hsec");
  });

  it("names each data source exactly once", () => {
    for (const src of ["Lahman", "Baseball-Reference", "SABR:", "Wikipedia:"]) {
      const first = BODY.indexOf(src);
      expect(first, `${src} is missing`).toBeGreaterThan(-1);
      expect(BODY.indexOf(src, first + 1), `${src} appears twice`).toBe(-1);
    }
    expect(BODY).toContain("DATA SOURCES");
  });

  it("carries no em dash anywhere in the rendered sheet", () => {
    expect(BODY).not.toContain("—");
  });
});

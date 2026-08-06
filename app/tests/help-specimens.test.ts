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
  BUDGET_BONUS_MAX,
  MANAGER_PER_NET_WIN,
  PENNANT_POINTS,
  RING_POINTS,
  SCOUT_HIT_POINTS,
  WBC_CHAMPION_POINTS,
  WBC_RUNNERUP_POINTS,
  budgetBonus,
  luxuryTax,
  round1,
} from "../src/lib/scoring";
import { slotLabel } from "../src/lib/format";
import { SLOT_TYPES } from "../src/lib/engine.svelte";
import { money, posLabel, signed, statValue, warTier } from "../src/lib/format";
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

/** Every chair the sheet draws, as [class attribute, contents].
 *
 * THE SCOPE IS THE POINT. This file's job is to prove a chair's rung is
 * DERIVED from the number beside it, and it used to prove it by finding
 * `war-star` anywhere in the sheet — which worked only while exactly one
 * element on the page could emit a `war-` token. The sheet draws a rung on
 * several seats at once, so a page-wide search would pass no matter what any
 * single chair wore: an assertion that can no longer fail when the thing it
 * guards breaks. Cutting each chair out and reading ITS class is what keeps
 * the proof honest as specimens are added.
 *
 * The cut COUNTS TAGS rather than stopping at the first `</div>`. It used to
 * stop at the first one, on the reading that a seat holds only `<b>`, `<span>`,
 * `<i>` and `<em>` — and the moment RailSeat wrapped the manager's chip in a
 * `.mhead` div, the manager's chair truncated to that wrapper and `seatsOf`
 * lost him silently. Balancing the tags means a seat can hold whatever
 * RailSeat needs it to. */
const SEATS: [string, string][] = [...BODY.matchAll(/<(?:div|button) class="((?:cell|mgr)[^"]*)"[^>]*>/g)].map(
  (m) => {
    const start = m.index + m[0].length;
    const step = /<(\/?)(?:div|button)\b[^>]*>/g;
    step.lastIndex = start;
    let depth = 1;
    let end = BODY.length;
    for (let s = step.exec(BODY); s; s = step.exec(BODY)) {
      depth += s[1] ? -1 : 1;
      if (depth === 0) {
        end = s.index;
        break;
      }
    }
    return [m[1], BODY.slice(start, end)];
  },
);
/** Every chair bearing this name — a man could hold more than one, and all of
 * them have to wear his rung. */
const seatsOf = (name: string): string[] =>
  SEATS.filter(([, inner]) => inner.includes(`>${name}<`)).map(([cls]) => cls);

/** The extractor above is a regex over rendered markup, so it can DEGRADE
 * silently: give RailSeat a wrapper element and every match truncates at the
 * wrong closing tag, `seatsOf` returns nothing for everybody, and a test whose
 * every assertion is "each seat found wears the right rung" passes over an
 * empty set. Pinning the count is what makes that failure loud instead — twelve
 * chairs: nine in the rail (the manager plus the full eight player seats) and
 * three lit by the slot picker (IF, OF, and the UTIL seat the multi-group rule
 * pools with them). A specimen added or removed lands here first. */
it("finds every chair the sheet draws", () => {
  expect(SEATS).toHaveLength(12);
});

describe("the help sheet's player specimens", () => {
  /** [club, year, surname, the WAR the sheet prints] — every seat the sheet
   * draws with a name on it. */
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
    // The caption's claim, checked on the seat that makes it. `war-star` on an
    // 8.7 is the failure this whole file exists for. `seatsOf` returns every
    // chair bearing the name, since one man may hold more than one.
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
    // Three lit seats and an instruction, which is the screen those two
    // eligibilities actually produce: the multi-group rule (engine
    // `pickableSlotCells`) pools UTIL with the specialist seats. The arrow
    // is its own span with the market's 4px margin, not a character inside
    // the label, so the pin reads the two parts separately.
    expect(BODY).toMatch(/class="[^"]*\bph\b[^"]*"[^>]*>↑</);
    expect(BODY).toContain(">WHAT SLOT?<");
  });
});

describe("the help sheet's manager specimen", () => {
  it("shows Cox's real 1995 record through the engine's own expression", () => {
    const c = card("ATL", 1995);
    expect(c.manager).toBe("Bobby Cox");
    expect([c.wins, c.losses]).toEqual([90, 54]);
    const wins = (c.wins - c.losses) * MANAGER_PER_NET_WIN;
    // The chair's chip prints the value the way the live rail does: positive
    // bare, negative keeping its minus (statValue) — no W/WINS unit fits the
    // rail's small rows, and the tag-to-tag match proves nothing rides after it.
    expect(BODY).toContain(`>${statValue(wins)}<`);
    // The half that broke: the chair's rung has to be the rung that number
    // earns, not a hand-picked one that looks about right. Read off the chair's
    // own element — see SEATS above for why the page-wide search this replaces
    // could not fail any more.
    expect(seatsOf("Cox")).toEqual([expect.stringContaining(`war-${warTier(wins)}`)]);
    expect(warTier(wins)).toBe("star");
  });

  it("renders the WAR chip inside the manager's chair", () => {
    // The chip gates on `war` being truthy in RailSeat — `war={statValue(wins)}`
    // = "7.2" satisfies that. This test pins it scoped to the manager's own
    // chair element, not the page as a whole, because `rwar warchip sm` also
    // appears on filled player seats (Piazza, Maddux).
    const mgrSeat = SEATS.find(([cls]) => cls.startsWith("mgr"));
    expect(mgrSeat, "manager chair not found in SEATS").toBeDefined();
    // Svelte appends a scoping hash to class names in SSR, so check for the
    // class-name substring rather than the exact attribute value.
    expect(mgrSeat![1]).toContain('rwar warchip sm');
  });

  it("orders the player-row specimen salary-then-WAR, the way the market does", () => {
    // The specimen is HelpModal's own markup, not PlayerList — it CAN drift.
    // Round 28 put the WAR chip far right on real market rows; a sheet still
    // teaching WAR-then-salary is teaching a row that no longer exists.
    const row = BODY.slice(BODY.indexOf("Pedro Martínez"), BODY.indexOf("Pedro Martínez") + 600);
    const cost = row.indexOf('class="cost');
    const war = row.indexOf('class="warchip');
    expect(cost).toBeGreaterThan(-1);
    expect(war).toBeGreaterThan(-1);
    expect(cost).toBeLessThan(war);
  });

  it("spaces the specimen's price column exactly as the market does", () => {
    // Same drift risk as the order test above, for the row's geometry: the
    // market's `.right` holds a 10px salary↔chip gap and stops the chip at
    // the row's full padding (the chip inset rule is retired).
    // Source-text on both files because jsdom computes no layout.
    const read = (f: string) =>
      fs.readFileSync(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../src/components/${f}`),
        "utf8",
      );
    // MarketRow carries the market's own `.right` (the help specimen and
    // PlayerList both render it, so drift is impossible by construction);
    // HelpModal keeps a geometry-only copy for its paint-stripped legend, and
    // PrimePicker its own market-twin — both must keep matching.
    for (const f of ["HelpModal.svelte", "MarketRow.svelte", "PrimePicker.svelte"]) {
      // The base rule is the one anchoring the column (`margin-left: auto`);
      // matching bare `.right {` could land on a media-tier override instead.
      const right = read(f).match(/\.right \{[^}]*margin-left: auto[^}]*\}/)?.[0] ?? "";
      expect(right, `${f} .right gap`).toContain("gap: 10px");
      // The retired inset must not creep back into the copy: a specimen that
      // pulls its chip teaches a row the market no longer draws.
      expect(right, `${f} .right inset retired`).not.toContain("margin-right: -");
    }
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
    // The components that render buttons — RailSeat's three pickable seats,
    // lit by the slot picker, and SpecialRows' three tiles — all take the
    // specimen flag, which puts the native `inert` attribute on them: no tab
    // stop, no click, no promise of one.
    const specimens = BUTTONS.filter((b) => /class="[^"]*(?:cell|srow)/.test(b));
    expect(specimens).toHaveLength(6);
    for (const b of specimens) expect(b).toContain("inert");
  });

  it("leaves exactly two live buttons: the Sheet's own exits", () => {
    const live = BUTTONS.filter((b) => !b.includes("inert"));
    expect(live).toHaveLength(2); // the corner ✕ and GOT IT
  });
});

describe("the help sheet's scoring copy", () => {
  it("prices each ring-chasing emoji off its own scoring constant", () => {
    // 🌐 → 🥇, 🎌 → 🥈: WBC markers switched to medal emojis this round.
    // Keep the row-scoped regex — 🥇 also appears on AwardPill MVP pills, so
    // a page-wide toContain("🥇") would be satisfied by the trophy-case copy.
    const RINGS: [string, number][] = [
      ["💍", RING_POINTS],
      ["🚩", PENNANT_POINTS],
      ["🥇", WBC_CHAMPION_POINTS],
      ["🥈", WBC_RUNNERUP_POINTS],
    ];
    for (const [emo, pts] of RINGS) {
      // The glyph, its label, then its price — read off the rendered row so a
      // retuned constant cannot leave the sheet quoting last round's number.
      const row = new RegExp(`${emo}</span><span class="rlbl[^"]*">[^<]+</span><b class="rpts[^"]*">\\+${pts}<`);
      expect(BODY).toMatch(row);
    }
  });

  /** The sheet's outline, read off the rendered headers: [title, nested?].
   * Every header on the sheet is the board's own .psep dashed-rule device, and
   * a subsection is that device with a `sub` modifier — there is no header
   * class private to this file (`hsec`, the one there used to be, is asserted
   * gone below). */
  const OUTLINE = [...BODY.matchAll(/<div class="psep([^"]*)"[^>]*>([^<]+)<\/div>/g)].map(
    (m): [string, boolean] => [m[2].trim(), / sub\b| sub /.test(` ${m[1]} `)],
  );

  it("nests the five scoring subsections under SCORING and nothing else", () => {
    // The whole outline, in order, at its levels. Pinned rather than spot
    // checked: the point of the restructure is that TROPHY CASE and RING
    // CHASING stopped being sections of their own, and only a full reading
    // can show that no sixth level or stray top-level heading crept back.
    // OVERVIEW opens the sheet — it names the intro list without repeating
    // the title the way the old HOW TO PLAY rule did.
    expect(OUTLINE).toEqual([
      ["OVERVIEW", false],
      ["A PLAYER ROW", false],
      ["YOUR SQUAD", false],
      ["FRONT OFFICE", false],
      ["YOUR PAYROLL", false],
      ["BALL KNOWLEDGE", false],
      ["POWERUPS · ONE USE EACH", false],
      ["SCORING", false],
      ["WINS", true],
      ["PAYROLL BONUS", true],
      ["SCOUTING", true],
      ["TROPHY CASE", true],
      ["RING CHASING", true],
      ["DATA SOURCES", false],
    ]);
    expect(BODY).not.toContain("hsec");
    expect(BODY).not.toContain(">THE LOOP<");
  });

  it("prices the payroll meters off the game's own bonus and tax", () => {
    // Four fills of PayrollBox's `mini` bar against the ATL 1995 payroll —
    // the full arc a payroll can travel: gold below half, green from there to
    // the cap, orange past it. The figure beside each is what the game awards,
    // computed the same way the component does — a hand-typed value is the
    // payroll half of the invented-WAR failure this file exists for.
    const c = card("ATL", 1995);
    const budget = c.budget * c.stadiumMult;
    // Verify the four spend levels produce the expected tier.
    expect(budgetBonus(40, budget)).toBeLessThan(0);    // 39% → negative (−2.1)
    expect(budgetBonus(76, budget)).toBeGreaterThan(0); // 75% → positive (+5.0)
    expect(budgetBonus(96.5, budget)).toBeGreaterThan(0); // 95% → positive (+9.0)
    expect(111).toBeGreaterThan(budget);                // 109% → the luxury tax
    // All four rendered on the sheet — the over row shows the TAX, negated.
    expect(BODY).toContain(`>${signed(round1(budgetBonus(40, budget)))}<`);   // −2.1
    expect(BODY).toContain(`>${signed(round1(budgetBonus(76, budget)))}<`);   // +5.0
    expect(BODY).toContain(`>${signed(round1(budgetBonus(96.5, budget)))}<`); // +9.0
    expect(BODY).toContain(`>${signed(-round1(luxuryTax(111, budget)))}<`);   // −9.4
    // Four mini meters wearing the arc's own states: exactly one gold (below
    // break-even) and exactly one orange (over the cap) — the sheet shows the
    // real component in the real states the live board and the finale ledger
    // show them in.
    const meters = [...BODY.matchAll(/<div class="pmeter[^"]*"/g)].map((m) => m[0]);
    expect(meters.filter((m) => m.includes("mini"))).toHaveLength(4);
    expect(meters.filter((m) => m.includes("mini") && m.includes("pover"))).toHaveLength(1);
    expect(meters.filter((m) => m.includes("mini") && m.includes("plow"))).toHaveLength(1);
  });

  it("prices the scouting stars off SCOUT_HIT_POINTS and counts them off the seats", () => {
    // One ⭐ per find, the finale's own chip. The ceiling the copy quotes is
    // every seat plus the skipper — the owner and the ballpark are not
    // scoutable (bestroster.ts counts players and the skipper only).
    // Read the run off its own element: ⭐ is also the PRIMETIME powerup's
    // glyph, twice, so a page-wide count of the star would price the row
    // against a number nothing on the sheet shows.
    const run = BODY.match(/<span class="semo[^"]*">(⭐+)<\/span>/);
    expect(run, "no scouting star run on the sheet").not.toBeNull();
    const hits = [...run![1]].length;
    expect(hits).toBeGreaterThan(0);
    expect(hits).toBeLessThanOrEqual(SLOT_TYPES.length + 1);
    expect(BODY).toMatch(
      new RegExp(`<b class="spts[^"]*">\\+${round1(hits * SCOUT_HIT_POINTS)}<`),
    );
    expect(BODY).toContain(`up to ${SLOT_TYPES.length + 1}`);
    expect(BODY).toContain(`worth +${SCOUT_HIT_POINTS}`);
  });

  it("draws no mocked-up screenshot of a powerup mid-use", () => {
    // The POWERUPS section is the pill table and the two spent/off pills, and
    // that is all: the 🔁 two-tap mock taught nothing its own table row did
    // not already say. Its instruction pill is the tell.
    expect(BODY).not.toContain("WHO GOES?");
    // The slot picker's is the sheet's one remaining instruction pill.
    expect(BODY).toContain(">WHAT SLOT?<");
  });

  it("removes the armed sample pills from the POWERUPS table", () => {
    // The resting pill and the copy are enough. The armed state (orange,
    // dashed) in mid-use added no information the resting pill + copy did not
    // already carry, and removing it shortens the table significantly.
    // The prose descriptions contain "PICK TWO" etc. WITHOUT the emoji;
    // the armed pill labels carry the emoji prefix — only those are gone.
    expect(BODY).not.toContain("✌️ PICK TWO");
    expect(BODY).not.toContain("🔁 TAP A TRADE");
    expect(BODY).not.toContain("⭐ TAP A PLAYER");
    expect(BODY).not.toContain("🏠 SIGN AT $1M");
  });

  it("uses WINS as the first scoring subsection with the formula grid", () => {
    // WINS is now a .psep.sub heading, making the outline five subsections.
    // The replacement baseline and the cap constant must both appear.
    const winsIdx = BODY.indexOf('>WINS<');
    expect(winsIdx, "no WINS subsection heading").toBeGreaterThan(-1);
    const payrollIdx = BODY.indexOf('>PAYROLL BONUS<');
    expect(winsIdx).toBeLessThan(payrollIdx);
    // The formula grid content — all four rows visible.
    expect(BODY).toContain(">+WAR<");
    expect(BODY).toContain(">+MGR<");
    // No old single-bullet wins prose
    expect(BODY).not.toContain("That is your record, and the rest of this section");
  });

  it("shows percentages inline with the mini bar, with no 'of payroll' wording", () => {
    // The spend dollar figures never appear — only percentages and point totals.
    expect(BODY).not.toContain("$40M");
    expect(BODY).not.toContain("of payroll");
    // Percentage signs appear in the meter labels.
    expect(BODY).toContain("%");
    // Four mini bars — three under budget, one past the cap.
    const meters = [...BODY.matchAll(/<div class="pmeter[^"]*"/g)].map((m) => m[0]);
    expect(meters.filter((m) => m.includes("mini"))).toHaveLength(4);
    // The 95% example (spend=96.5) is present and shows its bonus.
    const c = card("ATL", 1995);
    const budget = c.budget * c.stadiumMult;
    expect(BODY).toContain(`>${signed(round1(budgetBonus(96.5, budget)))}<`);
    expect(BODY).toContain("95%");
  });

  it("shows the HOW TO PLAY heading and position badges for each seat type", () => {
    // Section renamed from THE LOOP.
    expect(BODY).toContain('>HOW TO PLAY<');
    // The slot-badges div holds one chip per slot plus MGR.
    // Svelte appends a scoping hash to class names in SSR output, so match
    // on the class name string rather than the exact attribute value.
    expect(BODY).toContain('slot-badges');
    // Extract the badges div content (children are <span>s, no inner </div>).
    const badgesMarker = BODY.indexOf('slot-badges');
    const divOpen = BODY.lastIndexOf('<div', badgesMarker);
    const divClose = BODY.indexOf('</div>', badgesMarker);
    const badgesHtml = BODY.slice(divOpen, divClose);
    // Every unique slot label appears as a position chip inside the div.
    for (const slot of SLOT_TYPES) {
      expect(badgesHtml, `slot "${slot}" missing from badges`).toContain(`>${slotLabel(slot)}<`);
    }
    // MGR badge rounds out the nine seats.
    expect(badgesHtml).toContain(">MGR<");
  });

  it("consolidates body prose to 12px, keeping chip/ledger sizes as-is", () => {
    // Read the scoped style block out of the component source — SSR gives HTML,
    // not computed styles. The consolidation merged .cap (was 11px) into the
    // same 12px as li and .ptxt. Chip and ledger typography (.ledger at 11px,
    // .lgnd .lt and .klbl at 8.5px) is explicitly kept at its own size.
    const src = fs.readFileSync(
      path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../src/components/HelpModal.svelte"),
      "utf8",
    );
    const styleBlock = src.match(/<style>([\s\S]*?)<\/style>/);
    expect(styleBlock, "no <style> block found").not.toBeNull();
    const style = styleBlock![1];
    // .cap must now carry 12px — the merge from 11px into the prose register.
    expect(style).toMatch(/\.cap\s*\{[^}]*font-size:\s*12px/);
    // .cap must NOT still carry 11px (would mean the edit was not applied).
    expect(style).not.toMatch(/\.cap\s*\{[^}]*font-size:\s*11px/);
    // The credits read in the body's own register now — the 11px muted
    // override read as broken styling under its own full-size heading, so the
    // rule is gone entirely and the list inherits li's 12px ink.
    expect(style).not.toMatch(/\.src\s+li\s*\{/);
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

describe("the help sheet's position chip updates (round 1.0.0)", () => {
  /** The slot-badges HTML: from the opening <div class="slot-badges"> to its
   * closing </div>. Inner elements are <span>s, so the first </div> after the
   * class marker closes the container itself, not a nested div. */
  const badgesMarker = BODY.indexOf("slot-badges");
  const badgesOpen = BODY.lastIndexOf("<div", badgesMarker);
  const badgesClose = BODY.indexOf("</div>", badgesMarker);
  const BADGES_HTML = BODY.slice(badgesOpen, badgesClose);

  /** All .pos chip spans in the badge row, as [label, classAttr] pairs.
   * Uses <span class=...> rather than a pos-substring filter so Svelte SSR
   * comment markers (<!--[-->, <!--]--> ) don't confuse the extractor.
   * The \bpos\b word-boundary test keeps sbadge and scnt spans out. */
  const posChips = [...BADGES_HTML.matchAll(/<span class="([^"]+)"[^>]*>([^<]+)</g)]
    .filter(([, cls]) => /\bpos\b/.test(cls))
    .map((m): [string, string] => [m[2].trim(), m[1]]);
  const chipMap = new Map(posChips);

  it("shows SP and RP chips with the pit (inverted) class", () => {
    // Market rows mark pitchers with an ink fill (.pos.pit); the seat
    // badges must match so the help sheet doesn't teach a different visual.
    // Svelte SSR: class="svelte-HASH pit" — match word boundary, not prefix.
    expect(chipMap.has("SP"), "SP chip not in slot-badges").toBe(true);
    expect(chipMap.get("SP")).toMatch(/\bpit\b/);
    expect(chipMap.has("RP"), "RP chip not in slot-badges").toBe(true);
    expect(chipMap.get("RP")).toMatch(/\bpit\b/);
    // Position-player seats must NOT be inverted.
    expect(chipMap.get("C"), "C chip not in slot-badges").toBeDefined();
    expect(chipMap.get("C")).not.toMatch(/\bpit\b/);
    expect(chipMap.get("IF"), "IF chip not in slot-badges").toBeDefined();
    expect(chipMap.get("IF")).not.toMatch(/\bpit\b/);
  });

  it("shows one IF chip with a ×2 count rather than two IF chips", () => {
    // One chip + a count beside it reads more cleanly than two separate chips
    // for the same seat. SEAT_BADGE_RUNS collapses duplicate labels.
    const ifChips = posChips.filter(([label]) => label === "IF");
    expect(ifChips).toHaveLength(1); // collapsed from two SLOT_TYPES entries
    // The ×2 count sits in an .scnt span beside the IF chip.
    expect(BADGES_HTML).toContain("×2");
    // SP is also collapsed (two SP slots → one chip + ×2).
    const spChips = posChips.filter(([label]) => label === "SP");
    expect(spChips).toHaveLength(1);
  });

  it("labels the negative bonus example with the mneg (red) class", () => {
    // spend=40 → bonus −2.1, which is negative. The mneg class drives
    // --red-8 coloring to show the bar is actively costing points.
    // Svelte SSR places the scope hash before the component class, so
    // class="svelte-HASH mneg" — match the word boundary, not the start.
    const c = card("ATL", 1995);
    const budget = c.budget * c.stadiumMult;
    const negVal = signed(round1(budgetBonus(40, budget))); // "−2.1"
    expect(BODY, `negative bonus value "${negVal}" not on sheet`).toContain(`>${negVal}<`);
    // Find the <b> element carrying the mneg class (scope hash may precede it).
    const mnegEl = BODY.match(/<b class="[^"]*\bmneg\b[^"]*"[^>]*>([^<]+)<\/b>/);
    expect(mnegEl, "no <b class=...mneg...> element found").not.toBeNull();
    expect(mnegEl![1], "mneg element does not contain the negative bonus value").toBe(negVal);
  });

  it("shows a 95% example with a large positive bonus", () => {
    // spend=96.5 → 95% of ATL 1995 payroll → +9.0 PTS.
    const c = card("ATL", 1995);
    const budget = c.budget * c.stadiumMult;
    const highBonus = signed(round1(budgetBonus(96.5, budget))); // "+9.0"
    expect(BODY).toContain("95%");
    expect(BODY).toContain(`>${highBonus}<`);
    // The max bonus is BUDGET_BONUS_MAX; 95% earns close to it (9.0 vs 10.0).
    expect(round1(budgetBonus(96.5, budget))).toBeGreaterThan(BUDGET_BONUS_MAX * 0.85);
  });
});

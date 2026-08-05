import { describe, expect, it } from "vitest";
import index from "../../data/index.json";
import { DIVISIONS, divisionsForYear, pickerCols, splitDivision } from "../src/lib/divisions";
import type { IndexEntry } from "../src/lib/types";

const cards = (index as { cards: IndexEntry[] }).cards;
const rowsFor = (year: number) =>
  cards.filter((c) => c.year === year).sort((a, b) => a.name.localeCompare(b.name));
const labelOf = (year: number, team: string) =>
  divisionsForYear(rowsFor(year)).find((d) => d.teams.some((t) => t.team === team))?.label;

describe("pickerCols", () => {
  // One column count for the whole picker keeps every team tile the same
  // width regardless of division size.
  it("uses the widest division when no division reaches seven", () => {
    expect(pickerCols([5, 5, 4, 5, 6, 5])).toBe(6); // 2002 shape
    expect(pickerCols([5, 5, 5, 5, 5, 5])).toBe(5); // modern shape
    expect(pickerCols([4, 4])).toBe(4);
  });

  it("drops to four columns when a seven-team division appears", () => {
    expect(pickerCols([7, 7, 6, 6])).toBe(4); // 1985–1992 shape
    expect(pickerCols([7, 7, 7, 7])).toBe(4); // 1993 shape
  });
});

describe("splitDivision", () => {
  // Plain string arrays keep the helper generic; the flat() invariant catches
  // an off-by-one at the slice boundary in addition to verifying the shape.
  const teams = (n: number) => Array.from({ length: n }, (_, i) => String(i));

  it("5 teams at 5 cols → one row, order preserved", () => {
    const t = teams(5);
    const rows = splitDivision(t, 5);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(5);
    expect(rows.flat()).toEqual(t);
  });

  it("6 teams at 6 cols → one row (a 6-max season never chunks)", () => {
    const t = teams(6);
    const rows = splitDivision(t, 6);
    expect(rows).toHaveLength(1);
    expect(rows.flat()).toEqual(t);
  });

  it("6 teams at 4 cols → 4+2, order preserved", () => {
    const t = teams(6);
    const rows = splitDivision(t, 4);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(4);
    expect(rows[1]).toHaveLength(2);
    expect(rows.flat()).toEqual(t);
  });

  it("7 teams at 4 cols → 4+3, order preserved", () => {
    const t = teams(7);
    const rows = splitDivision(t, 4);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(4);
    expect(rows[1]).toHaveLength(3);
    expect(rows.flat()).toEqual(t);
  });
});

describe("fallback division map", () => {
  const mapped = DIVISIONS.flatMap((d) => d.franchises);

  it("covers every franchise in the card index exactly once", () => {
    const inData = new Set(cards.map((e) => e.franchise));
    expect(new Set(mapped)).toEqual(inData);
    expect(mapped.length).toBe(inData.size);
  });

  it("is six divisions of five", () => {
    expect(DIVISIONS).toHaveLength(6);
    for (const d of DIVISIONS) expect(d.franchises).toHaveLength(5);
  });
});

describe("era-correct divisions (lg/div from index rows)", () => {
  it("every index row carries lg and div", () => {
    for (const c of cards) {
      expect(c.lg, `${c.team} ${c.year} lg`).toMatch(/^(AL|NL)$/);
      expect(c.div, `${c.team} ${c.year} div`).toMatch(/^[ECW]$/);
    }
  });

  it("groups every team of the year exactly once", () => {
    for (const year of [1985, 1990, 1994, 2013, 2025]) {
      const rows = rowsFor(year);
      const grouped = divisionsForYear(rows).flatMap((d) => d.teams);
      expect(grouped).toHaveLength(rows.length);
      expect(new Set(grouped.map((t) => t.team)).size).toBe(rows.length);
    }
  });

  it("1990: four divisions, no Central, Houston in the NL West", () => {
    const groups = divisionsForYear(rowsFor(1990));
    expect(groups.map((d) => d.label)).toEqual(["AL EAST", "AL WEST", "NL EAST", "NL WEST"]);
    expect(labelOf(1990, "HOU")).toBe("NL WEST");
  });

  it("2015: Houston is AL West, six divisions", () => {
    expect(labelOf(2015, "HOU")).toBe("AL WEST");
    expect(divisionsForYear(rowsFor(2015))).toHaveLength(6);
  });

  it("1997: Milwaukee is AL (Central); 1998+: NL", () => {
    expect(labelOf(1997, "MIL")).toBe("AL CENTRAL");
    expect(labelOf(1998, "MIL")).toBe("NL CENTRAL");
  });

  it("2025: thirty clubs in six divisions, Dodgers NL West", () => {
    const rows = rowsFor(2025);
    expect(rows).toHaveLength(30);
    expect(divisionsForYear(rows)).toHaveLength(6);
    expect(labelOf(2025, "LAD")).toBe("NL WEST");
  });

  it("falls back to the current-division map when rows lack lg/div", () => {
    const stripped = rowsFor(2015).map(({ lg: _lg, div: _div, ...rest }) => rest as IndexEntry);
    const groups = divisionsForYear(stripped);
    expect(groups.map((d) => d.label)).toEqual(DIVISIONS.map((d) => d.label));
    // The fallback map is present-day: Houston lands in AL WEST there too.
    expect(groups.find((d) => d.label === "AL WEST")?.teams.some((t) => t.team === "HOU")).toBe(
      true,
    );
  });
});

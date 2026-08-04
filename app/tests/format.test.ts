import { describe, expect, it } from "vitest";
import { localDateStamp, parseSeedCode, posLabel, seedCode, slotLabel, sortAwards, warTier } from "../src/lib/format";
import type { CardPlayer } from "../src/lib/types";

describe("warTier", () => {
  it("buckets the six-rung ladder at 0/2/4/6/8", () => {
    expect(warTier(-0.1)).toBe("neg");
    expect(warTier(0)).toBe("low");
    expect(warTier(1.9)).toBe("low");
    expect(warTier(2)).toBe("mid");
    expect(warTier(3.9)).toBe("mid");
    expect(warTier(4)).toBe("high");
    expect(warTier(5.9)).toBe("high");
    expect(warTier(6)).toBe("star");
    expect(warTier(7.9)).toBe("star");
    expect(warTier(8)).toBe("elite");
    expect(warTier(11.9)).toBe("elite");
  });
});

describe("posLabel", () => {
  const player = (pos: string, posG: { c: number; if: number; of: number; dh: number }) =>
    ({ pos, posG }) as CardPlayer;
  const G = (c = 0, ifG = 0, of = 0, dh = 0) => ({ c, if: ifG, of, dh });

  it("passes two-way seasons through whole", () => {
    expect(posLabel(player("SP/DH", G(0, 0, 7, 126)))).toBe("SP/DH");
  });

  it("keeps pure pitchers bare", () => {
    expect(posLabel(player("SP", G()))).toBe("SP");
    expect(posLabel(player("RP", G()))).toBe("RP");
  });

  it("appends extra specialist groups earned by games (10+)", () => {
    expect(posLabel(player("2B", G(0, 100, 12)))).toBe("2B/OF");
    expect(posLabel(player("C", G(90, 15, 0)))).toBe("C/IF");
    expect(posLabel(player("LF", G(0, 30, 100)))).toBe("LF/IF");
    expect(posLabel(player("C", G(80, 12, 11)))).toBe("C/IF/OF");
  });

  it("does not list a group the primary position already implies", () => {
    expect(posLabel(player("2B", G(0, 150, 9)))).toBe("2B");
    expect(posLabel(player("CF", G(0, 0, 140)))).toBe("CF");
  });

  it("DH implies no specialist group; earned groups still append", () => {
    expect(posLabel(player("DH", G(0, 0, 0, 140)))).toBe("DH");
    expect(posLabel(player("DH", G(0, 10, 0, 120)))).toBe("DH/IF");
  });
});

describe("sortAwards", () => {
  it("orders the full ladder: MVP ballot, CY ballot, ROY, GG, SS, AS", () => {
    expect(sortAwards(["AS", "SS", "GG", "ROY", "CY3", "CY2", "CY", "MVP3", "MVP2", "MVP"]))
      .toEqual(["MVP", "MVP2", "MVP3", "CY", "CY2", "CY3", "ROY", "GG", "SS", "AS"]);
  });

  it("All-Star never appears before a Cy Young ballot medal", () => {
    expect(sortAwards(["AS", "CY3"])).toEqual(["CY3", "AS"]);
    expect(sortAwards(["AS", "GG", "CY2"])).toEqual(["CY2", "GG", "AS"]);
  });

  it("unknown codes sort last, in their original order", () => {
    expect(sortAwards(["MYSTERY", "AS", "OTHER", "MVP"])).toEqual([
      "MVP",
      "AS",
      "MYSTERY",
      "OTHER",
    ]);
  });

  it("does not mutate its input", () => {
    const input = ["AS", "MVP"];
    sortAwards(input);
    expect(input).toEqual(["AS", "MVP"]);
  });
});

describe("slotLabel", () => {
  it("renders the FLEX slot key as UTIL and leaves every other key alone", () => {
    expect(slotLabel("FLEX")).toBe("UTIL");
    for (const s of ["C", "IF", "OF", "SP", "RP"]) expect(slotLabel(s)).toBe(s);
  });
});

describe("seedCode / parseSeedCode", () => {
  it("round-trips the uint32 seed range", () => {
    for (const s of [0, 1, 42, 0x7fffffff, 0xfffffffe, 0xffffffff]) {
      expect(parseSeedCode(seedCode(s))).toBe(s);
    }
    expect(seedCode(0xffffffff)).toBe("1Z141Z3"); // 7 chars max
  });

  it("accepts lowercase, whitespace, and a leading #", () => {
    expect(parseSeedCode(" #k7x2a9 ")).toBe(parseSeedCode("K7X2A9"));
  });

  it("rejects garbage", () => {
    for (const bad of ["", "  ", "#", "NOT A SEED", "12345678", "ZZZZZZZ", "1Z141Z4", "-5", "3.5"]) {
      expect(parseSeedCode(bad)).toBeNull();
    }
  });
});

describe("localDateStamp", () => {
  it("stamps the player's own calendar day, not Greenwich's", () => {
    // 11:30pm local on Aug 3. In any timezone west of UTC, toISOString()
    // already says Aug 4 — the bug this helper exists to prevent. The stamp
    // must come from the LOCAL components regardless of offset.
    const lateNight = new Date(2026, 7, 3, 23, 30);
    expect(localDateStamp(lateNight)).toBe("2026-08-03");
  });

  it("pads single-digit months and days", () => {
    expect(localDateStamp(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

import { describe, expect, it } from "vitest";
import { parseSeedCode, seedCode, slotLabel, sortAwards } from "../src/lib/format";

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

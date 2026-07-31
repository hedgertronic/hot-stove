import { describe, expect, it } from "vitest";
import index from "../../data/index.json";
import { DIVISIONS } from "../src/lib/divisions";

describe("division map", () => {
  const mapped = DIVISIONS.flatMap((d) => d.franchises);

  it("covers every franchise in the card index exactly once", () => {
    const entries = (index as { franchise: string }[] | { cards: { franchise: string }[] });
    const list = Array.isArray(entries) ? entries : entries.cards;
    const inData = new Set(list.map((e) => e.franchise));
    expect(new Set(mapped)).toEqual(inData);
    expect(mapped.length).toBe(inData.size);
  });

  it("is six divisions of five", () => {
    expect(DIVISIONS).toHaveLength(6);
    for (const d of DIVISIONS) expect(d.franchises).toHaveLength(5);
  });
});

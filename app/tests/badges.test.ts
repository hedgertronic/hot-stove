import fs from "node:fs";
import { fileURLToPath } from "node:url";
/** Unit pins for every badge trigger (src/lib/badges).
 *
 * Facts are forged here rather than played out through the engine: a trigger
 * is a pure function of the fact set, and a test that had to reach 116 wins
 * through real spins could only pin the rungs a bot happens to hit. The
 * companion file badges-supply.test.ts pins the DATA the named rungs stand
 * on — this file assumes those totals and checks the arithmetic over them.
 *
 * The exclusive axes are the load-bearing property. A finale renders at most
 * four pills, so two on-field rungs firing at once does not merely look odd —
 * it costs a slot a real badge was going to use.
 */
import { describe, expect, it } from "vitest";
import {
  BADGES,
  BROTHERS,
  FATHER_SON,
  BADGE_BY_KEY,
  COLLECTIBLE,
  CROWN_WINS,
  HUNDRED_WINS,
  MATCHED,
  RARITY_ORDER,
  WORST_WINS,
  badgeEmoji,
  earnedBadges,
  onFieldBadge,
  type BadgeFacts,
  type BadgeRosterEntry,
} from "../src/lib/badges";
import { GAMES } from "../src/lib/scoring";

/** A season that earns nothing: .500, two thirds of a comfortable payroll
 * spent, a middling bonus, no roster at all. Every test overrides only the
 * facts it is about, so a badge that appears is a badge that fired. */
const BASE: BadgeFacts = {
  baselineWins: 81,
  baselineLosses: 81,
  total: 100,
  spendM: 100,
  budgetM: 140,
  budgetBonus: 4,
  scoutHits: 2,
  roster: [],
  managerTeam: null,
  managerYear: null,
  managerName: null,
  rings: 0,
  awardPoints: 10,
  managerMoty: false,
  owner: null,
  stadium: null,
  divisions: [],
  // A real game always offers all six, and the default season has spent none —
  // which is 🧗's condition minus its 100-win gate, so the handicap badge is
  // one override away in either direction.
  powerups: { spent: 0, total: 6 },
};

const f = (over: Partial<BadgeFacts> = {}): BadgeFacts => ({
  ...BASE,
  ...over,
});

/** A finished club, one entry per filled slot. */
const player = (over: Partial<BadgeRosterEntry> = {}): BadgeRosterEntry => ({
  id: "someguy01",
  name: "Some Guy",
  war: 3.0,
  awards: [],
  year: 2004,
  team: "BOS",
  pos: "SS",
  franchise: "BOS",
  costPaid: 8,
  hero: false,
  age: 28,
  ...over,
});
const club = (n: number, over: Partial<BadgeRosterEntry> = {}) =>
  Array.from({ length: n }, () => player(over));

const ONFIELD = BADGES.filter((b) => b.axis === "onfield").map((b) => b.key);
const PAYROLL = BADGES.filter((b) => b.axis === "payroll").map((b) => b.key);
const only = (keys: string[], axis: string[]) =>
  keys.filter((k) => axis.includes(k));

/** The on-field ladder written out as prose, top to bottom, independent of the
 * else-if chain earnedBadges resolves through. The sweep below compares the two
 * at every win total a season can post, so a reordered chain — 💀 promoted
 * above 📉, say — has something to disagree with rather than merely staying
 * "at most one badge" and passing. */
function ladderAt(wins: number): string[] {
  if (wins >= CROWN_WINS) return ["crown"];
  if (MATCHED[wins]) return [MATCHED[wins]];
  if (wins >= HUNDRED_WINS) return ["hundred"];
  if (wins <= 0) return ["dayjob"];
  if (wins <= WORST_WINS) return ["worst"];
  if (GAMES - wins >= 100) return ["skull"];
  return [];
}

describe("the badge table itself", () => {
  it("defines every badge its own triggers can emit", () => {
    // The failure this pins is silent: `earnedBadges` pushes a key, nothing
    // defines it, and every surface drops it on the BADGE_BY_KEY lookup — no
    // error, no pill, no share emoji, no trophy slot. Four badges shipped this
    // way once. Read the trigger source rather than a hand-kept list, so a new
    // push() with no BadgeDef fails here instead of in someone's finale.
    const src = fs.readFileSync(
      fileURLToPath(new URL("../src/lib/badges.ts", import.meta.url)),
      "utf8",
    );
    const emitted = [...src.matchAll(/out\.push\("([a-z]+)"\)/g)].map(
      (m) => m[1],
    );
    expect(emitted.length).toBeGreaterThan(20);
    for (const key of new Set(emitted)) {
      expect(
        BADGE_BY_KEY[key],
        `${key} is pushed but never defined`,
      ).toBeDefined();
    }
    // Same hazard on the other side of the ladder: a MATCHED win total naming
    // a key nothing defines.
    for (const key of Object.values(MATCHED)) {
      expect(
        BADGE_BY_KEY[key],
        `MATCHED names ${key} with no definition`,
      ).toBeDefined();
    }
  });
  it("has a unique key for every badge", () => {
    expect(new Set(BADGES.map((b) => b.key)).size).toBe(BADGES.length);
  });

  it("has a unique emoji for every badge", () => {
    expect(new Set(BADGES.map((b) => b.emoji)).size).toBe(BADGES.length);
  });

  it("indexes every badge by its key", () => {
    for (const b of BADGES) expect(BADGE_BY_KEY[b.key]).toBe(b);
    expect(BADGE_BY_KEY["nosuchbadge"]).toBeUndefined();
  });

  it("gives every anti-trophy the ironic rarity and keeps it out of the case", () => {
    for (const b of BADGES)
      expect(b.ironic === true).toBe(b.rarity === "ironic");
    expect(COLLECTIBLE.some((b) => b.ironic)).toBe(false);
    expect(COLLECTIBLE).toHaveLength(BADGES.filter((b) => !b.ironic).length);
  });

  /** Six tiers, and the top one holds exactly the badges that mean "you maxed
   * out an axis". Anything that enumerates rarities — the trophy case's
   * section order, the lab's ladder, the pill styles — is reading this set, so
   * a seventh tier or a third legendary is a change that has to be made on
   * purpose. */
  it("orders the ladder rarest-first with the anti-trophies last", () => {
    // RARITY_ORDER is the one ordering: the trophy case stacks its bands in
    // it, badgeCase() sorts its tiles by it, and the Rarity type is derived
    // from it. It used to be written out separately in each place, and one
    // copy was missing the top tier — which sorted the rarest badges in the
    // game to the BOTTOM of the home case, in shipped code.
    expect([...RARITY_ORDER]).toEqual([
      "legendary",
      "ultra",
      "rare",
      "uncommon",
      "common",
      "ironic",
    ]);
    // Every tier a badge actually wears has a place in the order — a tier
    // missing from it sorts to -1, i.e. ahead of legendary.
    for (const b of BADGES) expect(RARITY_ORDER).toContain(b.rarity);
    expect(RARITY_ORDER.at(-1)).toBe("ironic");
  });

  it("keeps the ladder six tiers deep, with legendary holding the axis maxima", () => {
    const tiers = new Set(BADGES.map((b) => b.rarity));
    expect([...tiers].sort()).toEqual([
      "common",
      "ironic",
      "legendary",
      "rare",
      "ultra",
      "uncommon",
    ]);
    // Each legendary is the peak of an axis: 👑 on-field, 🏆 the stated goal,
    // 🌠 scouting, 💰 the goal axis ceiling (exceeding the solver's own best).
    // The goal axis carries two legendaries because it has two distinct peaks:
    // hitting 162 points (the game's stated target) and surpassing the solver's
    // theoretical ceiling. Adding a fifth legendary requires the same argument.
    expect(
      BADGES.filter((b) => b.rarity === "legendary").map((b) => b.key),
    ).toEqual(["crown", "perfect", "outscouted", "dreamteam"]);
    expect(
      BADGES.filter((b) => b.rarity === "legendary").map((b) => b.axis),
    ).toEqual(["onfield", "goal", "goal", "scout"]);
  });

  /** The claim badges.ts makes when it sends 🧓/🍼 to `ultra` rather than
   * `rare`: the two bands do not overlap, so the pair sits under the rare
   * floor rather than half a band below every other rare. `legendary` is exempt
   * by design — it means "you maxed out an axis", not "this was rare" — and
   * measured-only, so a `freq: null` rung is not evidence either way.
   *
   * The rare floor is 🏭 COMPANY TOWN at 1.90, and that is the least settled
   * number in the table: it is measured at n = 4,000 and sits close enough to
   * the band line that a bigger run could move it. If a re-measurement breaks
   * this test, the tier of the 🧓/🍼 pair is what has to be re-decided — the
   * pair shares whichever band leaves the two cohorts disjoint. */
  it("keeps the ultra band's ceiling under the rare band's floor", () => {
    const freqs = (rarity: string) =>
      BADGES.filter((b) => b.rarity === rarity && b.freq !== null).map(
        (b) => b.freq as number,
      );
    const ultras = freqs("ultra");
    const rares = freqs("rare");
    expect(ultras.length).toBeGreaterThan(4);
    expect(rares.length).toBeGreaterThan(4);
    expect(Math.max(...ultras)).toBeLessThan(Math.min(...rares));
  });

  it("resolves keys to emoji and drops what it does not own", () => {
    expect(badgeEmoji(["crown", "perfect"])).toEqual(["👑", "🏆"]);
    expect(badgeEmoji(["nosuchbadge"])).toEqual([]);
    expect(badgeEmoji([])).toEqual([]);
  });
});

describe("the on-field axis is exclusive", () => {
  it("fires the ladder's one badge, and only that one, at every win total", () => {
    for (let w = 0; w <= GAMES; w++) {
      const got = only(
        earnedBadges(f({ baselineWins: w, baselineLosses: GAMES - w })),
        ONFIELD,
      );
      // Exact equality, not a length bound: the ladder now has floor rungs
      // under the century as well as over it, and "at most one fired" cannot
      // tell 👔 from 📉 at the bottom of it.
      expect(got, `${w} wins`).toEqual(ladderAt(w));
    }
  });

  /** The bands, spelled out as counts so the shape of the ladder is legible
   * without reading 163 assertions: 👔 owns 0 alone, 📉 owns 1–40, 💀 owns
   * 41–62, and 63–97 plus 99 earn nothing at all. */
  it("hands each floor rung its own band", () => {
    const at = (w: number) =>
      only(
        earnedBadges(f({ baselineWins: w, baselineLosses: GAMES - w })),
        ONFIELD,
      ).join();
    const band = (from: number, to: number) => [
      ...new Set(Array.from({ length: to - from + 1 }, (_, i) => at(from + i))),
    ];
    expect(band(0, 0)).toEqual(["dayjob"]);
    expect(band(1, WORST_WINS)).toEqual(["worst"]);
    expect(band(WORST_WINS + 1, 62)).toEqual(["skull"]);
    expect(band(63, 97)).toEqual([""]);
  });

  it("puts the skull on the same axis, so a 100-loss season is never also a rung", () => {
    // 62–100 is the deepest a season can sink and still be tested for both.
    expect(
      earnedBadges(f({ baselineWins: 62, baselineLosses: 100 })),
    ).toContain("skull");
    expect(
      earnedBadges(f({ baselineWins: 63, baselineLosses: 99 })),
    ).not.toContain("skull");
    // A 100-win club cannot also have 100 losses in 162 games, but the axis
    // must not depend on that arithmetic holding.
    expect(
      only(
        earnedBadges(f({ baselineWins: 103, baselineLosses: 100 })),
        ONFIELD,
      ),
    ).toEqual(["cubs"]);
  });

  it("earns nothing on-field between the rungs", () => {
    for (const w of [0, 50, 62, 81, 90, 97, 99, 101, 102, 115]) {
      const losses = GAMES - w;
      const got = only(
        earnedBadges(f({ baselineWins: w, baselineLosses: losses })),
        ONFIELD,
      );
      // The two anti-trophies share this axis, so a season bad enough still
      // lands one badge — the floor of the ladder, not a gap in it.
      if (w >= HUNDRED_WINS) expect(got, `${w} wins`).toEqual(["hundred"]);
      else if (w <= 0) expect(got, `${w} wins`).toEqual(["dayjob"]);
      else if (w <= WORST_WINS) expect(got, `${w} wins`).toEqual(["worst"]);
      else if (losses >= 100) expect(got, `${w} wins`).toEqual(["skull"]);
      else expect(got, `${w} wins`).toEqual([]);
    }
  });

  /** 109–113 holds no champion (the 2022 Dodgers won 111 and lost the NLDS)
   * and 99 holds none either, so both bands are deliberately bare. Pinned
   * explicitly: a silent gap is indistinguishable from a rung someone forgot
   * to wire up. */
  it("keeps the empty bands empty", () => {
    for (const w of [99, 109, 110, 111, 112, 113]) {
      expect(onFieldBadge(w), `${w} wins`).toBe(
        w >= HUNDRED_WINS ? "hundred" : null,
      );
    }
  });
});

/** The bottom two rungs mirror the top two, and the mirror is the point: 👑
 * fires above the best record anyone ever posted and 📉 below the worst, with
 * 👔 as the true floor. badges-supply.test.ts pins WORST_WINS one win under the
 * 2024 White Sox; this file checks the arithmetic over that number. */
describe("the floor of the ladder", () => {
  const at = (w: number) =>
    only(
      earnedBadges(f({ baselineWins: w, baselineLosses: GAMES - w })),
      ONFIELD,
    );

  it("takes the day job at nothing won at all", () => {
    expect(
      earnedBadges(f({ baselineWins: 0, baselineLosses: GAMES })),
    ).toContain("dayjob");
    expect(
      earnedBadges(f({ baselineWins: 1, baselineLosses: GAMES - 1 })),
    ).not.toContain("dayjob");
  });

  /** The rung is "at or below zero", not "exactly zero", and the difference is
   * not hypothetical. `scoring.displayRecord` clamps only its upper end — it
   * rounds `expectedWins`, which is capped at 162 and unbounded below — so the
   * fallback record can arrive negative. Against an exact-match test every
   * negative record fell through to 📉, which inverts the ladder the file
   * specifies: 👔 is the floor and supersedes 📉, the way 👑 supersedes a
   * named rung. */
  it("keeps the day job below zero too, and does not hand it to the worst record", () => {
    for (const w of [0, -1, -5, -40, -120]) {
      const got = only(earnedBadges(f({ baselineWins: w, baselineLosses: GAMES - w })), ONFIELD);
      expect(got, `${w} wins`).toEqual(["dayjob"]);
    }
    // …and the rung above it still belongs to 📉.
    expect(
      only(earnedBadges(f({ baselineWins: 1, baselineLosses: 161 })), ONFIELD),
    ).toEqual(["worst"]);
    expect(
      only(earnedBadges(f({ baselineWins: WORST_WINS, baselineLosses: 122 })), ONFIELD),
    ).toEqual(["worst"]);
    // …and the rung above THAT belongs to 💀, at the first total that is not
    // a record-worst season but is still a hundred losses.
    expect(
      only(earnedBadges(f({ baselineWins: 41, baselineLosses: 121 })), ONFIELD),
    ).toEqual(["skull"]);
  });

  /** The floor rungs read the STAMPED record — what the finale prints — and
   * the top of the ladder reads the baseline. This is the case the split
   * exists for: a season worth 50 baseline wins that spends itself to a −16
   * points total stamps 0–162, and the player looking at that stamp is owed
   * 👔. Before the split the badge read a number the screen never showed and
   * handed them 💀 instead. */
  describe("the floor rungs read the stamped record", () => {
    const stamped = (wins: number, baselineWins = 50) =>
      only(
        earnedBadges(
          f({
            baselineWins,
            baselineLosses: GAMES - baselineWins,
            stamp: { wins, losses: GAMES - wins },
          }),
        ),
        ONFIELD,
      );

    it("takes the day job from a stamped 0-162, whatever the club was worth", () => {
      expect(stamped(0, 50)).toEqual(["dayjob"]);
      expect(stamped(0, 81)).toEqual(["dayjob"]);
      // …which is exactly the season the baseline would have called a 💀.
      expect(
        only(
          earnedBadges(f({ baselineWins: 50, baselineLosses: 112 })),
          ONFIELD,
        ),
      ).toEqual(["skull"]);
    });

    it("moves all three floor rungs together, so the ladder stays one ladder", () => {
      expect(stamped(0)).toEqual(["dayjob"]);
      expect(stamped(1)).toEqual(["worst"]);
      expect(stamped(WORST_WINS)).toEqual(["worst"]);
      expect(stamped(WORST_WINS + 1)).toEqual(["skull"]);
      expect(stamped(62)).toEqual(["skull"]);
      expect(stamped(63)).toEqual([]);
    });

    /** Which rung a season is playing for is still the baseline's call, and
     * that half does not move: awards, rings and the payroll bonus add twenty
     * wins to a stamp routinely, so a stamp-PICKED 💯 would be near-automatic.
     * The stamp only ever vetoes. */
    it("still picks the rung off the baseline", () => {
      // A club worth 81 baseline wins that scored 140 points is not a
      // hundred-win club, however generous the stamp reads.
      expect(stamped(140, 81)).toEqual([]);
      // …and a genuine 103-win club whose stamp held is 🐻.
      expect(stamped(120, 103)).toEqual(["cubs"]);
    });

    /** The second gate. The rung is picked by the baseline and kept on the
     * stamp: the result has to survive the luxury-tax bill. Overspending is
     * not forbidden, it is just no longer free of the badge. */
    it("takes the rung away when the final record does not hold up", () => {
      // The owner's own case: 105 on the field, taxed to 81–81 on the screen.
      // No 💯 — and no consolation rung either, because 81 is not a rung.
      expect(stamped(81, 105)).toEqual([]);
      // The same club untaxed keeps it.
      expect(stamped(105, 105)).toEqual(["hundred"]);
      // Exact on the baseline, a FLOOR on the stamp: piling award points on
      // top of a matched rung has not un-matched it.
      expect(stamped(103, 103)).toEqual(["cubs"]);
      expect(stamped(140, 103)).toEqual(["cubs"]);
      // …and taxing below it has.
      expect(stamped(102, 103)).toEqual([]);
      // A vetoed rung does not drop to a lower one. See onFieldBadge: a
      // consolation 💯 for a taxed-out 116-win club turns the tax penalty back
      // into a prize and makes "matched the Mariners" a thing you can half-do.
      expect(stamped(104, 116)).toEqual([]);
      // 👑 is gated the same way at both ends.
      expect(stamped(117, 117)).toEqual(["crown"]);
      expect(stamped(116, 117)).toEqual([]);
    });

    /** A club whose baseline earns a rung and whose stamp lands in the floor
     * bands now reads the floor rung it actually posted. Only reachable
     * because the rung above it can be vetoed — before the second gate this
     * club kept 🐻 over a 0–162 stamp. */
    it("hands a taxed-out champion the floor rung its stamp names", () => {
      expect(stamped(0, 103)).toEqual(["dayjob"]);
      expect(stamped(30, 103)).toEqual(["worst"]);
      expect(stamped(55, 103)).toEqual(["skull"]);
      // Between the floor bands and the rung it lost, it earns nothing at all.
      expect(stamped(90, 103)).toEqual([]);
    });

    it("falls back to the baseline pair when no stamp is supplied", () => {
      // Which is the behavior that shipped before the field existed, so an
      // engine that has not adopted it yet keeps working.
      expect(
        only(earnedBadges(f({ baselineWins: 50, baselineLosses: 112 })), ONFIELD),
      ).toEqual(["skull"]);
      expect(
        only(earnedBadges(f({ baselineWins: 0, baselineLosses: GAMES })), ONFIELD),
      ).toEqual(["dayjob"]);
    });

    it("still fires at most one on-field badge, over both records at once", () => {
      for (let b = -20; b <= GAMES; b += 7) {
        for (let s = -20; s <= GAMES; s += 7) {
          const got = only(
            earnedBadges(
              f({
                baselineWins: b,
                baselineLosses: GAMES - b,
                stamp: { wins: s, losses: GAMES - s },
              }),
            ),
            ONFIELD,
          );
          expect(got.length, `baseline ${b}, stamp ${s}`).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  it("lets the day job supersede both the worst record and the skull", () => {
    // 0–162 qualifies on all three counts — 0 ≤ 40 wins and 162 ≥ 100 losses —
    // and exactly one badge may come out of that.
    const got = earnedBadges(f({ baselineWins: 0, baselineLosses: GAMES }));
    expect(only(got, ONFIELD)).toEqual(["dayjob"]);
    expect(got).not.toContain("worst");
    expect(got).not.toContain("skull");
  });

  it("takes the worst record from one win up to the threshold", () => {
    expect(at(1)).toEqual(["worst"]);
    expect(at(WORST_WINS)).toEqual(["worst"]);
    expect(at(20)).toEqual(["worst"]);
  });

  it("hands the win above the threshold back to the skull, not to nothing", () => {
    // 41–121 is the 2024 White Sox exactly, and the record 📉 sits one win
    // under. A club that bad is still a 100-loss club, so the rung below it is
    // 💀 rather than an empty row.
    expect(WORST_WINS + 1).toBe(41);
    expect(at(WORST_WINS + 1)).toEqual(["skull"]);
    expect(
      earnedBadges(f({ baselineWins: 41, baselineLosses: 121 })),
    ).not.toContain("worst");
  });
});

describe("the named rungs match exactly", () => {
  const at = (w: number) => onFieldBadge(w);

  it("seats the one sub-century rung at 98, alone", () => {
    expect(at(98)).toBe("redsox");
    expect(at(97)).toBeNull();
    expect(at(99)).toBeNull();
    // 100 belongs to the century, not to its neighbor.
    expect(at(100)).toBe("hundred");
    for (const w of [97, 99, 100]) {
      expect(
        earnedBadges(f({ baselineWins: w, baselineLosses: GAMES - w })),
      ).not.toContain("redsox");
    }
  });

  it("seats the champion rungs on their own totals", () => {
    expect(at(103)).toBe("cubs");
    expect(at(106)).toBe("astros");
    expect(at(108)).toBe("mets");
    expect(at(114)).toBe("yankees");
  });

  it("hands 116 to the record rung and everything above it to the crown", () => {
    expect(at(116)).toBe("mariners");
    expect(at(CROWN_WINS)).toBe("crown");
    expect(at(117)).toBe("crown");
    expect(at(118)).toBe("crown");
    expect(at(162)).toBe("crown");
  });

  it("never lets a rung swallow the total above or below it", () => {
    for (const [total, key] of Object.entries(MATCHED)) {
      const w = Number(total);
      expect(at(w)).toBe(key);
      expect(at(w - 1)).not.toBe(key);
      expect(at(w + 1)).not.toBe(key);
    }
  });

  it("keys every rung to baseline wins, never to the points total", () => {
    // A 250-point blowout on an 81-win baseline is still no rung at all.
    expect(only(earnedBadges(f({ total: 250 })), ONFIELD)).toEqual([]);
    expect(earnedBadges(f({ total: 250 }))).toContain("perfect");
  });
});

describe("the goal", () => {
  it("fires at exactly 162 points and not a tenth below", () => {
    expect(earnedBadges(f({ total: 162 }))).toContain("perfect");
    expect(earnedBadges(f({ total: 161.9 }))).not.toContain("perfect");
    expect(earnedBadges(f({ total: 400 }))).toContain("perfect");
  });

  describe("the one that got away", () => {
    // The stamp the club actually posted: comfortably short of perfect.
    const short = { wins: 140, losses: 22 };

    it("fires when the ceiling stamps 162–0 and the club's stamp doesn't", () => {
      expect(
        earnedBadges(f({ ceilingTotal: 162, stamp: short })),
      ).toContain("gotaway");
      // Through recordFromTotal, not a raw comparison: 161.5 ROUNDS to a
      // 162–0 stamp, so it was on the table.
      expect(
        earnedBadges(f({ ceilingTotal: 161.5, stamp: short })),
      ).toContain("gotaway");
      expect(
        earnedBadges(f({ ceilingTotal: 161.4, stamp: short })),
      ).not.toContain("gotaway");
    });

    it("never fires on a club that stamped 162–0 itself", () => {
      expect(
        earnedBadges(
          f({ ceilingTotal: 190, total: 170, stamp: { wins: 162, losses: 0 } }),
        ),
      ).not.toContain("gotaway");
    });

    it("fails safe when the ceiling is unknown", () => {
      // No solve, no fact — a season whose ceiling never resolved cannot be
      // said to have let one get away.
      expect(earnedBadges(f({ stamp: short }))).not.toContain("gotaway");
    });

    it("falls back to the baseline record when the stamp is absent", () => {
      // The same floor pair the anti-trophy rungs read: BASE's 81–81
      // baseline has losses, so a perfect ceiling still got away.
      expect(earnedBadges(f({ ceilingTotal: 162 }))).toContain("gotaway");
    });
  });
});

describe("the payroll axis is exclusive", () => {
  it("never fires two faces at once, over any payroll a game can produce", () => {
    for (const budgetM of [40, 96.7, 140]) {
      for (let spendM = 0; spendM <= budgetM * 2; spendM += 2.5) {
        // The bonus is zero whenever the cap is busted, which is the property
        // that keeps 🚜 and 💵 apart; below the cap it tracks how much is left.
        const budgetBonus = spendM > budgetM ? 0 : (spendM / budgetM) * 10;
        for (const [w, l] of [
          [50, 112],
          [81, 81],
          [110, 52],
        ]) {
          const got = only(
            earnedBadges(
              f({
                spendM,
                budgetM,
                budgetBonus,
                baselineWins: w,
                baselineLosses: l,
              }),
            ),
            PAYROLL,
          );
          expect(
            got.length,
            `$${spendM}M of $${budgetM}M at ${w}–${l} fired ${got.join(" ")}`,
          ).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("takes the farm tax at $15M over the bankroll", () => {
    expect(
      earnedBadges(f({ spendM: 155, budgetM: 140, budgetBonus: 0 })),
    ).toContain("farm");
    expect(
      earnedBadges(f({ spendM: 154.9, budgetM: 140, budgetBonus: 0 })),
    ).not.toContain("farm");
  });

  it("takes the dime at a 9.9 payroll bonus", () => {
    expect(earnedBadges(f({ budgetBonus: 9.9 }))).toContain("dime");
    expect(earnedBadges(f({ budgetBonus: 9.8 }))).not.toContain("dime");
  });

  it("takes the abacus only for a cheap payroll that also won", () => {
    const cheap = { spendM: 70, budgetM: 140, budgetBonus: 5 };
    expect(
      earnedBadges(f({ ...cheap, baselineWins: 95, baselineLosses: 67 })),
    ).toContain("pinch");
    expect(
      earnedBadges(f({ ...cheap, baselineWins: 94, baselineLosses: 68 })),
    ).not.toContain("pinch");
    expect(
      earnedBadges(
        f({ ...cheap, spendM: 70.1, baselineWins: 95, baselineLosses: 67 }),
      ),
    ).not.toContain("pinch");
  });

  it("takes the receipt only for a cheap payroll that also lost", () => {
    const cheap = { spendM: 84, budgetM: 140, budgetBonus: 5 };
    expect(
      earnedBadges(f({ ...cheap, baselineWins: 70, baselineLosses: 92 })),
    ).toContain("pocket");
    expect(
      earnedBadges(f({ ...cheap, baselineWins: 92, baselineLosses: 70 })),
    ).not.toContain("pocket");
    expect(
      earnedBadges(
        f({ ...cheap, spendM: 84.1, baselineWins: 70, baselineLosses: 92 }),
      ),
    ).not.toContain("pocket");
  });
});

describe("scouting", () => {
  it("takes the crystal ball at seven dream-team hits", () => {
    expect(earnedBadges(f({ scoutHits: 7 }))).toContain("crystal");
    expect(earnedBadges(f({ scoutHits: 6 }))).not.toContain("crystal");
    expect(earnedBadges(f({ scoutHits: 9 }))).toContain("crystal");
  });

  describe("went my own way", () => {
    /** Nine chairs filled against a whole dream club, zero agreement. */
    const whole = (over: Partial<BadgeFacts> = {}) =>
      f({
        roster: club(8),
        managerName: "Some Skipper",
        dreamSeats: 9,
        scoutHits: 0,
        ...over,
      });

    it("fires on nine filled chairs and zero dream-team picks", () => {
      expect(earnedBadges(whole())).toContain("maverick");
      expect(earnedBadges(whole({ scoutHits: 1 }))).not.toContain("maverick");
    });

    it("wants the player's club whole — every seat and the dugout", () => {
      expect(earnedBadges(whole({ roster: club(7) }))).not.toContain(
        "maverick",
      );
      expect(earnedBadges(whole({ managerName: null }))).not.toContain(
        "maverick",
      );
    });

    it("wants the dream club whole too, nine seats on the nose", () => {
      // 🌠's denominator discipline: a five-card reel's five-seat dream club
      // is not a club anyone defied, and an absent solve is not one either.
      expect(earnedBadges(whole({ dreamSeats: 5 }))).not.toContain("maverick");
      expect(earnedBadges(whole({ dreamSeats: 0 }))).not.toContain("maverick");
    });

    it("shares the exclusive scout axis with its opposite pole", () => {
      // The chain, not coincidence: a nine-hit club takes 🌠 alone.
      const matched = earnedBadges(
        whole({ scoutHits: 9 }),
      );
      expect(matched).toContain("dreamteam");
      expect(matched).not.toContain("maverick");
    });
  });
});

describe("roster shape", () => {
  it("wants all eight seats filled before it calls a club an All-Star roster", () => {
    const seven = earnedBadges(
      f({ roster: club(7, { awards: ["AS"], war: 6 }) }),
    );
    expect(seven).not.toContain("allstars");
    expect(seven).not.toContain("noweak");
    const eight = earnedBadges(
      f({ roster: club(8, { awards: ["AS"], war: 6 }) }),
    );
    expect(eight).toContain("allstars");
    expect(eight).toContain("noweak");
  });

  it("loses the All-Star roster to a single unpicked player", () => {
    const roster = club(8, { awards: ["AS"] });
    roster[3] = player({ awards: ["GG"] });
    expect(earnedBadges(f({ roster }))).not.toContain("allstars");
  });

  it("loses no-weak-links to a single sub-4.0 WAR seat", () => {
    const roster = club(8, { war: 4.0 });
    expect(earnedBadges(f({ roster }))).toContain("noweak");
    roster[7] = player({ war: 3.9 });
    expect(earnedBadges(f({ roster }))).not.toContain("noweak");
  });

  /** The three shape badges are one question — how a club's WAR is spread over
   * eight seats — asked three ways, so they are tested together and the
   * pairwise logic is asserted rather than argued. 🧱 wants no soft seat, ⛰️
   * wants two carrying seats and three dead ones, ⚖️ wants every seat close to
   * every other, and 🔪 counts the gold ones. */
  describe("the shape badges", () => {
    /** A club of eight, seat by seat. */
    const shaped = (wars: number[]) =>
      earnedBadges(f({ roster: wars.map((war) => player({ war })) }));

    it("takes stars-and-scrubs at two carrying seats and three dead ones", () => {
      expect(shaped([6.0, 6.0, 1.0, 1.0, 1.0, 3, 3, 3])).toContain("topheavy");
      // One star short.
      expect(shaped([6.0, 5.9, 1.0, 1.0, 1.0, 3, 3, 3])).not.toContain(
        "topheavy",
      );
      // One scrub short.
      expect(shaped([6.0, 6.0, 1.0, 1.0, 1.1, 3, 3, 3])).not.toContain(
        "topheavy",
      );
    });

    it("wants all eight seats before it calls a club any shape at all", () => {
      // Seven dead seats and one star is not stars-and-scrubs, and seven
      // identical seats are not a club with no drop-off — a vacancy must never
      // buy a badge whose copy claims a whole roster.
      const seven = earnedBadges(
        f({ roster: [6.0, 6.0, 1.0, 1.0, 1.0, 3, 3].map((war) => player({ war })) }),
      );
      expect(seven).not.toContain("topheavy");
      expect(seven).not.toContain("balanced");
      expect(seven).not.toContain("gold");
      expect(earnedBadges(f({ roster: [] }))).not.toContain("balanced");
    });

    it("takes no-drop-off for a deep club and refuses a uniformly bad one", () => {
      // Eight useful seats, nothing much between them: the badge.
      expect(shaped([7.0, 4.5, 4.0, 3.8, 3.5, 3.2, 3.0, 3.0])).toContain(
        "balanced",
      );
      // The same tight spread, but nobody in it is any good. This is the whole
      // objection the floor answers: a bare gap test is a trophy for eight
      // mediocre men, and it is the shape a club lands on when nothing good
      // ever showed up on the reel.
      expect(shaped([2.9, 2.5, 2.0, 1.5, 1.0, 0.5, 0.2, 0.0])).not.toContain(
        "balanced",
      );
      expect(shaped([1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0])).not.toContain(
        "balanced",
      );
    });

    it("loses no-drop-off to one seat that carries the club", () => {
      expect(shaped([7.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0])).toContain(
        "balanced",
      );
      expect(shaped([7.1, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0, 3.0])).not.toContain(
        "balanced",
      );
      // …and to one seat that drags it down, even with the gap unchanged.
      expect(shaped([6.9, 6.9, 6.9, 6.9, 6.9, 6.9, 6.9, 2.9])).not.toContain(
        "balanced",
      );
    });

    /** ⚖️ and ⛰️ are structurally exclusive and neither an axis nor a resolver
     * enforces it: ⛰️ needs a seat at 6.0+ and a seat at 1.0−, i.e. a spread of
     * at least 5.0, where ⚖️ refuses any spread of 3.0 or more. The exclusivity
     * is in the world, which is why both ride the stacking axis. This sweep is
     * what would notice if a threshold moved and quietly opened a gap. */
    it("never fires no-drop-off and stars-and-scrubs together, over any club", () => {
      for (let hi = 0; hi <= 12; hi += 0.5) {
        for (let lo = 0; lo <= hi; lo += 0.5) {
          for (const mid of [0, 1, 3, 5, 8]) {
            const got = shaped([hi, hi, lo, lo, lo, mid, mid, mid]);
            const both = got.filter(
              (k) => k === "balanced" || k === "topheavy",
            );
            expect(both.length, `hi=${hi} lo=${lo} mid=${mid}`).toBeLessThanOrEqual(1);
          }
        }
      }
    });

    /** ⚖️ and 🧱 CAN co-fire, and that is coherent rather than a bug: a club of
     * eight 4.5-WAR men has no soft seat and no drop-off, and both statements
     * are true of it. What would make ⚖️ worthless is the reverse — if every
     * 🧱 club also cleared the gap, so the badge added nothing. It does not:
     * 🧱's floor is 4.0 with no ceiling at all. */
    it("stacks with no-scrubs on a deep even club, and separates on a lopsided one", () => {
      const both = shaped([4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5, 4.5]);
      expect(both).toContain("noweak");
      expect(both).toContain("balanced");
      const lopsided = shaped([9.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0, 4.0]);
      expect(lopsided).toContain("noweak");
      expect(lopsided).not.toContain("balanced");
    });

    it("takes the gold at five seats over the rung, and not at four", () => {
      expect(shaped([8.0, 8.0, 8.0, 8.0, 8.0, 1, 1, 1])).toContain("gold");
      expect(shaped([8.0, 8.0, 8.0, 8.0, 7.9, 1, 1, 1])).not.toContain("gold");
      expect(shaped([12, 11, 10, 9, 8, 8, 8, 8])).toContain("gold");
    });
  });

  it("takes the two-way guy from any slashed position, at any roster size", () => {
    expect(earnedBadges(f({ roster: [player({ pos: "SP/DH" })] }))).toContain(
      "twoway",
    );
    expect(earnedBadges(f({ roster: club(8) }))).not.toContain("twoway");
  });

  it("takes the hardware collection at 30 award points and the rings at four", () => {
    expect(earnedBadges(f({ awardPoints: 30 }))).toContain("cooperstown");
    expect(earnedBadges(f({ awardPoints: 29.9 }))).not.toContain("cooperstown");
    expect(earnedBadges(f({ rings: 4 }))).toContain("rings");
    expect(earnedBadges(f({ rings: 3 }))).not.toContain("rings");
  });

  /** The key `cooperstown` still means thirty award points, which is what
   * everyone holding it actually earned; only the name and glyph moved off it.
   * The Hall of Fame badge that took the name has its own key, so no earned
   * badge silently changes meaning. */
  it("keeps the Cooperstown name and the Cooperstown key on different badges", () => {
    expect(BADGE_BY_KEY.cooperstown.label).toBe("HARDWARE STORE");
    expect(BADGE_BY_KEY.hall.label).toBe("COOPERSTOWN CLASS");
    expect(BADGE_BY_KEY.cooperstown.how).toContain("award points");
    expect(BADGE_BY_KEY.hall.emoji).toBe("🏛️");
  });

  /** 🏛️ counts men, not points, and the skipper's chair is one of the seats —
   * the same reading that puts the Astros' manager on 🗑️. Both flags are
   * optional, so a club restored from a save written before they existed must
   * count as no Hall of Famers at all. */
  describe("the Hall of Fame", () => {
    const hallClub = (n: number, managerHof = false) =>
      earnedBadges(
        f({
          roster: [
            ...Array.from({ length: n }, () => player({ hof: true })),
            ...club(8 - n),
          ],
          managerHof,
        }),
      );

    it("takes it at four Hall of Famers and not at three", () => {
      expect(hallClub(4)).toContain("hall");
      expect(hallClub(3)).not.toContain("hall");
      expect(hallClub(8)).toContain("hall");
    });

    it("counts a Hall of Fame skipper as the fourth", () => {
      expect(hallClub(3, true)).toContain("hall");
      expect(hallClub(2, true)).not.toContain("hall");
      // A Hall of Fame skipper alone is one man, not a club.
      expect(hallClub(0, true)).not.toContain("hall");
    });

    it("counts a club with no flags at all as no Hall of Famers", () => {
      expect(earnedBadges(f({ roster: club(8) }))).not.toContain("hall");
    });

    it("does not need a full roster — the Hall is a count, not a shape", () => {
      expect(
        earnedBadges(
          f({ roster: Array.from({ length: 4 }, () => player({ hof: true })) }),
        ),
      ).toContain("hall");
    });
  });

  /** 🌎 counts distinct birth countries over a FULL club. Two things would
   * break silently: a missing country counted as a country of its own, and a
   * partial roster earning a badge whose copy claims a whole club. */
  describe("the world tour", () => {
    const born = (countries: (string | undefined)[]) =>
      earnedBadges(f({ roster: countries.map((country) => player({ country })) }));

    it("takes five distinct countries over eight seats, and not four", () => {
      expect(
        born(["USA", "Dominican Republic", "Venezuela", "Japan", "Curaçao", "USA", "USA", "USA"]),
      ).toContain("worldtour");
      expect(
        born(["USA", "Dominican Republic", "Venezuela", "Japan", "USA", "USA", "USA", "USA"]),
      ).not.toContain("worldtour");
    });

    it("counts an unknown country as no country at all", () => {
      // Four known plus three blanks is four countries, not five or seven.
      expect(
        born(["USA", "Japan", "Cuba", "Mexico", undefined, undefined, undefined, undefined]),
      ).not.toContain("worldtour");
      expect(born(["USA", "Japan", "Cuba", "Mexico", "", "", "", ""])).not.toContain(
        "worldtour",
      );
    });

    it("wants the club full before it claims a whole roster travelled", () => {
      expect(
        born(["USA", "Dominican Republic", "Venezuela", "Japan", "Curaçao"]),
      ).not.toContain("worldtour");
    });
  });

  /** 🧓 and 🍼 are one idea pointed in two directions, so they are asserted
   * together: the same count, the same shape, opposite ends of the field. The
   * ageless case is the one that would fail silently — a v5 save restores a
   * club with no ages at all, and a club nobody can date must earn neither. */
  describe("the age axis", () => {
    const aged = (ages: (number | undefined)[]) =>
      earnedBadges(f({ roster: ages.map((age) => player({ age })) }));

    it("takes the old heads at three players aged 35, and not at two", () => {
      expect(aged([35, 35, 35])).toContain("oldheads");
      expect(aged([35, 35, 34])).not.toContain("oldheads");
      expect(aged([44, 39, 35, 28, 28])).toContain("oldheads");
    });

    it("takes the young guns at three players aged 23, and not at two", () => {
      expect(aged([23, 23, 23])).toContain("youngguns");
      expect(aged([23, 23, 24])).not.toContain("youngguns");
      expect(aged([19, 21, 23, 30, 30])).toContain("youngguns");
    });

    it("counts an ageless player as neither old nor young", () => {
      const none = aged([undefined, undefined, undefined, undefined]);
      expect(none).not.toContain("oldheads");
      expect(none).not.toContain("youngguns");
      // Nor may an ageless seat top up a club two short of either end.
      expect(aged([35, 35, undefined])).not.toContain("oldheads");
      expect(aged([23, 23, undefined])).not.toContain("youngguns");
    });

    it("lets a club old at one end and young at the other take both", () => {
      const both = aged([36, 37, 38, 21, 22, 23]);
      expect(both).toContain("oldheads");
      expect(both).toContain("youngguns");
    });

    /** The user-facing half of the pairing: they measure 0.95% and 1.73%, one
     * either side of a band line, and they still have to render alike. */
    it("renders the pair identically — same tier, same axis", () => {
      const old = BADGE_BY_KEY.oldheads;
      const young = BADGE_BY_KEY.youngguns;
      expect(old.rarity).toBe(young.rarity);
      expect(old.axis).toBe(young.axis);
      expect(old.secret).toBeUndefined();
      expect(young.secret).toBeUndefined();
      // …and the measurement is still the measurement.
      expect(old.freq).toBe(0.95);
      expect(young.freq).toBe(1.73);
    });
  });

  it("takes the franchise player at half the payroll, spent on one man", () => {
    const roster = club(8, { costPaid: 5 });
    roster[0] = player({ costPaid: 50 });
    expect(earnedBadges(f({ roster, spendM: 100 }))).toContain(
      "franchiseplayer",
    );
    roster[0] = player({ costPaid: 49.9 });
    expect(earnedBadges(f({ roster, spendM: 100 }))).not.toContain(
      "franchiseplayer",
    );
  });

  it("never divides by a payroll of zero", () => {
    expect(
      earnedBadges(f({ roster: club(8, { costPaid: 0 }), spendM: 0 })),
    ).not.toContain("franchiseplayer");
  });

  it("takes the homegrown superstar only for a discount spent on 8 WAR", () => {
    expect(
      earnedBadges(f({ roster: [player({ hero: true, war: 8.0 })] })),
    ).toContain("homegrown");
    expect(
      earnedBadges(f({ roster: [player({ hero: true, war: 7.9 })] })),
    ).not.toContain("homegrown");
    // The same season signed at full price is a signing, not a play.
    expect(
      earnedBadges(f({ roster: [player({ hero: false, war: 12 })] })),
    ).not.toContain("homegrown");
  });

  /** 🗺️ counts the alignment each player's OWN season played in. The engine
   * resolves it off the index rows, so this file only pins the arithmetic over
   * the resolved strings; badges-supply pins that the data still says what the
   * label claims. */
  it("takes the division at five players out of one, and not at four", () => {
    const five = ["AL/W", "AL/W", "AL/W", "AL/W", "AL/W", "NL/E", "NL/C"];
    expect(earnedBadges(f({ divisions: five }))).toContain("division");
    expect(earnedBadges(f({ divisions: five.slice(1) }))).not.toContain(
      "division",
    );
    // Four and four is eight players and no badge — the bucket has to hold.
    const four = ["AL/W", "AL/W", "AL/W", "AL/W"];
    expect(
      earnedBadges(f({ divisions: [...four, "NL/E", "NL/E", "NL/E", "NL/E"] })),
    ).not.toContain("division");
  });

  /** 🕶️ is the one badge about the ORDER a club was built in. From the Ground Up hides
   * the payroll until an owner is hired, so eight signings made first are eight
   * bets — and the badge wants the bet to have come off. */
  describe("flying blind", () => {
    const blind = (over: Partial<BadgeFacts> = {}) =>
      earnedBadges(
        f({
          ownerLast: true,
          roster: club(8),
          budgetM: 100,
          spendM: 90,
          ...over,
        }),
      );

    it("takes it for a full club drafted before the owner, inside the cap", () => {
      expect(blind()).toContain("flyingblind");
    });

    it("wants the owner to have come last", () => {
      expect(blind({ ownerLast: false })).not.toContain("flyingblind");
      // A fact set from before the field existed is not a blind draft.
      expect(blind({ ownerLast: undefined })).not.toContain("flyingblind");
    });

    it("wants all eight seats — a half-built club that waited is not nerve", () => {
      expect(blind({ roster: club(7) })).not.toContain("flyingblind");
    });

    it("wants the payroll to have survived contact with the cap", () => {
      expect(blind({ spendM: 100 })).toContain("flyingblind");
      expect(blind({ spendM: 100.1 })).not.toContain("flyingblind");
    });

    it("refuses a club that simply spent nothing", () => {
      // 60% of the cap is 🧾 POCKETED THE DIFFERENCE's own line, reused so the
      // two badges are exact complements rather than near-neighbors.
      expect(blind({ spendM: 60.1 })).toContain("flyingblind");
      expect(blind({ spendM: 60 })).not.toContain("flyingblind");
      expect(blind({ spendM: 20 })).not.toContain("flyingblind");
    });

    it("never fires in a bank with no owner seat and no unknown payroll", () => {
      // Moneyball and Blank Check know the cap from the first spin, and
      // hireOwner() returns before it can record anything — so the flag is
      // never set and no mode gate is needed to keep the badge out.
      expect(blind({ ownerLast: false, owner: null, stadium: null })).not.toContain(
        "flyingblind",
      );
    });

    it("never divides by a payroll of zero", () => {
      expect(blind({ budgetM: 0, spendM: 0 })).not.toContain("flyingblind");
    });

    /** The payroll axis is exclusive and 🕶️ is not on it, so the check that
     * matters is whether it can say the opposite thing to whichever payroll
     * face fired. It cannot: 🧾 needs 60% or less and 🧮 needs 50% or less,
     * both below 🕶️'s floor, and 🚜 needs the cap busted, which 🕶️ forbids. */
    it("never co-fires with a payroll badge that contradicts it", () => {
      for (let spendM = 0; spendM <= 200; spendM += 2.5) {
        const budgetM = 100;
        const budgetBonus = spendM > budgetM ? 0 : (spendM / budgetM) * 10;
        for (const [w, l] of [
          [50, 112],
          [110, 52],
        ]) {
          const got = earnedBadges(
            f({
              ownerLast: true,
              roster: club(8),
              budgetM,
              spendM,
              budgetBonus,
              baselineWins: w,
              baselineLosses: l,
            }),
          );
          if (!got.includes("flyingblind")) continue;
          expect(got, `$${spendM}M of $${budgetM}M`).not.toContain("pocket");
          expect(got, `$${spendM}M of $${budgetM}M`).not.toContain("pinch");
          expect(got, `$${spendM}M of $${budgetM}M`).not.toContain("farm");
        }
      }
    });

    /** …and the one it SHOULD stack with. Landing on the number you could not
     * see is the best possible version of this story. */
    it("stacks with spending every dime", () => {
      const got = earnedBadges(
        f({
          ownerLast: true,
          roster: club(8),
          budgetM: 100,
          spendM: 99.9,
          budgetBonus: 9.99,
        }),
      );
      expect(got).toContain("flyingblind");
      expect(got).toContain("dime");
    });
  });

  /** The front office is three separate picks, and these are the two badges
   * that ask them to agree. Card-exact on the ballpark: a bare franchise match
   * measures 26.5% and is a coin flip. */
  describe("the front-office matches", () => {
    const park = { franchise: "SEA", year: 2001 };
    const local = player({ franchise: "SEA", year: 2001 });

    it("takes home field for a player from the ballpark's exact season", () => {
      expect(earnedBadges(f({ stadium: park, roster: [local] }))).toContain(
        "homefield",
      );
    });

    it("refuses the same franchise in a different season", () => {
      const older = player({ franchise: "SEA", year: 1995 });
      expect(earnedBadges(f({ stadium: park, roster: [older] }))).not.toContain(
        "homefield",
      );
    });

    it("refuses the same season from a different franchise", () => {
      const rival = player({ franchise: "NYY", year: 2001 });
      expect(earnedBadges(f({ stadium: park, roster: [rival] }))).not.toContain(
        "homefield",
      );
    });

    it("takes the company town when owner, ballpark and a player all agree", () => {
      const got = earnedBadges(
        f({
          owner: { franchise: "SEA", year: 1997 },
          stadium: park,
          roster: [local],
        }),
      );
      expect(got).toContain("companytown");
      // The owner half is franchise-deep, not season-deep — a club is a club
      // across the years, and the ballpark carries the season precision.
      expect(got).toContain("homefield");
    });

    it("refuses the company town when the owner is from another club", () => {
      expect(
        earnedBadges(
          f({
            owner: { franchise: "NYY", year: 2001 },
            stadium: park,
            roster: [local],
          }),
        ),
      ).not.toContain("companytown");
    });

    it("earns neither in a fixed-cap bank, where there is no front office", () => {
      // Moneyball and Blank Check never seat an owner or a ballpark at all.
      const got = earnedBadges(
        f({ owner: null, stadium: null, roster: club(8) }),
      );
      expect(got).not.toContain("companytown");
      expect(got).not.toContain("homefield");
    });
  });

  /** The toolbox axis. 🧗 and 🧰 cannot co-fire — all six spent and none spent
   * are not both true — and 🌱 needs 🏠 spent, so it can never join 🧗. The
   * exclusivity is in the world, not in the resolver, which is why all three
   * ride the stacking axis. */
  describe("the toolbox", () => {
    const won = { baselineWins: 100, baselineLosses: 62 };

    it("takes the whole toolbox only when every powerup is spent", () => {
      expect(earnedBadges(f({ powerups: { spent: 6, total: 6 } }))).toContain(
        "toolbox",
      );
      expect(
        earnedBadges(f({ powerups: { spent: 5, total: 6 } })),
      ).not.toContain("toolbox");
    });

    it("never fires the toolbox on a game that offered no powerups", () => {
      expect(
        earnedBadges(f({ powerups: { spent: 0, total: 0 } })),
      ).not.toContain("toolbox");
    });

    it("takes the hard way only for a hundred wins with nothing spent", () => {
      expect(earnedBadges(f({ ...won }))).toContain("hardway");
      expect(
        earnedBadges(f({ ...won, powerups: { spent: 1, total: 6 } })),
      ).not.toContain("hardway");
      // Passivity earns nothing: a powerup-free season that did not win is not
      // a handicap run, it is a player who never found the buttons.
      expect(
        earnedBadges(f({ baselineWins: 99, baselineLosses: 63 })),
      ).not.toContain("hardway");
    });

    it("never fires both ends at once, over every count of spent powerups", () => {
      for (let spent = 0; spent <= 6; spent++) {
        const got = earnedBadges(f({ ...won, powerups: { spent, total: 6 } }));
        expect(
          got.filter((k) => k === "hardway" || k === "toolbox"),
          `${spent} spent`,
        ).toHaveLength(spent === 0 || spent === 6 ? 1 : 0);
      }
    });
  });

  it("takes the skipper's year only above 105 wins, with the MotY", () => {
    expect(earnedBadges(f({ managerMoty: true, baselineWins: 106 }))).toContain(
      "skipper",
    );
    expect(
      earnedBadges(f({ managerMoty: true, baselineWins: 105 })),
    ).not.toContain("skipper");
    expect(
      earnedBadges(f({ managerMoty: false, baselineWins: 120 })),
    ).not.toContain("skipper");
  });
});

describe("the empty-case anti-trophies", () => {
  it("lets the empty trophy case supersede the missing All-Stars", () => {
    const bare = earnedBadges(f({ roster: club(8), awardPoints: 0 }));
    expect(bare).toContain("nohardware");
    expect(bare).not.toContain("noallstars");
  });

  it("falls back to the missing All-Stars when some other hardware landed", () => {
    const got = earnedBadges(
      f({ roster: club(8, { awards: ["GG"] }), awardPoints: 6 }),
    );
    expect(got).toContain("noallstars");
    expect(got).not.toContain("nohardware");
  });

  it("never fires both, over every combination of hardware and All-Stars", () => {
    for (const awardPoints of [0, 6, 30]) {
      for (const awards of [[], ["AS"], ["GG"], ["GG", "AS"]]) {
        for (const n of [0, 1, 8]) {
          const got = earnedBadges(
            f({ roster: club(n, { awards }), awardPoints }),
          );
          expect(
            got.filter((k) => k === "nohardware" || k === "noallstars").length,
            `${n} players with ${awards.join("+") || "nothing"} at ${awardPoints} pts`,
          ).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("earns neither on an empty roster — a vacancy is not a failure", () => {
    const none = earnedBadges(f({ roster: [], awardPoints: 0 }));
    expect(none).not.toContain("nohardware");
    expect(none).not.toContain("noallstars");
    // Nor can a club with no players qualify as one made entirely of stars.
    expect(none).not.toContain("allstars");
    expect(none).not.toContain("noweak");
  });
});

describe("the era badges", () => {
  it("takes the picket line from a 1994 season and the tape from a 2020 one", () => {
    expect(earnedBadges(f({ roster: [player({ year: 1994 })] }))).toContain(
      "strike",
    );
    expect(earnedBadges(f({ roster: [player({ year: 2020 })] }))).toContain(
      "covid",
    );
    expect(earnedBadges(f({ roster: [player({ year: 1995 })] }))).not.toContain(
      "strike",
    );
    expect(earnedBadges(f({ roster: [player({ year: 2019 })] }))).not.toContain(
      "covid",
    );
  });

  it("stacks both when a club spans the two shortened seasons", () => {
    const got = earnedBadges(
      f({ roster: [player({ year: 1994 }), player({ year: 2020 })] }),
    );
    expect(got).toContain("strike");
    expect(got).toContain("covid");
  });

  /** The scandal badge names a finding, not a rumor: the Commissioner's
   * report covers 2017 and 2018 only. 2019 was alleged and never
   * substantiated, and the badge must not quietly widen to it. */
  it("takes the banging scheme from a 2017 or 2018 Astro", () => {
    for (const year of [2017, 2018]) {
      expect(
        earnedBadges(f({ roster: [player({ team: "HOU", year })] })),
      ).toContain("signstealing");
    }
  });

  it("spares every other Astros season and every other club", () => {
    for (const year of [2016, 2019, 2022]) {
      expect(
        earnedBadges(f({ roster: [player({ team: "HOU", year })] })),
        `HOU ${year}`,
      ).not.toContain("signstealing");
    }
    for (const team of ["BOS", "NYY", "LAD"]) {
      expect(
        earnedBadges(f({ roster: [player({ team, year: 2017 })] })),
      ).not.toContain("signstealing");
    }
  });

  it("takes it from the skipper alone — the manager was suspended for this", () => {
    const clean = { roster: club(8), managerTeam: "HOU", managerYear: 2017 };
    expect(earnedBadges(f(clean))).toContain("signstealing");
    expect(earnedBadges(f({ ...clean, managerYear: 2019 }))).not.toContain(
      "signstealing",
    );
    expect(earnedBadges(f({ ...clean, managerTeam: "BOS" }))).not.toContain(
      "signstealing",
    );
  });

  it("fires once, not twice, when the skipper and a player were both there", () => {
    const got = earnedBadges(
      f({
        roster: [
          player({ team: "HOU", year: 2017 }),
          player({ team: "HOU", year: 2018 }),
        ],
        managerTeam: "HOU",
        managerYear: 2017,
      }),
    );
    expect(got.filter((k) => k === "signstealing")).toHaveLength(1);
  });

  /** 🏦 is the only trigger keyed to a player AND a club at once. The folklore
   * is the pairing, not the man: Bonilla in Pittsburgh is a good third baseman
   * and Ohtani in Anaheim is the best player alive — neither is a deferral
   * story. Both halves are asserted, and so is the cross-pair, because a
   * trigger that checked id-or-team would pass the positive cases alone. */
  describe("deferred money", () => {
    const bonilla = (team: string) =>
      player({ id: "bonilbo01", team, year: 1993 });
    const ohtani = (team: string) =>
      player({ id: "ohtansh01", team, year: 2024, pos: "SP/DH" });
    const fired = (p: BadgeRosterEntry) =>
      earnedBadges(f({ roster: [p] })).includes("deferred");

    it("pays Bonilla in a Mets uniform and Ohtani in a Dodgers one", () => {
      expect(fired(bonilla("NYM"))).toBe(true);
      expect(fired(ohtani("LAD"))).toBe(true);
    });

    it("leaves Bonilla's other four uniforms alone", () => {
      for (const team of ["PIT", "BAL", "FLA"]) {
        expect(fired(bonilla(team)), `bonilbo01 on ${team}`).toBe(false);
      }
    });

    it("leaves Ohtani's Angels seasons alone", () => {
      expect(fired(ohtani("LAA"))).toBe(false);
    });

    it("never fires on a cross-pairing", () => {
      expect(fired(bonilla("LAD"))).toBe(false);
      expect(fired(ohtani("NYM"))).toBe(false);
    });

    it("ignores the club without the man, and the man without the club", () => {
      // A Met who is not Bonilla, and a Dodger who is not Ohtani.
      expect(fired(player({ id: "someguy01", team: "NYM" }))).toBe(false);
      expect(fired(player({ id: "someguy01", team: "LAD" }))).toBe(false);
    });

    it("fires once when both contracts are on the same club", () => {
      const got = earnedBadges(f({ roster: [bonilla("NYM"), ohtani("LAD")] }));
      expect(got.filter((k) => k === "deferred")).toHaveLength(1);
    });
  });

  /** 💊 is keyed to the person and never to the season, because a suspension
   * is a fact the man carries into every uniform he ever wore. The negative
   * case is the one worth pinning: the two collision ids that look like
   * matches by name and are different people. badges-supply holds the other
   * half — that all four ids are still draftable. */
  describe("the drug suspensions", () => {
    const fired = (id: string) =>
      earnedBadges(f({ roster: [player({ id })] })).includes("suspended");

    it("fires on a suspended player in any uniform, in any year", () => {
      expect(fired("rodrial01")).toBe(true);
      expect(
        earnedBadges(
          f({ roster: [player({ id: "palmera01", team: "TEX", year: 1993 })] }),
        ),
      ).toContain("suspended");
    });

    it("leaves the two name collisions alone", () => {
      // The 2007 Royals pitcher, not the Brewers outfielder.
      expect(fired("braunry01")).toBe(false);
      expect(fired("braunry02")).toBe(true);
      // The 1997–2002 pitcher, not the slugger.
      expect(fired("cruzne01")).toBe(false);
      expect(fired("cruzne02")).toBe(true);
    });

    it("fires once for a club carrying several of them", () => {
      const got = earnedBadges(
        f({
          roster: [
            player({ id: "rodrial01" }),
            player({ id: "braunry02" }),
            player({ id: "canoro01" }),
          ],
        }),
      );
      expect(got.filter((k) => k === "suspended")).toHaveLength(1);
    });

    it("spares a club with nobody on the list", () => {
      expect(earnedBadges(f({ roster: club(8) }))).not.toContain("suspended");
    });
  });

  /** 🎲 has two paths to the same badge — a man on the roster, or Rose in the
   * dugout — and the second is what makes it reachable at all. It mirrors 🗑️,
   * which also counts the skipper's seat. */
  describe("the betting cloud", () => {
    it("fires on any of the four men, wherever they played", () => {
      for (const id of ["rosepe01", "marcatu01", "claseem01", "ortizlu03"]) {
        expect(
          earnedBadges(f({ roster: [player({ id })] })),
          id,
        ).toContain("gambling");
      }
    });

    it("takes it from Rose in the dugout, across all five Reds years", () => {
      for (const year of [1985, 1986, 1987, 1988, 1989]) {
        expect(
          earnedBadges(f({ roster: club(8), managerTeam: "CIN", managerYear: year })),
          `CIN ${year}`,
        ).toContain("gambling");
      }
    });

    it("spares the Reds before and after him, and every other dugout", () => {
      for (const year of [1984, 1990, 1995]) {
        expect(
          earnedBadges(f({ roster: club(8), managerTeam: "CIN", managerYear: year })),
          `CIN ${year}`,
        ).not.toContain("gambling");
      }
      expect(
        earnedBadges(f({ roster: club(8), managerTeam: "PIT", managerYear: 1986 })),
      ).not.toContain("gambling");
      // Half a dugout is not half a scandal.
      expect(
        earnedBadges(f({ roster: club(8), managerTeam: "CIN", managerYear: null })),
      ).not.toContain("gambling");
    });

    it("fires once when Rose is both signed and hired", () => {
      const got = earnedBadges(
        f({
          roster: [player({ id: "rosepe01", name: "Pete Rose" })],
          managerTeam: "CIN",
          managerYear: 1985,
          managerName: "Pete Rose",
        }),
      );
      expect(got.filter((k) => k === "gambling")).toHaveLength(1);
      // …and the player-manager badge comes along, which is the correct and
      // quite funny outcome: Rose is the reason 📋 exists.
      expect(got).toContain("playermanager");
    });
  });

  /** The two seed badges. Both read a boolean the engine resolves, and both
   * fields are optional — a fact set assembled before they existed must earn
   * neither rather than earning one by default. */
  describe("seed provenance", () => {
    it("takes the asterisk for a seed already in the log", () => {
      expect(earnedBadges(f({ replayedSeed: true }))).toContain("asterisk");
      expect(earnedBadges(f({ replayedSeed: false }))).not.toContain(
        "asterisk",
      );
    });

    it("takes word of mouth for a code that came from somewhere else", () => {
      expect(earnedBadges(f({ sharedSeed: true }))).toContain("wordofmouth");
      expect(earnedBadges(f({ sharedSeed: false }))).not.toContain(
        "wordofmouth",
      );
    });

    it("earns neither when the facts predate the fields", () => {
      const got = earnedBadges(BASE);
      expect(got).not.toContain("asterisk");
      expect(got).not.toContain("wordofmouth");
    });
  });

  /** The two poles of the year axis. 📆 is existential over the decade
   * buckets — SOME decade holds five — and never over a named one, which is
   * what keeps the short 1985–89 and 2020–25 buckets from making the badge
   * mean different things in different eras. */
  describe("the shape of the years", () => {
    const years = (ys: number[]) =>
      earnedBadges(f({ roster: ys.map((year) => player({ year })) }));

    it("takes the decade at five from one bucket, and not at four", () => {
      expect(years([1991, 1994, 1997, 1998, 1999])).toContain("decade");
      expect(years([1991, 1994, 1997, 1998, 2000])).not.toContain("decade");
    });

    it("counts the bucket, not the span — 1999 and 1990 are one decade", () => {
      expect(years([1990, 1993, 1995, 1997, 1999])).toContain("decade");
      // …and five consecutive years across a bucket edge are not.
      expect(years([1998, 1999, 2000, 2001, 2002])).not.toContain("decade");
    });

    it("takes forty years apart at the full width of the dataset", () => {
      expect(years([1985, 2025])).toContain("fortyyears");
      expect(years([1985, 2024])).not.toContain("fortyyears");
      expect(years([1986, 2025])).not.toContain("fortyyears");
    });

    it("earns no span at all from an empty roster", () => {
      expect(earnedBadges(f({ roster: [] }))).not.toContain("fortyyears");
    });

    it("stacks the two when a club really does both", () => {
      // Five 1985s plus a 2025 is a committed decade AND both ends of the
      // dataset. Measured at 0.06%, and it should be told rather than hidden.
      const got = years([1985, 1985, 1985, 1985, 1985, 2025]);
      expect(got).toContain("decade");
      expect(got).toContain("fortyyears");
    });
  });

  it("survives an empty dugout", () => {
    expect(earnedBadges(f({ managerTeam: null, managerYear: null }))).toEqual(
      [],
    );
    expect(
      earnedBadges(
        f({ roster: club(8), managerTeam: null, managerYear: null }),
      ),
    ).not.toContain("signstealing");
    // A year without a team, or a team without a year, is not half a scandal.
    expect(
      earnedBadges(f({ managerTeam: "HOU", managerYear: null })),
    ).not.toContain("signstealing");
    expect(
      earnedBadges(f({ managerTeam: null, managerYear: 2017 })),
    ).not.toContain("signstealing");
  });
});

describe("the earned list as a whole", () => {
  it("returns nothing for a thoroughly average season", () => {
    expect(earnedBadges(BASE)).toEqual([]);
  });

  it("only ever returns keys the table owns", () => {
    const got = earnedBadges(
      f({
        baselineWins: 120,
        baselineLosses: 42,
        total: 200,
        spendM: 139.9,
        budgetBonus: 10,
        scoutHits: 9,
        roster: club(8, { awards: ["AS"], war: 6, year: 1994 }),
        rings: 5,
        awardPoints: 40,
        managerMoty: true,
      }),
    );
    for (const k of got) expect(BADGE_BY_KEY[k]).toBeDefined();
    expect(new Set(got).size).toBe(got.length);
  });

  it("deals the axes out in pill-row order: on-field, goal, payroll, scout, roster, era", () => {
    const got = earnedBadges(
      f({
        baselineWins: 120,
        baselineLosses: 42,
        total: 200,
        spendM: 139.9,
        budgetBonus: 10,
        scoutHits: 9,
        roster: club(8, { awards: ["AS"], war: 6, year: 2020, pos: "SP/DH" }),
        rings: 5,
        awardPoints: 40,
        managerMoty: true,
      }),
    );
    // 🧗 and 📆 come along for the ride and belong in the list: BASE spends no
    // powerups, so a 120-win season is a handicap run, and eight 2020 seasons
    // are eight players in one decade bucket. ⚖️ does too — eight identical
    // 6.0-WAR seats are a club with no drop-off at all, which is the trigger.
    expect(got).toEqual([
      "crown",
      "perfect",
      "dime",
      "crystal",
      "allstars",
      "twoway",
      "noweak",
      "balanced",
      "cooperstown",
      "rings",
      "skipper",
      "hardway",
      "covid",
      "decade",
    ]);
  });
});

describe("the family badges", () => {
  const molina = (id: string) => player({ id });

  it("fires on a brother pair and not on one brother alone", () => {
    expect(earnedBadges(f({ roster: [molina("molinbe01")] }))).not.toContain(
      "brothers",
    );
    expect(
      earnedBadges(f({ roster: [molina("molinbe01"), molina("molinjo01")] })),
    ).toContain("brothers");
  });

  it("fires on a father and son", () => {
    // The Griffeys are the one pair who ever shared a real clubhouse.
    expect(
      earnedBadges(f({ roster: [molina("griffke01"), molina("griffke02")] })),
    ).toContain("fatherson");
  });

  it("does not confuse a father-son pair for brothers, or the reverse", () => {
    const griffeys = earnedBadges(
      f({ roster: [molina("griffke01"), molina("griffke02")] }),
    );
    expect(griffeys).not.toContain("brothers");
    const alomars = earnedBadges(
      f({ roster: [molina("alomaro01"), molina("alomasa02")] }),
    );
    expect(alomars).not.toContain("fatherson");
  });

  it("lights both badges for a family that is both", () => {
    // Bob Boone fathered Bret and Aaron, who are brothers to each other.
    const out = earnedBadges(
      f({
        roster: [molina("boonebo01"), molina("boonebr01"), molina("booneaa01")],
      }),
    );
    expect(out).toContain("fatherson");
    expect(out).toContain("brothers");
  });

  it("wants all three Molinas for the three-brother rung", () => {
    const two = earnedBadges(
      f({ roster: [molina("molinbe01"), molina("molinjo01")] }),
    );
    expect(two).not.toContain("threebrothers");
    const three = earnedBadges(
      f({
        roster: [molina("molinbe01"), molina("molinjo01"), molina("molinya01")],
      }),
    );
    expect(three).toContain("threebrothers");
    // The pair badge stands alongside it rather than being superseded.
    expect(three).toContain("brothers");
  });

  it("does not fire on two men from different families", () => {
    expect(
      earnedBadges(f({ roster: [molina("molinbe01"), molina("griffke02")] })),
    ).not.toContain("brothers");
  });

  it("keeps every listed id draftable and every pair distinct", () => {
    for (const list of [BROTHERS, FATHER_SON]) {
      for (const [a, b] of list) expect(a).not.toBe(b);
    }
    const seen = new Set(BROTHERS.map((p) => [...p].sort().join()));
    expect(seen.size).toBe(BROTHERS.length);
  });
});

/** The anonymous half of the on-field ladder, and the copy that keeps its two
 * records apart. Both are data claims about the table rather than trigger
 * behavior, which is why they sit here and not in trophycase.test.ts: the
 * rendering of a silhouette is pinned there, the decision about WHICH badges
 * get one is pinned here. */
describe("the silhouetted peaks and rungs", () => {
  /** Every badge whose locked slot withholds its name. BadgePill branches on
   * `locked && (ironic || secret)`, so `secret` is the only lever, and setting
   * it is the whole mechanism — no tier is consulted. */
  const anonymous = (key: string) =>
    BADGE_BY_KEY[key].secret === true || BADGE_BY_KEY[key].ironic === true;

  it("withholds both peaks", () => {
    // 👑 and 🏆 are the two ends the ladder exists to deliver. Naming them on
    // a case nobody has filled spends the surprise before it is earned.
    for (const key of ["crown", "perfect"]) {
      expect(BADGE_BY_KEY[key].secret).toBe(true);
      expect(anonymous(key)).toBe(true);
    }
  });

  it("withholds every exact-match rung", () => {
    // Named, an exact rung is a farmable target — "go win exactly 103". The
    // list is read off MATCHED rather than written out, so a rung added to the
    // ladder cannot ship named by omission.
    const rungs = Object.values(MATCHED);
    expect(rungs).toHaveLength(6);
    for (const key of rungs) {
      expect(BADGE_BY_KEY[key].secret).toBe(true);
      expect(anonymous(key)).toBe(true);
    }
  });

  it("keeps 💯 named, so the axis still has a direction", () => {
    // The one rung a player can aim at, and the reason the rest can be
    // secret: a fresh case still says "a hundred wins is a thing".
    expect(BADGE_BY_KEY.hundred.secret).toBeUndefined();
    expect(anonymous("hundred")).toBe(false);
  });

  it("leaves the anti-trophies anonymous without marking them secret", () => {
    // `ironic` already withholds the name. Marking these `secret` as well
    // would be redundant, and no shipped badge carries both flags.
    for (const b of BADGES) expect(b.secret === true && b.ironic === true).toBe(false);
    for (const key of ["dayjob", "worst", "skull"]) expect(anonymous(key)).toBe(true);
  });
});

/** The on-field axis reads two different records, so every string on it names
 * the one it means. The measure words are the finale's own: the ledger's first
 * row is labelled "Baseline wins", and the giant W–L is the record it stamps. */
describe("the how copy names its measure", () => {
  const how = (key: string) => BADGE_BY_KEY[key].how;

  it("makes the on-field rungs name BOTH records", () => {
    // Every rung is picked by the baseline and kept on the stamp, so the copy
    // says so rather than hedging about which number the badge means.
    for (const key of ["crown", ...Object.values(MATCHED), "hundred"]) {
      expect(how(key).toLowerCase()).toContain("baseline wins");
      expect(how(key).toLowerCase()).toContain("final record");
    }
  });

  it("sends every baseline-keyed badge to 'baseline wins'", () => {
    // Read off MATCHED for the rungs, so a new rung cannot ship unlabelled.
    const baselineKeyed = [
      "crown",
      ...Object.values(MATCHED),
      "hundred",
      "pinch",
      "skipper",
      "hardway",
      "pocket",
    ];
    for (const key of baselineKeyed) {
      expect(how(key).toLowerCase()).toContain("baseline wins");
      // …and never claims the stamp, which is the confusion being fixed.
      expect(how(key).toLowerCase()).not.toContain("stamp");
    }
  });

  it("sends every floor rung to the stamped record", () => {
    // 👔 / 📉 / 💀 read f.stamp, the record the finale prints. An anti-trophy
    // has to name something the player can see.
    for (const key of ["dayjob", "worst", "skull"]) {
      expect(how(key).toLowerCase()).toContain("the finale stamps");
      expect(how(key).toLowerCase()).not.toContain("baseline");
    }
  });

  it("keeps 🎲's label a category and its trigger copy exact", () => {
    // The label names the rule on the clubhouse wall; the `how` keeps it as a
    // class (MLB gambling suspensions) rather than naming individual statuses,
    // which date quickly and cannot be compressed without risking a verdict on
    // open cases. The non-guilty assertion below survives the shortening.
    expect(BADGE_BY_KEY.gambling.label).toBe("BET ON BASEBALL");
    const s = BADGE_BY_KEY.gambling.how;
    expect(s).toBe("Signed or hired a player MLB suspended under its gambling rules.");
    // Nothing in it may assert a verdict on any player's open case.
    expect(s).not.toMatch(/Clase[^.]*(caught|convicted|banned)/);
  });

  it("gives NO SCRUBS the soap, at one code point", () => {
    // The glyph tracks the label. One code point, so the share string's emoji
    // run costs exactly what it did — share.test.ts derives its ceiling from
    // this table and is not edited for a glyph swap.
    expect(BADGE_BY_KEY.noweak.emoji).toBe("\u{1F9FC}");
    expect([...BADGE_BY_KEY.noweak.emoji]).toHaveLength(1);
    // And it collides with nothing else in the set.
    const glyphs = BADGES.map((b) => b.emoji);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it("gives every badge a non-empty name in mixed case", () => {
    // `name` is the tooltip shown on hover — title case rather than all-caps.
    // Pure acronyms (WBC, MVP) would be ≤4 chars and are the only names allowed
    // to be fully uppercase. Everything else must differ from its label
    // (which is always all-caps) so the tooltip reads naturally.
    for (const b of BADGES) {
      expect(b.name, `${b.key}.name is empty`).toBeTruthy();
      // Not identical to the all-caps label unless it is a ≤4-char acronym.
      const isSingleAcronym =
        !b.label.includes(" ") && b.label.length <= 4 && b.label === b.label.toUpperCase();
      if (!isSingleAcronym) {
        expect(b.name, `${b.key}.name matches all-caps label`).not.toBe(b.label);
      }
      // No name is fully uppercase unless it is ≤4 chars (a pure acronym).
      if (b.name.length > 4) {
        expect(b.name, `${b.key}.name is all-caps`).not.toBe(b.name.toUpperCase());
      }
    }
  });

  it("ends every how string with a period", () => {
    // Punctuation-invariant: a sentence that does not end with a period reads
    // as truncated. Every future badge addition must satisfy this too.
    for (const b of BADGES) {
      expect(b.how, `${b.key}.how missing terminal period`).toMatch(/\.$/);
    }
  });
});

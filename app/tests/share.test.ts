import { describe, expect, it } from "vitest";
import { BADGES } from "../src/lib/badges";
import { parseSeedCode, recordFromTotal } from "../src/lib/format";
import { GAMES, MARINERS_WINS } from "../src/lib/scoring";
import { SLOT_TYPES } from "../src/lib/types";
import {
  shareCells,
  shareGrid,
  shareRecord,
  shareScoreLine,
  shareText,
  shareTitle,
  type ShareInput,
} from "../src/lib/share";

/** An unremarkable finale: default modes, a full roster, a hired skipper, no
 * badges. Every test overrides only the field it is about. */
const BASE: ShareInput = {
  difficulty: "standard",
  bank: "classic",
  total: 104.3,
  managerWins: 2.4,
  roster: [3.1, 5.2, 2.0, 4.4, 1.2, 6.6, 3.8, 0.7],
};

/** Badges cross this boundary as KEYS — which triggers fired is lib/badges'
 * business (tests/badges.test.ts), and the string's business is turning that
 * list into a line that can't break the format. */
const FOUR = ["mariners", "perfect", "dime", "crystal"];

/** The mutually exclusive badge groups, one per `if / else if` chain in
 * `earnedBadges` — a season takes at most one key from each.
 *
 * Structural, not editorial: every group below is a chain in the source, so
 * "these cannot co-occur" is a fact about control flow rather than a judgment
 * about baseball. Semantic exclusions that are NOT chains (🏅 ALL-STAR ROSTER
 * can never share a club with 🕸️ EMPTY TROPHY CASE) are deliberately left out
 * — counting both only overstates the ceiling, and this list must never
 * understate it. */
const EXCLUSIVE: Record<string, string[]> = {
  // The on-field ladder: onFieldBadge returns one rung, and the floor rungs
  // hang off the same else-chain beneath it.
  onfield: [
    "crown",
    "mariners",
    "yankees",
    "mets",
    "astros",
    "cubs",
    "redsox",
    "hundred",
    "dayjob",
    "worst",
    "skull",
  ],
  // Four faces of one payroll axis, busted to stingiest.
  payroll: ["farm", "dime", "pinch", "pocket"],
  // "Won nothing at all" supersedes "nobody made the trip".
  hardware: ["nohardware", "noallstars"],
  // Spent none vs spent all, both gated on there being powerups to spend.
  powerups: ["hardway", "toolbox"],
};

const codePoints = (s: string) => [...s].length;
const emojiOf = (key: string) => BADGES.find((b) => b.key === key)!.emoji;
/** A badge's cost on line five: its emoji alone, which is not reliably one
 * code point (🏛️, 🗑️, 🕸️, 🏖️ each carry a variation selector). The emoji butt
 * against each other, so a badge costs no separator — the whole run is one
 * part of the line and buys exactly one space, wherever it is counted. */
const badgeCost = (key: string) => codePoints(emojiOf(key));

/** The longest badge list the trigger set can produce, DERIVED: every badge
 * that stacks freely, plus the priciest member of each exclusive group.
 *
 * Derived rather than hand-listed because the hand-listed version rotted — it
 * was written at 13 badges and still said 13 after the set grew past 40, so
 * the budget it pinned had quietly stopped describing the shipped worst case.
 * A badge added tomorrow is stackable unless it is named in EXCLUSIVE above,
 * and stackable is the conservative default: an unclassified badge WIDENS the
 * ceiling, so the test tightens on its own rather than silently going slack.
 *
 * This is an upper bound on the triggers, not a reachable season: eight roster
 * seats cannot simultaneously hold three Molinas, a 1994 striker, a 1995
 * replacement player, a 2020 season, and a 2017 Astro. Nothing asserts it is
 * reachable — only that the format survives it. */
const MAXIMAL = (() => {
  const grouped = new Set(Object.values(EXCLUSIVE).flat());
  const priciest = Object.values(EXCLUSIVE).map((g) =>
    g.reduce((a, b) => (badgeCost(b) > badgeCost(a) ? b : a)),
  );
  return [
    ...priciest,
    ...BADGES.map((b) => b.key).filter((k) => !grouped.has(k)),
  ];
})();

describe("the exclusion map tracks the badge set", () => {
  it("names only badges that exist", () => {
    for (const [group, keys] of Object.entries(EXCLUSIVE)) {
      for (const k of keys) {
        expect(
          BADGES.some((b) => b.key === k),
          `${group} names unknown badge ${k}`,
        ).toBe(true);
      }
    }
  });

  it("puts every badge in at most one group", () => {
    const all = Object.values(EXCLUSIVE).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it("accounts for every badge exactly once — grouped or stacking", () => {
    const grouped = new Set(Object.values(EXCLUSIVE).flat());
    const stacking = BADGES.filter((b) => !grouped.has(b.key));
    expect(grouped.size + stacking.length).toBe(BADGES.length);
    // One representative per group, plus every stacker.
    expect(MAXIMAL).toHaveLength(
      Object.keys(EXCLUSIVE).length + stacking.length,
    );
    expect(new Set(MAXIMAL).size).toBe(MAXIMAL.length);
  });
});

describe("shareText golden strings", () => {
  it("renders a plain season, bare record line", () => {
    expect(shareText(BASE)).toBe(
      ["HOT STOVE 📊💼", "🟩🟢🔵", "🟢🔵⚪", "🟣🟢⚪", "104–58"].join("\n"),
    );
  });

  it("renders a strong season in opt-in modes with four badges on the line", () => {
    expect(
      shareText({
        difficulty: "scout",
        bank: "moneyball",
        total: 165.7,
        managerWins: 8.2,
        roster: [8.9, 6.4, 9.1, 7.2, 4.5, 10.3, 6.8, 5.1],
        badges: FOUR,
      }),
    ).toBe(
      [
        "HOT STOVE 🔭⚾",
        "🟨🟡🟣",
        "🟡🟣🔵",
        "🟡🟣🔵",
        "162–0 🔱🏆💵🔮",
      ].join("\n"),
    );
  });

  it("renders a disaster: brick manager, skull and money-bag badges", () => {
    expect(
      shareText({
        difficulty: "standard",
        bank: "blankcheck",
        total: 41.2,
        managerWins: -5.4,
        roster: [-1.2, 0.4, 1.1, -0.3, 0.9, 1.8, 0.2, -0.8],
        badges: ["skull", "farm"],
      }),
    ).toBe(
      ["HOT STOVE 📊💸", "🟥🔴⚪", "⚪🔴⚪", "⚪⚪🔴", "41–121 💀💸"].join(
        "\n",
      ),
    );
  });

  it("renders an unhired skipper as a black cell in the top-left", () => {
    expect(
      shareText({
        ...BASE,
        total: 88.6,
        managerWins: null,
        roster: [2.2, 4.9, 3.0, 1.4, 0.1, 5.5, 2.7, 3.9],
      }),
    ).toBe(
      ["HOT STOVE 📊💼", "⬛🟢🔵", "🟢⚪⚪", "🔵🟢🟢", "89–73"].join("\n"),
    );
  });

  it("renders a single below-replacement player as the one brick in the grid", () => {
    const s = shareText({
      difficulty: "scout",
      bank: "classic",
      total: 96.5,
      managerWins: 4.0,
      roster: [4.2, -1.4, 3.3, 6.1, 2.8, 5.0, 2.1, 1.6],
      badges: ["dime"],
    });
    expect(s).toBe(
      ["HOT STOVE 🔭💼", "🟦🔵🔴", "🟢🟣🟢", "🔵🟢⚪", "97–65 💵"].join("\n"),
    );
    expect([...s].filter((c) => c === "🔴")).toHaveLength(1);
  });

  it("trails the score line with a seed code when one is supplied", () => {
    expect(shareText({ ...BASE, seed: 0xa3f2 })).toBe(
      ["HOT STOVE 📊💼", "🟩🟢🔵", "🟢🔵⚪", "🟣🟢⚪", "104–58 #WDU"].join(
        "\n",
      ),
    );
    expect(
      shareText({ ...BASE, seed: 0xa3f2, badges: ["mariners", "perfect"] })
        .split("\n")
        .at(-1),
    ).toBe("104–58 🔱🏆 #WDU");
  });
});

/** The format's core invariant. Every one of these is a game the engine can
 * actually produce or a degenerate case a caller could hand over; none of them
 * is allowed to change the string's height. */
const SHAPES: ShareInput[] = [
  BASE,
  { ...BASE, badges: [] },
  { ...BASE, badges: ["mariners"] },
  { ...BASE, badges: FOUR },
  { ...BASE, badges: MAXIMAL },
  { ...BASE, badges: ["nosuchbadge"] },
  { ...BASE, badges: BADGES.map((b) => b.key) },
  { ...BASE, managerWins: null },
  { ...BASE, roster: [], managerWins: null },
  { ...BASE, roster: [null, null, null, null, null, null, null, null] },
  { ...BASE, roster: [1, 2, 3] },
  { ...BASE, roster: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { ...BASE, total: -50 },
  { ...BASE, total: 0, managerWins: null, roster: [] },
  { ...BASE, total: 400, seed: 0xffffffff, badges: FOUR },
  {
    difficulty: "scout",
    bank: "moneyball",
    total: 162,
    managerWins: 8,
    roster: [8, 8, 8, 8, 8, 8, 8, 8],
  },
];

describe("the five-line invariant", () => {
  it("is exactly five lines for every game state", () => {
    for (const c of SHAPES) expect(shareText(c).split("\n")).toHaveLength(5);
  });

  it("never emits a blank line", () => {
    for (const c of SHAPES)
      for (const line of shareText(c).split("\n")) expect(line).not.toBe("");
  });

  it("never ends the string with a newline", () => {
    for (const c of SHAPES) expect(shareText(c)).not.toMatch(/\n$/);
  });

  it("puts the title first and keeps it free of digits", () => {
    for (const c of SHAPES) {
      const first = shareText(c).split("\n")[0];
      expect(first).toBe(shareTitle(c.difficulty, c.bank));
      expect(first).not.toMatch(/\d/);
    }
  });

  it("puts the three grid rows on lines two through four", () => {
    for (const c of SHAPES) {
      expect(shareText(c).split("\n").slice(1, 4).join("\n")).toBe(
        shareGrid(c.roster, c.managerWins),
      );
    }
  });

  it("starts line five with the record, badges or not", () => {
    for (const c of SHAPES) {
      const last = shareText(c).split("\n")[4];
      expect(last.startsWith(shareRecord(c.total))).toBe(true);
      expect(last).toMatch(/^\d+–\d+/);
    }
  });
});

describe("line five has no trailing whitespace", () => {
  it("is a bare record when no badge fires", () => {
    const last = shareText(BASE).split("\n")[4];
    expect(last).toBe("104–58");
    expect(last).not.toMatch(/\s$/);
  });

  it("holds for an empty badge list, an absent one, and a populated one", () => {
    for (const badges of [
      undefined,
      [],
      ["mariners"],
      FOUR,
      MAXIMAL,
      ["nosuchbadge"],
    ]) {
      const last = shareText({ ...BASE, badges }).split("\n")[4];
      expect(last).not.toMatch(/\s$/);
    }
  });

  it("separates the record from its badges with exactly one space", () => {
    expect(shareScoreLine(104.3, ["mariners", "perfect"])).toBe("104–58 🔱🏆");
    expect(shareScoreLine(104.3, [])).toBe("104–58");
    expect(shareScoreLine(104.3)).toBe("104–58");
  });

  /** The badges are one haul, not a list of remarks: however many fire, the
   * line spends exactly one space on them, and the seed keeps its own. */
  it("spends no space between one badge and the next", () => {
    for (const badges of [FOUR, MAXIMAL, BADGES.map((b) => b.key)]) {
      const last = shareText({ ...BASE, badges }).split("\n")[4];
      expect(last.split(" ")).toHaveLength(2);
    }
    expect(shareText({ ...BASE, badges: FOUR, seed: 0xa3f2 }).split("\n")[4].split(" "))
      .toHaveLength(3);
  });
});

/** The string spends emoji it does not choose: which badges fired is decided
 * once, at the finale, and travels as keys. A key the badge set no longer owns
 * — a save written before a badge was retired — must vanish rather than print
 * an empty slot or a stray space. */
describe("badges cross the boundary as keys", () => {
  it("resolves every key in the set to its own emoji, in the order given", () => {
    for (const b of BADGES)
      expect(shareScoreLine(104.3, [b.key])).toBe(`104–58 ${b.emoji}`);
    expect(shareScoreLine(104.3, ["perfect", "mariners"])).toBe("104–58 🏆🔱");
    expect(shareScoreLine(104.3, ["mariners", "perfect"])).toBe("104–58 🔱🏆");
  });

  it("never prints a raw key", () => {
    const last = shareText({ ...BASE, badges: BADGES.map((b) => b.key) }).split(
      "\n",
    )[4];
    for (const b of BADGES) expect(last).not.toContain(b.key);
  });

  it("drops a key the badge set does not own", () => {
    expect(shareScoreLine(104.3, ["nosuchbadge"])).toBe("104–58");
    expect(shareScoreLine(104.3, ["nosuchbadge", "perfect"])).toBe("104–58 🏆");
    expect(shareScoreLine(104.3, ["", "perfect"])).toBe("104–58 🏆");
    expect(shareScoreLine(104.3, ["nosuchbadge"], 0xa3f2)).toBe("104–58 #WDU");
  });
});

describe("shareRecord", () => {
  it("never disagrees with the record the finale stamp renders", () => {
    for (const total of [
      -50, -0.4, 0, 41.2, 80.5, 81, 99.6, 104.3, 116, 142.4, 161.9, 162, 400,
    ]) {
      const { wins, losses } = recordFromTotal(total, GAMES, MARINERS_WINS);
      expect(shareRecord(total)).toBe(`${wins}–${losses}`);
      expect(shareText({ ...BASE, total }).split("\n")[4]).toBe(
        `${wins}–${losses}`,
      );
    }
  });

  it("rounds to the nearer win", () => {
    expect(shareRecord(117.6)).toBe("118–44");
    expect(shareRecord(117.4)).toBe("117–45");
  });

  it("clamps a blown-out negative total to 0–162 and a past-goal total to 162–0", () => {
    expect(shareRecord(-30)).toBe("0–162");
    expect(shareRecord(400)).toBe("162–0");
  });
});

describe("the optional seed", () => {
  it("round-trips back through parseSeedCode", () => {
    for (const seed of [0, 1, 35, 36, 0xa3f2, 0xdeadbeef, 0xffffffff]) {
      const code = shareScoreLine(104.3, [], seed).match(/#(\S+)$/)![1];
      expect(parseSeedCode(code)).toBe(seed);
      expect(parseSeedCode(`#${code.toLowerCase()}`)).toBe(seed);
    }
  });

  it("is off by default", () => {
    expect(shareText(BASE)).not.toContain("#");
  });
});

describe("shareTitle", () => {
  it("always stamps both mode emoji, defaults included", () => {
    expect(shareTitle("standard", "classic")).toBe("HOT STOVE 📊💼");
    expect(shareTitle("scout", "blankcheck")).toBe("HOT STOVE 🔭💸");
    expect(shareTitle("scout", "moneyball")).toBe("HOT STOVE 🔭⚾");
  });
});

describe("the grid is always 3×3", () => {
  const shapeOk = (grid: string) => {
    const rows = grid.split("\n");
    expect(rows).toHaveLength(3);
    for (const r of rows) expect([...r]).toHaveLength(3);
  };

  it("holds its shape for every game state", () => {
    for (const c of SHAPES) {
      shapeOk(shareGrid(c.roster, c.managerWins));
      expect(shareCells(c.roster, c.managerWins)).toHaveLength(9);
    }
  });

  it("holds its shape for an empty roster and no manager", () => {
    expect(shareGrid([], null)).toBe(["⬛⬛⬛", "⬛⬛⬛", "⬛⬛⬛"].join("\n"));
  });

  it("pads a short roster and truncates a long one", () => {
    expect(shareGrid([1, 2, 3], null)).toBe(
      ["⬛⚪🟢", "🟢⬛⬛", "⬛⬛⬛"].join("\n"),
    );
    shapeOk(shareGrid([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 0));
  });

  it("treats a null slot as empty without disturbing the slots after it", () => {
    expect(shareGrid([3.1, null, 2.0, 4.4, 1.2, 6.6, 3.8, 0.7], 2.4)).toBe(
      ["🟩🟢⬛", "🟢🔵⚪", "🟣🟢⚪"].join("\n"),
    );
  });

  it("has exactly one cell per roster slot plus the manager", () => {
    expect(shareCells(BASE.roster, BASE.managerWins)).toHaveLength(
      SLOT_TYPES.length + 1,
    );
  });

  it("lays the roster out in SLOT_TYPES order after the manager", () => {
    // Each slot gets a distinct tier so its landing cell is identifiable:
    // C=neg, IF=low, IF=mid, OF=high, FLEX=star, SP=elite, SP=neg, RP=low.
    expect(shareCells([-1, 0, 2, 4, 6, 8, -1, 0], 4)).toEqual([
      "🟦",
      "🔴",
      "⚪",
      "🟢",
      "🔵",
      "🟣",
      "🟡",
      "🔴",
      "⚪",
    ]);
  });
});

describe("cell shapes and colors", () => {
  const CIRCLES = ["🔴", "⚪", "🟢", "🔵", "🟣", "🟡"];
  const SQUARES = ["🟥", "⬜", "🟩", "🟦", "🟪", "🟨"];

  it("maps every WAR tier at its boundary to a player circle", () => {
    const at = (war: number) => shareCells([war], null)[1];
    expect(at(-0.1)).toBe("🔴");
    expect(at(0)).toBe("⚪");
    expect(at(1.9)).toBe("⚪");
    expect(at(2)).toBe("🟢");
    expect(at(3.9)).toBe("🟢");
    expect(at(4)).toBe("🔵");
    expect(at(5.9)).toBe("🔵");
    expect(at(6)).toBe("🟣");
    expect(at(7.9)).toBe("🟣");
    expect(at(8)).toBe("🟡");
    expect(at(12.5)).toBe("🟡");
  });

  it("maps the manager onto the same ladder as squares", () => {
    const at = (w: number) => shareCells([], w)[0];
    expect(at(-0.1)).toBe("🟥");
    expect(at(0)).toBe("⬜");
    expect(at(2)).toBe("🟩");
    expect(at(4)).toBe("🟦");
    expect(at(6)).toBe("🟪");
    expect(at(8)).toBe("🟨");
  });

  it("gives the manager a square and every player a circle", () => {
    const wars = [-1, 0, 2, 4, 6, 8, 3, 5];
    for (const mgr of [-1, 0, 2, 4, 6, 8]) {
      const cells = shareCells(wars, mgr);
      expect(SQUARES).toContain(cells[0]);
      for (const c of cells.slice(1)) expect(CIRCLES).toContain(c);
    }
  });

  it("distinguishes a manager from a player on the same rung", () => {
    for (const w of [-1, 0, 2, 4, 6, 8]) {
      expect(shareCells([w], w)[0]).not.toBe(shareCells([w], w)[1]);
    }
  });

  it("keeps the empty cell off both ladders", () => {
    const empty = shareCells([], null)[0];
    expect([...CIRCLES, ...SQUARES]).not.toContain(empty);
    expect(shareCells([], null)[1]).toBe(empty);
  });
});

describe("line width budget", () => {
  /** Line five is the longest the format can produce, and its length is the
   * badge list's to blow: the record maxes at six characters (`104–58`; `162–0`
   * and `0–162` are shorter), the title is a fixed 12, and a grid row is 3.
   *
   * The budget is derived from the badge table rather than written down as a
   * literal, because a badge's emoji is not reliably one code point — 🏛️, 🗑️,
   * 🕸️, and 🏖️ each carry a variation selector and cost two. Counting the emoji
   * from BADGES means a new badge widens the stated ceiling instead of
   * silently breaking a hand-computed one.
   *
   * Counted in code points, not visual width: emoji advance widths vary by
   * font, so no test can pin the latter. */
  const RECORD_LEN = 6;
  const SEED_LEN = 9; // " #" plus a seven-character code
  const cost = (keys: string[]) => keys.reduce((n, k) => n + badgeCost(k), 0);
  /** The record, plus the badge run and the ONE space that precedes it. A
   * seasonless line pays nothing for badges that did not fire. */
  const lineFive = (keys: string[]) =>
    RECORD_LEN + (keys.length > 0 ? 1 + cost(keys) : 0);

  /** The most decorated season the triggers allow, seedless — how it ships. */
  const SHIPPED_MAX_LEN = lineFive(MAXIMAL);
  /** Absolute paranoia bound: every badge in the set at once, plus a seed.
   * No game can earn this — the exclusive axes forbid it — so nothing the
   * engine produces may come near it. */
  const MAX_LEN = lineFive(BADGES.map((b) => b.key)) + SEED_LEN;

  it("pins the worst case the triggers allow", () => {
    // 32 badges — 4 group representatives + 28 stackers — over a 6-character
    // record. The number is asserted so that a badge added without thought
    // shows up as a failing width rather than a silently longer share line.
    expect(MAXIMAL).toHaveLength(32);
    expect(SHIPPED_MAX_LEN).toBe(50);
    // total 104.3 gives the six-character record; 400 would clamp to "162–0".
    const s = shareText({ ...BASE, total: 104.3, badges: MAXIMAL });
    expect(codePoints(s.split("\n")[4])).toBe(SHIPPED_MAX_LEN);
  });

  it("keeps every line inside the absolute budget at worst case", () => {
    expect(MAX_LEN).toBe(75);
    const s = shareText({
      ...BASE,
      total: 104.3,
      seed: 0xffffffff,
      badges: BADGES.map((b) => b.key),
    });
    expect(codePoints(s.split("\n")[4])).toBe(MAX_LEN);
    for (const line of s.split("\n"))
      expect(codePoints(line)).toBeLessThanOrEqual(MAX_LEN);
  });

  it("keeps every seedless line inside the shipped budget", () => {
    // Only the deliberate every-badge-at-once shape is exempt: it hands over
    // keys from groups the triggers can never both emit, so it is the paranoia
    // bound MAX_LEN covers, not a season. Every other shape must fit.
    const exempt = (c: ShareInput) => (c.badges?.length ?? 0) > MAXIMAL.length;
    const checked = SHAPES.filter((c) => c.seed === undefined && !exempt(c));
    expect(SHAPES.filter(exempt)).toHaveLength(1);
    for (const c of checked) {
      for (const line of shareText(c).split("\n")) {
        expect(codePoints(line)).toBeLessThanOrEqual(SHIPPED_MAX_LEN);
      }
    }
  });

  it("keeps a four-badge line — the pill row's cap — well under the ceiling", () => {
    const s = shareText({ ...BASE, total: 104.3, badges: FOUR });
    expect(codePoints(s.split("\n")[4])).toBe(11);
  });

  it("pins the title's width", () => {
    expect(codePoints(shareTitle("standard", "classic"))).toBe(12);
  });
});

describe("degenerate inputs", () => {
  it("renders a game with nothing drafted at all", () => {
    expect(
      shareText({ ...BASE, total: 50, managerWins: null, roster: [] }),
    ).toBe(
      ["HOT STOVE 📊💼", "⬛⬛⬛", "⬛⬛⬛", "⬛⬛⬛", "50–112"].join("\n"),
    );
  });

  it("renders a negative total without a minus sign leaking into the record", () => {
    const s = shareText({
      ...BASE,
      total: -12.5,
      managerWins: null,
      roster: [],
    });
    expect(s.split("\n")[4]).toBe("0–162");
    expect(s).not.toContain("-");
  });

  it("renders a roster of nothing but nulls", () => {
    expect(
      shareGrid([null, null, null, null, null, null, null, null], null),
    ).toBe(["⬛⬛⬛", "⬛⬛⬛", "⬛⬛⬛"].join("\n"));
  });

  it("renders a zero-WAR roster and a zero-win manager as replacement level", () => {
    expect(shareGrid([0, 0, 0, 0, 0, 0, 0, 0], 0)).toBe(
      ["⬜⚪⚪", "⚪⚪⚪", "⚪⚪⚪"].join("\n"),
    );
  });
});

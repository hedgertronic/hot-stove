/** The data facts the badge set stands on (src/lib/badges).
 *
 * Every assertion here breaks SILENTLY without this file. A badge label names
 * a real club — "MATCHED THE 2004 RED SOX" — but the trigger is a bare number,
 * so a data regen that moved Boston's 2004 total to 97 would leave 98 wins
 * awarding a badge for a season that no longer exists at 98. Nothing in the
 * app would throw and no unit test over forged facts could notice: the badge
 * table is arithmetically fine and only the claim it makes about baseball has
 * gone wrong.
 *
 * Reads data/cards/*.json off disk, the same source the engine fetches at
 * runtime (see tests/bots/harness.ts for the fetch-boundary stub). No engine,
 * no fixtures — just the cards and the labels.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BADGES,
  CAPTAIN,
  CROWN_WINS,
  GAMBLERS,
  MATCHED,
  SUSPENDED,
  WALK_OFF_SEASONS,
  WORST_WINS,
} from "../src/lib/badges";

interface CardPlayerRow {
  /** The stable id 🏦 keys on — a name is not enough, the trigger reads ids. */
  id: string;
  name: string;
  pos: string;
  war: number;
  awards: string[];
  age?: number;
  posG?: { c?: number; if?: number; of?: number };
  /** In the Hall of Fame as a player. */
  hof?: boolean;
  /** Wore a World Series ring that season — the fact 🎆 THE WALK-OFF's three
   * seasons all have to keep carrying. */
  ws: boolean;
  /** Birth country, as the pipeline normalizes it. */
  bc?: string;
}
interface CardRow {
  year: number;
  team: string;
  wins: number;
  losses: number;
  ws: boolean;
  manager: string | null;
  /** This card's skipper is in the Hall of Fame as a manager. */
  managerHof?: boolean;
  players: CardPlayerRow[];
}
interface IndexRow {
  team: string;
  year: number;
  franchise: string;
  lg?: string;
  div?: string;
}

const DATA_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..", "data");
const readJson = <T,>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(DATA_ROOT, rel), "utf8")) as T;

/** Every card the game can deal, walked through index.json — the same list the
 * engine loads from, so a card on disk that the index forgot is invisible here
 * for the same reason it is invisible in play. */
const INDEX = readJson<{ cards: IndexRow[] }>("index.json");
const CARDS: CardRow[] = INDEX.cards.map((c) =>
  readJson<CardRow>(`cards/${c.team}_${c.year}.json`),
);

const card = (team: string, year: number): CardRow => {
  const hit = CARDS.find((c) => c.team === team && c.year === year);
  expect(hit, `${team} ${year} is missing from data/cards`).toBeDefined();
  return hit!;
};

/** Each named rung, the club it claims, and whether that club won the Series.
 * SEA 2001 is the one entry that did not — it is the RECORD rung, and the file
 * comment in badges.ts turns on exactly that distinction. */
const RUNGS: { badge: string; team: string; year: number; wins: number; ws: boolean }[] = [
  { badge: "redsox", team: "BOS", year: 2004, wins: 98, ws: true },
  { badge: "cubs", team: "CHC", year: 2016, wins: 103, ws: true },
  { badge: "astros", team: "HOU", year: 2022, wins: 106, ws: true },
  { badge: "mets", team: "NYM", year: 1986, wins: 108, ws: true },
  { badge: "yankees", team: "NYY", year: 1998, wins: 114, ws: true },
  { badge: "mariners", team: "SEA", year: 2001, wins: 116, ws: false },
];

describe("the cards are readable at all", () => {
  it("loads a full season's worth of clubs, each with a roster", () => {
    expect(CARDS.length).toBeGreaterThan(1000);
    for (const c of CARDS) expect(c.players.length).toBeGreaterThan(0);
  });
});

describe("the named rungs still stand on their clubs", () => {
  it("holds every rung's exact win total", () => {
    for (const r of RUNGS) expect(card(r.team, r.year).wins, `${r.team} ${r.year}`).toBe(r.wins);
  });

  it("keeps every champion rung a champion, and the record rung not one", () => {
    for (const r of RUNGS) expect(card(r.team, r.year).ws, `${r.team} ${r.year}`).toBe(r.ws);
    expect(RUNGS.filter((r) => !r.ws)).toEqual([
      { badge: "mariners", team: "SEA", year: 2001, wins: 116, ws: false },
    ]);
  });

  it("has one rung per total in MATCHED, and no orphan labels", () => {
    expect(Object.keys(MATCHED)).toHaveLength(RUNGS.length);
    for (const r of RUNGS) expect(MATCHED[r.wins]).toBe(r.badge);
    for (const key of Object.values(MATCHED)) {
      expect(BADGES.some((b) => b.key === key), `${key} has no badge`).toBe(true);
    }
  });

  it("keeps 116 the most wins anyone in the set ever managed", () => {
    const most = Math.max(...CARDS.map((c) => c.wins));
    expect(most).toBe(116);
    // Which is what makes 117 "best record of all time" rather than a rung.
    expect(CROWN_WINS).toBe(most + 1);
    const holders = CARDS.filter((c) => c.wins === most).map((c) => `${c.team} ${c.year}`);
    expect(holders).toEqual(["SEA 2001"]);
  });

  /** The floor's mirror of the 116/CROWN_WINS pin above. 📉 claims to sit
   * below the worst record anyone ever posted, so it has to sit one win under
   * the real minimum — and the minimum must be read off FULL seasons only.
   * 1994, 1995, and 2020 were all shortened, and their sub-40-win totals are
   * short schedules rather than bad clubs; counting them would drag WORST_WINS
   * down to a number no 162-game season could ever reach. */
  it("keeps 41 the fewest wins any full season in the set managed", () => {
    const full = CARDS.filter((c) => c.wins + c.losses > 150);
    // The filter earns its keep: the seasons it drops are exactly the three
    // shortened ones, and one of them holds a total below WORST_WINS.
    const dropped = [...new Set(CARDS.filter((c) => c.wins + c.losses <= 150).map((c) => c.year))];
    expect(dropped.sort()).toEqual([1994, 1995, 2020]);
    expect(Math.min(...CARDS.map((c) => c.wins))).toBeLessThan(WORST_WINS);

    const fewest = Math.min(...full.map((c) => c.wins));
    expect(fewest).toBe(41);
    expect(WORST_WINS).toBe(fewest - 1);
    const holders = full
      .filter((c) => c.wins === fewest)
      .map((c) => `${c.team} ${c.year} ${c.wins}-${c.losses}`);
    expect(holders).toEqual(["CHW 2024 41-121"]);
  });

  /** 109–113 is bare because baseball never put a champion there, which is the
   * claim badges.ts makes in its file comment. 99 is bare by CHOICE — three
   * champions sit on it (below) — so it is asserted separately and must not be
   * confused for the same kind of gap. */
  it("finds no champion at all between the Mets and the Yankees", () => {
    for (const wins of [109, 110, 111, 112, 113]) {
      const champs = CARDS.filter((c) => c.wins === wins && c.ws).map((c) => `${c.team} ${c.year}`);
      expect(champs, `${wins} wins`).toEqual([]);
    }
    // The one club in the band, and it lost the NLDS.
    const band = CARDS.filter((c) => c.wins >= 109 && c.wins <= 113).map(
      (c) => `${c.team} ${c.year}`,
    );
    expect(band).toEqual(["LAD 2022"]);
  });

  it("records that 99 wins is an unclaimed rung, not an empty one", () => {
    const champs = CARDS.filter((c) => c.wins === 99 && c.ws)
      .map((c) => `${c.team} ${c.year}`)
      .sort();
    expect(champs).toEqual(["ANA 2002", "CHW 2005", "OAK 1989"]);
    // No badge claims the total. If one is ever added, this is the shortlist.
    expect(MATCHED[99]).toBeUndefined();
  });
});

describe("the era badges still have their seasons", () => {
  it("leaves 1994 the only season the set has no champion for", () => {
    const years = [...new Set(CARDS.map((c) => c.year))].sort();
    const championless = years.filter((y) => !CARDS.some((c) => c.year === y && c.ws));
    expect(championless).toEqual([1994]);
  });

  it("carries no All-Star nod anywhere in 2020 — the game was never played", () => {
    const nods = CARDS.filter((c) => c.year === 2020).flatMap((c) =>
      c.players.filter((p) => p.awards.includes("AS")).map((p) => `${c.team} ${p.name}`),
    );
    expect(nods).toEqual([]);
    // Which is the whole reason 🏅 and 🦠 can never appear on the same club.
    expect(CARDS.some((c) => c.year === 2020)).toBe(true);
  });

  it("still holds both scandal seasons, each with a roster to draft from", () => {
    for (const year of [2017, 2018]) {
      const c = card("HOU", year);
      expect(c.players.length, `HOU ${year} roster`).toBeGreaterThan(0);
    }
  });

  /** 🏦 is keyed to an id AND a club, so it needs both halves to survive on
   * disk: the id has to still spell the same thing after a regen, and the
   * player has to still appear on a card for THAT franchise. Either half
   * going missing leaves a badge that can never fire — and nothing else in the
   * suite would notice, because every unit test forges its own roster. */
  it("can still deal Bonilla a Mets card and Ohtani a Dodgers one", () => {
    const seasons = (id: string, team: string) =>
      CARDS.filter((c) => c.team === team && c.players.some((p) => p.id === id)).map(
        (c) => c.year,
      );
    expect(seasons("bonilbo01", "NYM").length, "bonilbo01 on NYM").toBeGreaterThan(0);
    expect(seasons("ohtansh01", "LAD").length, "ohtansh01 on LAD").toBeGreaterThan(0);
    // And the clubs the badge deliberately does NOT name are still draftable
    // too — the trigger is a choice between real options, not the only card
    // either player has.
    expect(seasons("bonilbo01", "PIT").length, "bonilbo01 on PIT").toBeGreaterThan(0);
    expect(seasons("ohtansh01", "LAA").length, "ohtansh01 on LAA").toBeGreaterThan(0);
  });
});

/** 🧓 and 🍼 are the only badges keyed to a NUMBER the data supplies rather
 * than to a name, so the thing that can rot underneath them is the supply at
 * the tails. 35+ and 23− are not symmetric numbers by accident: they are the
 * two closest-matched outer deciles the data offers, and a regen that moved
 * either decile would silently make one end of the pair much harder than the
 * other while both badges kept rendering as one idea. */
describe("the age axis still has players at both ends", () => {
  const ages = CARDS.flatMap((c) => c.players.flatMap((p) => p.age ?? []));

  it("keeps the two ends within a couple of points of each other", () => {
    const pct = (n: number) => (100 * n) / ages.length;
    const old = pct(ages.filter((a) => a >= 35).length);
    const young = pct(ages.filter((a) => a <= 23).length);
    expect(old).toBeGreaterThan(7);
    expect(old).toBeLessThan(12);
    expect(young).toBeGreaterThan(5);
    expect(young).toBeLessThan(10);
    expect(Math.abs(old - young)).toBeLessThan(4);
  });

  it("can still deal three of either end off a single card", () => {
    // Not a proof the badges are reachable — a club is built across ~11 cards
    // — but a floor under it: if no card can supply three, nothing can.
    const cardsWith = (ok: (a: number) => boolean) =>
      CARDS.filter((c) => c.players.filter((p) => p.age != null && ok(p.age)).length >= 3);
    expect(cardsWith((a) => a >= 35).length).toBeGreaterThan(100);
    expect(cardsWith((a) => a <= 23).length).toBeGreaterThan(100);
  });
});

/** 🗺️ resolves each player's division from the index row for THEIR season, so
 * the badge is only era-correct while those rows carry lg/div. Lose them and
 * the engine silently counts no divisions at all — the badge stops firing
 * rather than lying, but it stops firing. */
describe("the division map is era-correct and complete", () => {
  it("carries a league and a division on every card the index deals", () => {
    const bare = INDEX.cards.filter((c) => !c.lg || !c.div).map((c) => `${c.team} ${c.year}`);
    expect(bare).toEqual([]);
  });

  it("still says the NL had no Central before 1994", () => {
    const at = (year: number) =>
      [...new Set(INDEX.cards.filter((c) => c.year === year).map((c) => `${c.lg}/${c.div}`))].sort();
    expect(at(1992)).toEqual(["AL/E", "AL/W", "NL/E", "NL/W"]);
    expect(at(1994)).toEqual(["AL/C", "AL/E", "AL/W", "NL/C", "NL/E", "NL/W"]);
  });

  /** The three realignments a modern map would get wrong, spelled out: a
   * static map would put 1992 Houston in a division that did not exist yet,
   * Milwaukee in the NL a decade early, and Houston in the AL two decades
   * early. */
  it("keeps Houston and Milwaukee in the leagues they actually played in", () => {
    const row = (team: string, year: number) =>
      INDEX.cards.find((c) => c.team === team && c.year === year);
    expect(row("HOU", 1992)).toMatchObject({ lg: "NL", div: "W" });
    expect(row("HOU", 1994)).toMatchObject({ lg: "NL", div: "C" });
    expect(row("HOU", 2013)).toMatchObject({ lg: "AL", div: "W" });
    expect(row("MIL", 1985)).toMatchObject({ lg: "AL", div: "E" });
    expect(row("MIL", 1998)).toMatchObject({ lg: "NL", div: "C" });
  });
});

/** 🕰️ claims forty years is the full width of the dataset — the badge means
 * "you hold both ends", not "a wide roster". That is only true while the cards
 * run 1985–2025 exactly. */
describe("forty years is still the whole dataset", () => {
  it("spans exactly forty years from the oldest card to the newest", () => {
    const years = CARDS.map((c) => c.year);
    expect(Math.min(...years)).toBe(1985);
    expect(Math.max(...years)).toBe(2025);
    expect(Math.max(...years) - Math.min(...years)).toBe(40);
  });
});

/** 💊 and 🎲 name living people off hard-coded Baseball-Reference ids. An id
 * that no longer appears on any card leaves a name silently unreachable — the
 * badge keeps rendering and simply never fires for that man — and an id that
 * resolves to the WRONG man is worse, because the badge fires and accuses
 * somebody who was never suspended. Both halves are pinned. */
describe("the curated people are still on the cards", () => {
  const seasonsOf = (id: string) =>
    CARDS.filter((c) => c.players.some((p) => p.id === id));

  it("can still deal every suspended player at least one card", () => {
    const missing = [...SUSPENDED].filter((id) => seasonsOf(id).length === 0);
    expect(missing).toEqual([]);
    expect(SUSPENDED.size).toBe(27);
  });

  /** The two collision traps the 💊 list was built around. Both are real,
   * draftable men who share a surname and a first initial with a suspended
   * player and were never suspended themselves — the same shape as the Pedro
   * Borbón Jr. trap on the 🚧 list. If a regen ever swapped the two ids, the
   * badge would quietly start accusing the wrong person. */
  it("keeps the two name collisions off the suspended list", () => {
    for (const [wrong, right, surname] of [
      ["braunry01", "braunry02", "Ryan Braun"],
      ["cruzne01", "cruzne02", "Nelson Cruz"],
    ]) {
      expect(SUSPENDED.has(wrong), `${wrong} must not be listed`).toBe(false);
      expect(SUSPENDED.has(right), `${right} must be listed`).toBe(true);
      // …and both are still real, distinct, draftable people, which is what
      // makes the trap a trap rather than a typo.
      expect(seasonsOf(wrong).length, `${wrong} on a card`).toBeGreaterThan(0);
      expect(seasonsOf(right).length, `${right} on a card`).toBeGreaterThan(0);
      const names = new Set(
        [wrong, right].flatMap((id) =>
          CARDS.flatMap((c) => c.players.filter((p) => p.id === id).map((p) => p.name)),
        ),
      );
      expect([...names]).toEqual([surname]);
    }
  });

  it("can still deal all four men under a betting cloud", () => {
    expect([...GAMBLERS].sort()).toEqual([
      "claseem01",
      "marcatu01",
      "ortizlu03",
      "rosepe01",
    ]);
    const where = (id: string) =>
      seasonsOf(id)
        .map((c) => `${c.team} ${c.year}`)
        .sort();
    expect(where("rosepe01")).toEqual(["CIN 1985", "CIN 1986"]);
    expect(where("marcatu01")).toEqual(["PIT 2022", "PIT 2023"]);
    // Clase and Ortiz are the reason the badge's copy names no verdict; the
    // pin is here so a regen dropping either one is visible.
    expect(where("claseem01").length).toBeGreaterThan(0);
    expect(where("ortizlu03").length).toBeGreaterThan(0);
  });

  /** The 🎲 trigger's manager half is a bare team-and-year window with Rose's
   * name only in a comment. Nothing in the app would notice if the CIN
   * 1985–89 cards stopped carrying him — the badge would keep firing for
   * whoever managed the Reds instead. */
  it("still seats Pete Rose in the Reds dugout for exactly five years", () => {
    const roseYears = CARDS.filter((c) => c.manager === "Pete Rose")
      .map((c) => `${c.team} ${c.year}`)
      .sort();
    expect(roseYears).toEqual([
      "CIN 1985",
      "CIN 1986",
      "CIN 1987",
      "CIN 1988",
      "CIN 1989",
    ]);
  });
});

/** Why there is no ALL-GOLD badge, recorded as an assertion rather than as a
 * paragraph nobody reads. The club has a mandatory RP seat and eligibility.ts
 * fills it only from `pos === "RP"`, so the best relief season in the set is a
 * hard ceiling on any "every player at N WAR" badge. It is 7.2 — under the 8.0
 * gold rung — which makes an all-gold roster impossible rather than rare.
 * 🧱's 4.0 floor is the highest rung the RP seat can actually clear, and 🌟
 * counts gold seats instead of demanding all of them. */
describe("the gold ceiling the shape badges are written around", () => {
  const MIN_POS_G = 10;
  const seats = CARDS.flatMap((c) => c.players);

  it("keeps the relief ceiling under the gold rung", () => {
    const rp = seats.filter((p) => p.pos === "RP");
    const best = Math.max(...rp.map((p) => p.war));
    expect(best).toBe(7.2);
    expect(best).toBeLessThan(8.0);
    expect(rp.filter((p) => p.war === best).map((p) => p.name)).toEqual([
      "Mark Eichhorn",
    ]);
  });

  /** Catcher is the second choke point, and the one that decides whether the
   * arithmetic ceiling is 6 gold seats or 7: exactly one catcher season in the
   * whole set reaches 8.0, so a club can only hold a seventh gold seat by
   * landing that one card. */
  it("finds exactly one gold catcher season in the whole set", () => {
    const gold = seats
      .filter((p) => (p.posG?.c ?? 0) >= MIN_POS_G && p.war >= 8.0)
      .map((p) => p.name);
    expect(gold).toEqual(["Mike Piazza"]);
  });
});

/** 👔 claims the ladder's floor — "an 0–162 season, every game lost" — and the
 * trigger reads BASELINE wins, which is 50 replacement wins plus roster WAR
 * plus the skipper's net. So the floor under a baseline is a data fact, and
 * this pins it: the worst season available at every seat, plus the worst
 * manager in the set, still leaves a club above zero. 👔 is the ladder's
 * stated floor rather than a rung anyone reaches, and that is on purpose —
 * but it should be true on purpose rather than by accident. */
describe("the floor a baseline can actually reach", () => {
  const MIN_POS_G = 10;
  const SLOTS = ["C", "IF", "IF", "OF", "FLEX", "SP", "SP", "RP"];
  const eligible = (p: CardPlayerRow): string[] => {
    const t: string[] = [];
    if ((p.posG?.c ?? 0) >= MIN_POS_G) t.push("C");
    if ((p.posG?.if ?? 0) >= MIN_POS_G) t.push("IF");
    if ((p.posG?.of ?? 0) >= MIN_POS_G) t.push("OF");
    if (p.pos.startsWith("SP")) t.push("SP");
    if (p.pos === "RP") t.push("RP");
    if (!(p.pos.startsWith("SP") || p.pos === "RP") || p.pos.includes("/"))
      t.push("FLEX");
    return t;
  };

  it("cannot build a club bad enough to lose all 162", () => {
    const worst = new Map<string, number>();
    for (const p of CARDS.flatMap((c) => c.players))
      for (const t of eligible(p))
        worst.set(t, Math.min(worst.get(t) ?? Infinity, p.war));
    // Reusing one man across the seats he is eligible for, which only makes
    // the bound looser — a real club has to find eight different people.
    const floorWar = SLOTS.reduce((sum, t) => sum + (worst.get(t) ?? 0), 0);
    const worstManagerWins =
      0.2 * Math.min(...CARDS.map((c) => c.wins - c.losses));
    const floorBaseline = 50 + floorWar + worstManagerWins;
    expect(floorBaseline).toBeGreaterThan(0);
    // Which also means 📉 WORST RECORD, at 40 wins or fewer, is the lowest
    // rung a real club can reach at all.
    expect(floorBaseline).toBeLessThan(WORST_WINS);
  });
});

/** 🏛️ is the one badge in the set whose subject is not closed: the Hall elects
 * people every January, so its difficulty drifts with each data regen and
 * nothing else in the suite could notice — the trigger is a count over a flag,
 * and it keeps working while quietly getting easier. These are the numbers the
 * HALL_COUNT threshold was chosen against; a regen that moves them should fail
 * loudly and have the rung re-decided, not slide.
 *
 * The era-lock is pinned too, because it looks like a bug and is not:
 * induction needs retirement plus a waiting period, so the recent end of the
 * dataset carries no Hall of Famers at all and never will. */
describe("the Hall of Fame supply", () => {
  const seats = CARDS.flatMap((c) => c.players);
  const hofSeats = seats.filter((p) => p.hof === true);

  it("still carries the Hall on the cards, players and skippers both", () => {
    expect(hofSeats.length).toBe(955);
    expect(new Set(hofSeats.map((p) => p.id)).size).toBe(70);
    expect(CARDS.filter((c) => c.managerHof === true).length).toBe(125);
    // Nine men, not fourteen: the flag is `category = "Manager"` strictly, so
    // Frank Robinson — in the Hall as a player, a manager for sixteen years —
    // is not a Hall of Fame manager here.
    expect(
      new Set(
        CARDS.filter((c) => c.managerHof === true).map((c) => c.manager),
      ).size,
    ).toBe(9);
  });

  /** The threshold's own supply floor: a club is built across roughly eleven
   * cards, and HALL_COUNT is four. If no card could supply more than two the
   * badge would need four separate landings to agree, which is a different
   * badge from the one the copy describes. */
  it("can still deal several Hall of Famers off a single card", () => {
    const per = CARDS.map((c) => c.players.filter((p) => p.hof === true).length);
    expect(Math.max(...per)).toBeGreaterThanOrEqual(4);
    expect(per.filter((n) => n > 0).length).toBe(558);
  });

  it("records that the recent end of the dataset can never carry the flag", () => {
    const modern = seats.filter(() => false);
    void modern;
    const recent = CARDS.filter((c) => c.year >= 2020).flatMap((c) => c.players);
    expect(recent.length).toBeGreaterThan(5000);
    expect(recent.filter((p) => p.hof === true)).toEqual([]);
    // …and that the decay toward it is monotone enough to be the reason,
    // rather than an accident of one bad decade.
    const rate = (from: number, to: number): number => {
      const rows = CARDS.filter((c) => c.year >= from && c.year <= to).flatMap(
        (c) => c.players,
      );
      return (100 * rows.filter((p) => p.hof === true).length) / rows.length;
    };
    expect(rate(1985, 1994)).toBeGreaterThan(rate(1995, 2004));
    expect(rate(1995, 2004)).toBeGreaterThan(rate(2005, 2014));
    expect(rate(2015, 2025)).toBeLessThan(0.5);
  });
});

/** 🌎 counts distinct birth countries, and the shape of that supply is what
 * makes it a COUNT badge rather than a set of per-country badges: the head is
 * one country and the tail is single men. If the distribution ever flattened,
 * COUNTRY_COUNT would be measuring something else. */
describe("the birth-country supply", () => {
  const seats = CARDS.flatMap((c) => c.players);
  const countries = seats.map((p) => p.bc);

  it("carries a country on every draftable player", () => {
    expect(countries.filter((c) => !c)).toEqual([]);
  });

  it("keeps one country dominant and the tail unfindable", () => {
    const counts = new Map<string, number>();
    for (const c of countries) counts.set(c!, (counts.get(c!) ?? 0) + 1);
    expect(counts.size).toBeGreaterThan(30);
    const usa = (100 * (counts.get("USA") ?? 0)) / countries.length;
    expect(usa).toBeGreaterThan(70);
    // Counted in PEOPLE rather than seasons, most of the map is one man deep:
    // 23 of the 39 countries have five draftable players or fewer and 15 have
    // exactly one — Scotland, Spain, Indonesia, Portugal and eleven others.
    // That is why nothing in this game asks a player to collect them all.
    const players = new Map<string, Set<string>>();
    for (const p of seats) {
      const set = players.get(p.bc!) ?? new Set<string>();
      set.add(p.id);
      players.set(p.bc!, set);
    }
    const tiny = [...players.values()].filter((s) => s.size <= 5).length;
    const singletons = [...players.values()].filter((s) => s.size === 1).length;
    expect(tiny).toBeGreaterThan(counts.size / 2);
    expect(singletons).toBeGreaterThan(10);
  });

  /** The historical spellings the pipeline normalizes. Lahman records a
   * country as of BIRTH, so the raw table carries both "West Germany" and
   * "Germany" and would let one club earn two countries off two Germans. */
  it("carries no un-normalized historical country names", () => {
    const names = new Set(countries);
    for (const stale of ["West Germany", "British Honduras", "South Vietnam"]) {
      expect(names.has(stale), `${stale} should be normalized away`).toBe(false);
    }
  });
});

/** 2️⃣ and 🎆 are the two newest badges keyed to hard-coded Baseball-Reference
 * ids, and they fail the same silent way 🏦 does: an id that no longer appears
 * on a card leaves a badge that renders forever and can never fire. 🎆 keys the
 * SEASON as well, so both halves have to survive a regen — and its tier was
 * argued from a card count, which is a number that can move under it.
 *
 * The collision trap is real rather than hypothetical: `renteri01` is Rick
 * Renteria, FLA 1993, a draftable man one character away from the Édgar
 * Rentería the badge names — the same shape as the Pedro Borbón Jr. trap on
 * 🚧 and the two on 💊. */
describe("the walk-off seasons and the captain are still dealable", () => {
  const seasonsOf = (id: string) =>
    CARDS.filter((c) => c.players.some((p) => p.id === id));

  it("still deals the captain the eighteen cards his tier was read off", () => {
    const where = seasonsOf(CAPTAIN).map((c) => `${c.team} ${c.year}`);
    expect(where.length).toBe(18);
    // One club, every season — which is why the trigger keys the man alone
    // and has no club half to check.
    expect(new Set(seasonsOf(CAPTAIN).map((c) => c.team))).toEqual(
      new Set(["NYY"]),
    );
    // The exposure half of the `uncommon` argument: on eight of the eighteen
    // he is one of the card's five best seasons by WAR, which is the proxy 💊's
    // note uses for "a draft that reads numbers takes him".
    const top5 = seasonsOf(CAPTAIN).filter((c) =>
      [...c.players]
        .sort((a, b) => b.war - a.war)
        .slice(0, 5)
        .some((p) => p.id === CAPTAIN),
    );
    expect(top5.length).toBe(8);
  });

  it("still holds all three World Series-ending seasons", () => {
    const pairs = Object.entries(WALK_OFF_SEASONS).flatMap(([id, years]) =>
      years.map((year) => [id, year] as const),
    );
    expect(pairs).toHaveLength(3);
    const found = pairs.map(([id, year]) => {
      const hits = CARDS.filter(
        (c) => c.year === year && c.players.some((p) => p.id === id),
      );
      // One card each: the season is unique to the club that won with it,
      // which is what lets the table key on id and year alone.
      expect(hits.length, `${id} ${year}`).toBe(1);
      return `${hits[0].team} ${year}`;
    });
    expect(found.sort()).toEqual(["ARI 2001", "FLA 1997", "TOR 1993"]);
  });

  it("keeps every walk-off season a championship season", () => {
    // The badge claims a hit that ENDED a World Series. If a card ever stopped
    // carrying the ring, the label would be making a claim the data denies.
    for (const [id, years] of Object.entries(WALK_OFF_SEASONS)) {
      for (const year of years) {
        const c = CARDS.find(
          (c) => c.year === year && c.players.some((p) => p.id === id),
        )!;
        expect(c.ws, `${c.team} ${year}`).toBe(true);
        expect(
          c.players.find((p) => p.id === id)!.ws,
          `${id} ${year} ring`,
        ).toBe(true);
      }
    }
  });

  it("keeps Rick Renteria off the walk-off table", () => {
    expect(WALK_OFF_SEASONS["renteri01"]).toBeUndefined();
    expect(WALK_OFF_SEASONS["renteed01"]).toEqual([1997]);
    // …and both are still real, distinct, draftable men, which is what makes
    // the trap a trap rather than a typo.
    expect(seasonsOf("renteri01").length).toBeGreaterThan(0);
    expect(seasonsOf("renteed01").length).toBeGreaterThan(0);
    const names = new Set(
      ["renteri01", "renteed01"].map(
        (id) =>
          CARDS.flatMap((c) => c.players).find((p) => p.id === id)!.name,
      ),
    );
    expect(names.size).toBe(2);
  });

  it("keeps the two supply counts the tiers were argued from", () => {
    // 🎆 rides three cards, the same supply as 💥 THE CHASE — and is a tier
    // above it because only one of the three seasons is a WAR a draft would
    // take on its own. If a regen moves either number, the tiers need
    // re-deciding rather than sliding.
    const walkCards = Object.entries(WALK_OFF_SEASONS).flatMap(([id, years]) =>
      CARDS.filter(
        (c) => years.includes(c.year) && c.players.some((p) => p.id === id),
      ),
    );
    expect(walkCards).toHaveLength(3);
    const wars = Object.entries(WALK_OFF_SEASONS)
      .flatMap(([id, years]) =>
        CARDS.filter(
          (c) => years.includes(c.year) && c.players.some((p) => p.id === id),
        ).map((c) => c.players.find((p) => p.id === id)!.war),
      )
      .sort((a, b) => a - b);
    expect(wars).toEqual([0.9, 2.0, 7.9]);
  });
});

describe("the two-way guy is still findable", () => {
  it("has exactly five slashed-position seasons in the set", () => {
    const twoWay = CARDS.flatMap((c) =>
      c.players.filter((p) => p.pos.includes("/")).map((p) => `${p.name} ${c.year} ${c.team}`),
    );
    expect(twoWay).toHaveLength(5);
    // 🃏 is a badge about one player; if that ever stops being true the card's
    // own copy needs rewriting, not just its frequency.
    expect(new Set(twoWay.map((s) => s.split(" ").slice(0, 2).join(" "))).size).toBe(1);
  });
});

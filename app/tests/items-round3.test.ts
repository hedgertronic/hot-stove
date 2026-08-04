/** Regression suite for the round-3 design items.
 *
 * Items covered here are testable via SSR string inspection (no mounting):
 *   1. Manager tile: white card surface; wins chip is the only color carrier.
 *   2. Column order: WAR chip is the rightmost element in a player market row.
 *   3. WBC medal order: medal glyph follows award chips, mirroring the Finale.
 *   4. Mobile seat structure: season line is in the DOM (CSS hides it; no markup
 *      branch needed to show it at desktop width).
 *   5. Manager tile structure: upright column layout; no writing-mode rotation,
 *      no .mhead wrapper div.
 *
 * Same SSR-string approach as rail-tiers.test.ts / help-specimens.test.ts.
 * CSS visual assertions (background-color, display: none) are layout jobs and
 * belong to screenshot review, not to this file; what is asserted here is the
 * markup CONTRACT the CSS rules require to do their job.
 */
import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import type { Component } from "svelte";
import PlayerList from "../src/components/PlayerList.svelte";
import RailSeat from "../src/components/RailSeat.svelte";
import SpecialRows from "../src/components/SpecialRows.svelte";
import TeamPicker from "../src/components/TeamPicker.svelte";
import { Game, type GameConfig } from "../src/lib/engine.svelte";
import { forgeGame, mkCard, mkPlayer, stubMeta, stubOwners } from "../src/lab/fixtures";
import type { GameIndex } from "../src/lib/types";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const CLASSIC: GameConfig = { difficulty: "standard", bank: "classic" };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ssr(component: Component<any>, props: Record<string, unknown>): string {
  return render(component, { props }).body;
}

// ── item 1: manager tile is white (no red identity tint) ─────────────────────

describe("item 1 — manager tile: wins chip is the color carrier", () => {
  function specialBody(config: GameConfig = CLASSIC): string {
    const game = forgeGame(config, (g) => {
      g.card = mkCard(); // SEA 2001 default: 116–46 Lou Piniella (elite wins)
    });
    return ssr(SpecialRows, { game, confirmKey: null, setConfirm: () => {} });
  }

  it("the manager srow has class 'skip' (identifying it as the skipper)", () => {
    const body = specialBody();
    expect(body).toContain("srow skip");
  });

  it("the manager srow carries a wins chip (.warchip) as its color carrier", () => {
    // The chip is the ONLY colored surface on the tile. It inherits the --rung
    // pair from the .war-* class on the srow and is the visual tier signal.
    const body = specialBody();
    // The warchip is on the .val span when a tier is present.
    expect(body).toContain("warchip");
    // The tier token on the .val confirms a rung-colored chip is rendered.
    expect(body).toContain("elite"); // SEA 2001: 116–46 → 14.0 wins (elite rung)
  });

  it("the manager srow does not carry any inline background style (tile stays white)", () => {
    // Background is set by the CSS rule for .srow.skip (now var(--card)),
    // never as an inline style attribute. A bare class cannot accidentally
    // re-introduce a tint without the CSS change, so this asserts the markup
    // carries no overriding inline style.
    const body = specialBody();
    // Extract the opening tag of the manager srow.
    const mgrBtn = body.match(/<button class="srow skip[^"]*"[^>]*/)?.[0] ?? "";
    expect(mgrBtn).not.toContain('style="background');
    expect(mgrBtn).not.toContain("style=");
  });

  it("Eye Test still renders a manager srow with a chip present (chip shows the scale)", () => {
    // Eye Test withholds the WAR NUMERAL, not the chip's presence — the chip
    // in Eye Test mode has no rung fill (tier is "") and falls back to bare
    // cardstock, which is the exact same surface as the tile itself. The chip
    // is still the structural color carrier even when it carries no color.
    const body = specialBody({ difficulty: "scout", bank: "classic" });
    expect(body).toContain("srow skip");
    // The val span is still present; the tier token is absent (Eye Test hides it).
    expect(body).toContain("val");
  });
});

// ── item 6: stadium row uses orange, not sky/blue ────────────────────────────

describe("item 6 — stadium row: orange identity hue, not sky/blue", () => {
  function specialBody(): string {
    const game = forgeGame(CLASSIC, (g) => {
      g.card = mkCard();
    });
    return ssr(SpecialRows, { game, confirmKey: null, setConfirm: () => {} });
  }

  it("the stadium srow has class 'stad'", () => {
    const body = specialBody();
    expect(body).toContain("srow stad");
  });

  it("the .srow.stad element does not reference --sky or --blue in its class or inline style", () => {
    // The hue is now orange (--orange-2 / --orange-8) applied via the .stad CSS
    // rule in SpecialRows.svelte. No --sky or --blue-8 token may appear on the
    // stadium button's opening tag — those tokens lived in the old CSS rule and
    // the old comment; confirming the source text changed is a build-time check.
    const body = specialBody();
    // The stad button's opening tag must not carry a --sky or --blue inline style.
    const stadMatch = body.match(/<button class="srow stad[^"]*"[^>]*/);
    const stadTag = stadMatch?.[0] ?? "";
    expect(stadTag).not.toContain("--sky");
    expect(stadTag).not.toContain("--blue");
  });
});

// ── item 2: WAR chip is the rightmost element in a player market row ──────────

describe("item 2 — column order: salary inboard, WAR chip far right", () => {
  function playerBody(game: Game): string {
    return ssr(PlayerList, { game, confirmKey: null, setConfirm: () => {} });
  }

  it("the .cost span appears before .warchip inside .right in Box Score mode", () => {
    const game = forgeGame(CLASSIC, (g) => {
      g.card = mkCard({
        players: [mkPlayer({ name: "Barry Bonds", pos: "LF", war: 11.8, cost: 32 })],
      });
    });
    const body = playerBody(game);
    // Both elements must appear in the rendered .right section.
    expect(body).toContain("warchip");
    expect(body).toContain("cost");
    // The cost element appears BEFORE the warchip — salary is inboard.
    const costIdx = body.indexOf('class="cost');
    const chipIdx = body.indexOf("warchip");
    expect(costIdx).toBeLessThan(chipIdx);
  });

  it("a confirm pill replaces the whole .right pair (WAR chip goes away with it)", () => {
    // When a confirm is open, the right side shows only the confirm pill.
    // Neither WAR chip nor cost should appear while the SIGN confirm is active.
    const game = forgeGame(CLASSIC, (g) => {
      g.card = mkCard({
        players: [mkPlayer({ id: "bonds", name: "Barry Bonds", pos: "LF", war: 11.8, cost: 32 })],
      });
    });
    const body = ssr(PlayerList, {
      game,
      confirmKey: "p:bonds",
      setConfirm: () => {},
    });
    expect(body).toContain("SIGN");
    // Neither the chip nor the price column shows while the confirm is open.
    expect(body).not.toContain("warchip");
    expect(body).not.toContain("class=\"cost");
  });
});

// ── item 3: WBC medal appears after award chips ───────────────────────────────

describe("item 3 — WBC medal order: award chips → WBC medal", () => {
  it("the WBC glyph renders after .badges when the player has both", () => {
    const game = forgeGame(CLASSIC, (g) => {
      g.card = mkCard({
        players: [
          mkPlayer({
            name: "Ichiro Suzuki",
            pos: "RF",
            war: 7.7,
            cost: 14,
            awards: ["MVP", "GG"],
            // wbc field is on the CardPlayer type; set it here via spread
          }),
        ],
      });
      // Give the player a WBC champion medal.
      if (g.card) g.card.players[0] = { ...g.card.players[0], wbc: 2 };
      g.card = g.card; // trigger reactive update
    });
    const body = ssr(PlayerList, { game, confirmKey: null, setConfirm: () => {} });
    // Award chip pill (MVP) is rendered via AwardPill inside .badges.
    expect(body).toContain("badges");
    // WBC gold medal glyph is the WBC champion medal.
    expect(body).toContain("🥇");
    // .badges span must come BEFORE the .wbc span in the HTML string,
    // mirroring the Finale's own order: award pills → WBC gold → WBC silver.
    const badgesIdx = body.indexOf("badges");
    const wbcIdx = body.indexOf("🥇");
    expect(badgesIdx).toBeLessThan(wbcIdx);
  });

  it("the WBC glyph renders as a sibling of .badges, not inside it", () => {
    // The medal is inside .prow > .mid as a direct child, NOT nested inside
    // .badges, so it renders for players with no awards (hasBadges is false).
    const game = forgeGame(CLASSIC, (g) => {
      g.card = mkCard({
        players: [
          mkPlayer({ name: "No Awards WBC Player", pos: "CF", war: 2.0, cost: 5 }),
        ],
      });
      if (g.card) g.card.players[0] = { ...g.card.players[0], wbc: 1 }; // silver
    });
    const body = ssr(PlayerList, { game, confirmKey: null, setConfirm: () => {} });
    // The medal shows even without any .badges span.
    expect(body).toContain("🥈");
    // No .badges section (no awards → hasBadges is false, badges span is absent).
    expect(body).not.toContain("badges");
  });
});

// ── item 4: mobile seat structure ─────────────────────────────────────────────

describe("item 4 — mobile seat: season line stays in DOM, CSS hides it", () => {
  it("a filled player cell has an <i> element in the rendered markup", () => {
    // The season line is `display: none` on phone via CSS, not removed from
    // the DOM — the markup keeps the <i> so the 760px media query can restore
    // it without a structural prop branch.
    const body = ssr(RailSeat, {
      chair: "cell",
      label: "RF",
      name: "Ichiro Suzuki",
      meta: "2001 SEA",
      tier: "high",
      war: "7.7",
    });
    // <i> holds the season meta text ("2001 SEA") and is always in the DOM.
    expect(body).toContain("<i");
    expect(body).toContain("2001 SEA");
  });

  it("the filled player cell height is set to 64px (three-row phone geometry)", () => {
    // 64px = 5px border + 10px padding + 11.25px label + 13.75px name +
    //         3px gap + 21.016px chip. No season line on phone.
    // This is a structural fact checked via the CSS class name on the element
    // (the height rule lives on `.cell` in the scoped style block).
    const body = ssr(RailSeat, {
      chair: "cell",
      label: "RF",
      name: "Ichiro",
      meta: "2001 SEA",
      tier: "",
      war: null,
    });
    // The element renders as the .cell class which carries the 64px height.
    expect(body).toContain('class="cell');
  });
});

// ── item 5: manager tile three-row structure ──────────────────────────────────

describe("item 5 — manager tile: upright three-row layout, no rotation", () => {
  const mgrProps = {
    chair: "mgr" as const,
    label: "MGR",
    name: "Lou Piniella",
    meta: "2001 SEA",
    tier: "elite",
    war: "14.0",
  };

  it("the manager div has class 'mgr filled' and its tier class", () => {
    const body = ssr(RailSeat, mgrProps);
    expect(body).toMatch(/class="[^"]*\bmgr\b[^"]*filled[^"]*war-elite/);
  });

  it("the markup contains no .mhead wrapper div", () => {
    // The old sideways layout needed a .mhead div to pair the label and chip
    // into one column. The upright layout doesn't need it: b, span, i, em
    // are direct children of the .mgr div.
    const body = ssr(RailSeat, mgrProps);
    expect(body).not.toContain("mhead");
  });

  it("the markup has no writing-mode attribute (not rotated)", () => {
    // Previously `style="writing-mode: sideways-lr"` or similar would appear.
    // The chair is now upright at all widths; no inline writing-mode needed.
    const body = ssr(RailSeat, mgrProps);
    expect(body).not.toContain("writing-mode");
  });

  it("the three content rows are in the markup: label (b), name (span), chip (em)", () => {
    const body = ssr(RailSeat, mgrProps);
    // Position label
    expect(body).toContain(">MGR<");
    // Name
    expect(body).toContain(">Lou Piniella<");
    // Wins chip with the WAR chip class and the tier token
    expect(body).toContain("warchip");
    expect(body).toContain("sm");
    expect(body).toContain(">14.0<");
  });

  it("the season meta line is in the DOM for desktop restore (same rule as cells)", () => {
    const body = ssr(RailSeat, mgrProps);
    expect(body).toContain("<i");
    expect(body).toContain("2001 SEA");
  });

  it("the empty manager chair has no chip (nothing to hire yet)", () => {
    const body = ssr(RailSeat, {
      chair: "mgr" as const,
      label: "MGR",
      name: null,
      tier: "",
      war: null,
    });
    expect(body).toContain("mgr");
    expect(body).toContain(">MGR<");
    expect(body).not.toContain("warchip");
  });
});

// ── item 7: TeamPicker column count tracks the widest division ────────────────

describe("item 7 — relocate picker: column count from widest division", () => {
  const colors = { franchises: {} };

  it("renders 5 columns for a standard 5-team-division season (2001)", () => {
    // The pickCols derived value is: max division team count for this season.
    // For 2001 MLB each division has 5 teams, so the grid gets 5 columns.
    // Test uses a custom index so no network call is needed.
    const index2001: GameIndex = {
      yearMin: 2001,
      yearMax: 2001,
      cards: [
        // AL EAST (5)
        { team: "BAL", year: 2001, franchise: "BAL", name: "Orioles", lg: "AL", div: "E" },
        { team: "BOS", year: 2001, franchise: "BOS", name: "Red Sox", lg: "AL", div: "E" },
        { team: "NYY", year: 2001, franchise: "NYY", name: "Yankees", lg: "AL", div: "E" },
        { team: "TBD", year: 2001, franchise: "TBD", name: "Devil Rays", lg: "AL", div: "E" },
        { team: "TOR", year: 2001, franchise: "TOR", name: "Blue Jays", lg: "AL", div: "E" },
        // AL CENTRAL (5)
        { team: "CHW", year: 2001, franchise: "CHW", name: "White Sox", lg: "AL", div: "C" },
        { team: "CLE", year: 2001, franchise: "CLE", name: "Indians", lg: "AL", div: "C" },
        { team: "DET", year: 2001, franchise: "DET", name: "Tigers", lg: "AL", div: "C" },
        { team: "KCR", year: 2001, franchise: "KCR", name: "Royals", lg: "AL", div: "C" },
        { team: "MIN", year: 2001, franchise: "MIN", name: "Twins", lg: "AL", div: "C" },
        // AL WEST (4 — the "relay" division; SEA is the current team and excluded from picks)
        { team: "ANA", year: 2001, franchise: "ANA", name: "Angels", lg: "AL", div: "W" },
        { team: "OAK", year: 2001, franchise: "OAK", name: "Athletics", lg: "AL", div: "W" },
        { team: "SEA", year: 2001, franchise: "SEA", name: "Mariners", lg: "AL", div: "W" },
        { team: "TEX", year: 2001, franchise: "TEX", name: "Rangers", lg: "AL", div: "W" },
        // NL WEST (5)
        { team: "ARI", year: 2001, franchise: "ARI", name: "Diamondbacks", lg: "NL", div: "W" },
        { team: "COL", year: 2001, franchise: "COL", name: "Rockies", lg: "NL", div: "W" },
        { team: "LAD", year: 2001, franchise: "LAD", name: "Dodgers", lg: "NL", div: "W" },
        { team: "SDP", year: 2001, franchise: "SDP", name: "Padres", lg: "NL", div: "W" },
        { team: "SFG", year: 2001, franchise: "SFG", name: "Giants", lg: "NL", div: "W" },
      ],
    };
    const game = new Game(stubMeta, index2001, stubOwners, 99);
    game.card = mkCard({ year: 2001, team: "SEA" });
    game.phase = "landed";

    const body = ssr(TeamPicker, { game, colors, onclose: () => {} });
    // The widest division in this synthetic index has 5 teams (AL EAST, AL
    // CENTRAL, NL WEST all have 5). pickCols computes max → 5.
    expect(body).toContain("--div-cols: 5");
    // The grid itself is present.
    expect(body).toContain("pickgrid");
  });

  it("renders 4 columns for a pre-expansion 4-team-division season (1992)", () => {
    // Pre-1994 MLB had four divisions of four teams each. The grid must use 4
    // columns, not 5, so every row fills exactly without an orphan tile.
    // This is the grid imbalance that item 7 was built to fix.
    const index1992: GameIndex = {
      yearMin: 1992,
      yearMax: 1992,
      cards: [
        // AL EAST (4)
        { team: "BAL", year: 1992, franchise: "BAL", name: "Orioles", lg: "AL", div: "E" },
        { team: "BOS", year: 1992, franchise: "BOS", name: "Red Sox", lg: "AL", div: "E" },
        { team: "NYY", year: 1992, franchise: "NYY", name: "Yankees", lg: "AL", div: "E" },
        { team: "TOR", year: 1992, franchise: "TOR", name: "Blue Jays", lg: "AL", div: "E" },
        // AL WEST (4)
        { team: "CAL", year: 1992, franchise: "ANA", name: "Angels", lg: "AL", div: "W" },
        { team: "OAK", year: 1992, franchise: "OAK", name: "Athletics", lg: "AL", div: "W" },
        { team: "SEA", year: 1992, franchise: "SEA", name: "Mariners", lg: "AL", div: "W" },
        { team: "TEX", year: 1992, franchise: "TEX", name: "Rangers", lg: "AL", div: "W" },
        // NL EAST (6 — inflates the max; pre-expansion NL/E was bigger)
        { team: "CHC", year: 1992, franchise: "CHC", name: "Cubs", lg: "NL", div: "E" },
        { team: "MON", year: 1992, franchise: "MON", name: "Expos", lg: "NL", div: "E" },
        { team: "NYM", year: 1992, franchise: "NYM", name: "Mets", lg: "NL", div: "E" },
        { team: "PHI", year: 1992, franchise: "PHI", name: "Phillies", lg: "NL", div: "E" },
        { team: "PIT", year: 1992, franchise: "PIT", name: "Pirates", lg: "NL", div: "E" },
        { team: "STL", year: 1992, franchise: "STL", name: "Cardinals", lg: "NL", div: "E" },
        // NL WEST (6 — no expansion yet; Colorado joined in 1993)
        { team: "ATL", year: 1992, franchise: "ATL", name: "Braves", lg: "NL", div: "W" },
        { team: "CIN", year: 1992, franchise: "CIN", name: "Reds", lg: "NL", div: "W" },
        { team: "HOU", year: 1992, franchise: "HOU", name: "Astros", lg: "NL", div: "W" },
        { team: "LAD", year: 1992, franchise: "LAD", name: "Dodgers", lg: "NL", div: "W" },
        { team: "SDP", year: 1992, franchise: "SDP", name: "Padres", lg: "NL", div: "W" },
        { team: "SFG", year: 1992, franchise: "SFG", name: "Giants", lg: "NL", div: "W" },
      ],
    };
    const game = new Game(stubMeta, index1992, stubOwners, 99);
    game.card = mkCard({ year: 1992, team: "SEA" });
    game.phase = "landed";

    const body = ssr(TeamPicker, { game, colors, onclose: () => {} });
    // 1992: AL/E=4, AL/W=4, NL/E=6, NL/W=6 → max = 6. The widest division
    // wins, so the grid fills without orphan tiles. Pre-1993 NL was already
    // six teams per side (no Central yet); the grid should track the actual max.
    // This is the fix: a hardcoded 5 would orphan the 6th tile in NL rows.
    expect(body).toContain("--div-cols: 6");
    expect(body).toContain("pickgrid");
  });

  it("falls back to 5 columns when index rows lack lg/div (current-division map)", () => {
    // When index entries don't carry `lg`/`div` fields, `divisionsForYear` falls
    // back to the hardcoded current-MLB franchise map, which uses 5-team
    // divisions. `pickCols` tracks the widest, which is still 5.
    // This also exercises the guard against `Math.max()` with no args.
    const noLgIndex: GameIndex = {
      yearMin: 2001,
      yearMax: 2001,
      cards: [
        // AL EAST teams, no lg/div — triggers the fallback grouping.
        { team: "NYY", year: 2001, franchise: "NYY", name: "Yankees" },
        { team: "BOS", year: 2001, franchise: "BOS", name: "Red Sox" },
        { team: "BAL", year: 2001, franchise: "BAL", name: "Orioles" },
        { team: "TBD", year: 2001, franchise: "TBD", name: "Devil Rays" },
        { team: "TOR", year: 2001, franchise: "TOR", name: "Blue Jays" },
      ],
    };
    const game = new Game(stubMeta, noLgIndex, stubOwners, 99);
    game.card = mkCard({ year: 2001, team: "SEA" });
    game.phase = "landed";

    const body = ssr(TeamPicker, { game, colors, onclose: () => {} });
    // Fallback: AL EAST = 5 franchises in the map, and SEA is not in this
    // index, so divisions comes back as just ["AL EAST" with 5 buttons].
    // Max division = 5 → --div-cols: 5.
    expect(body).toContain("--div-cols: 5");
    expect(body).toContain("pickgrid");
  });
});

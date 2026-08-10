import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/* Round 31's visual contracts, pinned at the source — same register as
 * round30-polish: jsdom computes no layout, so each pin states the invariant
 * the CSS carries. */

const read = (f: string) =>
  fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../src/${f}`),
    "utf8",
  );

describe("the HUD ✕ presses like its corner twins", () => {
  const app = read("App.svelte");

  it("carries the transition, and dips only on the tap that acts", () => {
    const quit = app.match(/\n  \.quit \{[^}]*\}/)?.[0] ?? "";
    expect(quit).toContain("transition: transform 0.08s");
    // The dip belongs to the armed confirm (and the finale's confirm-less
    // ✕ via .instant) — a bare `.quit:active` would dip the arming tap too.
    expect(app).toContain(
      ".quit.armed:active,\n  .quit.instant:active {\n    transform: translate(-1px, -1px);",
    );
    expect(app).not.toMatch(/\n  \.quit:active \{/);
  });

  it("the undo pill never dips — on either tap", () => {
    // Round 34 revision of the round-31 split: the confirming tap's dip
    // composited with UNDO?'s width collapse (62 → 28) and glyph swap and
    // read as a glitch (owner report, 2026-08-09). QUIT? keeps its dip above
    // because it does not animate width; the undo pill holds still for both
    // taps.
    const corner = read("components/CornerButtons.svelte");
    expect(corner).toContain(".undo:active {\n    transform: none;");
    expect(corner).not.toContain(".undo:not(.armed):active");
  });

  it("the finale ✕ knows it has no confirm step", () => {
    expect(app).toContain('class:instant={game.phase === "finale"}');
  });
});

describe("the seed capsule offers GO alone", () => {
  const home = read("components/Home.svelte");

  it("has no ✕ button and no seedx styles", () => {
    expect(home).not.toContain("seedx");
  });

  it("opens at 180px — the width the ✕ gave back", () => {
    expect(home).toContain(".seedzone.open {\n    width: 180px;\n  }");
  });
});

describe("each fixed-cap bank wears its club, home and in-game alike", () => {
  const home = read("components/Home.svelte");
  const box = read("components/PayrollBox.svelte");

  it("Moneyball: Oakland green on the punched row and the payroll pill", () => {
    const row = home.match(/\.row\.on\.mb \{[^}]*\}/)?.[0] ?? "";
    expect(row).toContain("var(--green-wash)");
    expect(row).toContain("var(--green-8)");
    const chip = box.match(/\.chip\.eff\.mb \{[^}]*\}/)?.[0] ?? "";
    expect(chip).toContain("var(--green-wash)");
    expect(chip).toContain("var(--green-8)");
  });

  it("Blank Check: pinstripe navy, not the evicted bright gold", () => {
    const row = home.match(/\.row\.on\.bc \{[^}]*\}/)?.[0] ?? "";
    expect(row).toContain("var(--blue-2)");
    expect(row).toContain("var(--blue-8)");
    expect(row).not.toContain("--yellow");
    const chip = box.match(/\.chip\.eff\.bc \{[^}]*\}/)?.[0] ?? "";
    expect(chip).toContain("var(--blue-2)");
    expect(chip).toContain("var(--blue-8)");
  });

  it("the pills carry the mode classes in the markup", () => {
    // `chipbox` joined the class list when the chips adopted the shared
    // recipe (round 13: one box model for payroll, powerup and award chips).
    expect(box).toContain('class="chip chipbox eff mb"');
    expect(box).toContain('class="chip chipbox eff bc"');
  });
});

describe("tapping a pending picker row cancels it", () => {
  const list = read("components/PlayerList.svelte");
  const engine = read("lib/engine.svelte.ts");

  it("the engine offers one cancel for both pickers", () => {
    const cancel = engine.match(/cancelPick\(\): void \{[^}]*\}/)?.[0] ?? "";
    expect(cancel).toContain("this.slotPick = null");
    expect(cancel).toContain("this.releasePick = null");
    expect(cancel).toContain("this.save()");
  });

  it("the row tap routes a pending row to the cancel before ⭐/🔁 can claim it", () => {
    const tap = list.match(/function tap\(p: CardPlayer[\s\S]*?\n  \}/)?.[0] ?? "";
    const cancelAt = tap.indexOf("game.cancelPick()");
    const primeAt = tap.indexOf("game.primeBrowsable(p)");
    expect(cancelAt).toBeGreaterThan(-1);
    expect(cancelAt).toBeLessThan(primeAt);
  });
});

describe("the picker hint points at where the rail actually is", () => {
  // The hint lives in MarketRow now — ONE markup block serves both pickers
  // (the label is the only variable), which is why the counts are 1 where
  // they were 2 in PlayerList's day. The intent is unchanged: both arrows
  // exist and the wide tier swaps them (unless `.above` pins ↑ for surfaces
  // whose rail never moves — the help sheet).
  const row = read("components/MarketRow.svelte");

  it("carries both arrows and swaps them at the wide tier", () => {
    expect(row.match(/class="ph" aria-hidden="true">↑</g)?.length).toBe(1);
    expect(row.match(/class="wd" aria-hidden="true">←</g)?.length).toBe(1);
    expect(row).toContain(".hint .wd {\n    display: none;");
    // block, not inline: a transform on an inline box is a silent no-op, so
    // the wide-tier ← must be a block to take the seat correction — and the
    // hide rule above must FOLLOW the shared display:block pair in source
    // order, or the ← ships doubled beside the ↑ on phones (it did once).
    expect(row).toContain(".hint:not(.above) .wd {\n      display: block;");
    const blockPairAt = row.indexOf("margin-inline-end: 4px;\n    display: block;");
    const hideAt = row.indexOf(".hint .wd {\n    display: none;");
    expect(blockPairAt).toBeGreaterThan(-1);
    expect(hideAt).toBeGreaterThan(blockPairAt);
  });
});

describe("orange is the armed voice, and only the armed voice", () => {
  it("browsable targets wear the armed orange pair — fill AND dash", () => {
    for (const [f, sel] of [
      ["components/PlayerList.svelte", ".prow.swap"],
      ["components/SpecialRows.svelte", ".srow.swap"],
      ["components/RailSeat.svelte", ".cell.pickable"],
    ] as const) {
      const src = read(f);
      const at = src.indexOf(sel);
      expect(at, `${f} ${sel}`).toBeGreaterThan(-1);
      const block = src.slice(at, src.indexOf("}", at));
      expect(block, `${f} ${sel} fill`).toContain("var(--orange-2)");
      expect(block, `${f} ${sel} dash`).toContain("var(--orange-8)");
      expect(block, `${f} ${sel} fill`).not.toContain("var(--amber)");
      expect(block, `${f} ${sel} dash`).not.toContain("dashed var(--ink)");
    }
  });

  it("the stadium's pink fill sits a step lighter than the ladder's red-2", () => {
    // OC pink-1, off-scale on purpose: at pink-2 the tile read as a giant
    // red-2 WAR chip.
    const css = read("app.css");
    expect(css).toContain("--pink-2: #ffdeeb;");
    // OC pink-6, off-scale like the fill: pink-8 carried a red-8's darkness
    // and sat heavy against its own pale wash.
    expect(css).toContain("--pink-8: #e64980;");
  });

  it("the seed row seats GO concentric with the capsule", () => {
    expect(read("components/Home.svelte")).toContain("padding: 0 3px 0 12px;");
  });

  it("--amber survives only on the trophy-register surfaces", () => {
    // The award chip and the record-book shelf are warm-stock, not armed —
    // they keep amber; nothing dashed does.
    expect(read("components/AwardPill.svelte")).toContain("var(--amber)");
    expect(read("components/SeasonsModal.svelte")).toContain("var(--amber)");
  });
});

describe("the armed words match the powerup pills' register", () => {
  it("QUIT? and UNDO? drop to 10.5px/0.04em when armed", () => {
    const quit = read("App.svelte").match(/\.quit\.armed \{[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(quit).toContain("font-size: 10.5px");
    expect(quit).toContain("letter-spacing: 0.04em");
    const undo = read("components/CornerButtons.svelte").match(/\.undo\.armed \{[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(undo).toContain("font-size: 10.5px");
    expect(undo).toContain("letter-spacing: 0.04em");
  });
});

describe("the intersection rule", () => {
  it("lives in one engine predicate consulted by every market gate", () => {
    const engine = read("lib/engine.svelte.ts");
    expect(engine).toContain("private marketBlocks(p: CardPlayer): boolean {");
    // All three gates consult it — signing, browsing, and the row gate.
    expect(engine.match(/this\.marketBlocks\(p\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("reaches the front office: an armed 🔁 grays untaken tiles", () => {
    const rows = read("components/SpecialRows.svelte");
    expect(rows).toContain("if (!taken && tdArmed) return;");
    expect(rows).toContain("tdBlocked = tdArmed && canAct && !swappable");
  });
});

describe("the relocate grid balances large divisions across two rows", () => {
  const picker = read("components/TeamPicker.svelte");

  it("shares one pickerCols count so every tile is the same width", () => {
    // pickerCols spans the whole picker (seven-team seasons chunk everything
    // to 4 columns; otherwise the widest division sets the count), and each
    // division chunks through splitDivision at that shared width. The old
    // .tight type-size tier is gone with the seven-wide cram.
    expect(picker).toContain("pickerCols");
    expect(picker).toContain("splitDivision");
    expect(picker).not.toContain("class:tight");
  });
});

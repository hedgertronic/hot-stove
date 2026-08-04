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

  it("carries the transition and the :active dip", () => {
    const quit = app.match(/\n  \.quit \{[^}]*\}/)?.[0] ?? "";
    expect(quit).toContain("transition: transform 0.08s");
    expect(app).toContain(".quit:active {\n    transform: translate(-1px, -1px);");
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
    expect(box).toContain('class="chip eff mb"');
    expect(box).toContain('class="chip eff bc"');
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
  const list = read("components/PlayerList.svelte");

  it("carries both arrows and swaps them at the wide tier", () => {
    // ↑ on the phone (rail above the market), ← at width (rail in the left
    // column). Both hints carry the pair.
    expect(list.match(/class="ph" aria-hidden="true">↑</g)?.length).toBe(2);
    expect(list.match(/class="wd" aria-hidden="true">←</g)?.length).toBe(2);
    expect(list).toContain(".hint .wd {\n    display: none;");
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
    expect(css).toContain("--pink-8: #c2255c;");
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

describe("the relocate grid's seven-column tier", () => {
  const picker = read("components/TeamPicker.svelte");

  it("keys tighter type off the season's own column count", () => {
    expect(picker).toContain("class:tight={pickCols >= 7}");
    const tight = picker.match(/\.pickgrid\.tight \.teambtn \{[^}]*\}/)?.[0] ?? "";
    expect(tight).toContain("font-size: 12px");
    expect(tight).toContain("letter-spacing: 0.02em");
  });
});

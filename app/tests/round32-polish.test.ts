/** Round 32 — source-text pins for the release-polish pass.
 *
 * Same idiom as rounds 30/31: anchored substring/regex pins on the shipped
 * source, so a refactor that silently drops a decision fails loud and cheap.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (f: string) =>
  fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), `../src/${f}`),
    "utf8",
  );

describe("award pills center their caps, not their font metrics", () => {
  const pill = read("components/AwardPill.svelte");

  it("trims the line box to the cap band where the engine can", () => {
    // Progressive: @supports gates the trim, engines without it keep the
    // measured 0.4px optical padding.
    expect(pill).toContain("@supports (text-box: trim-both cap alphabetic)");
    expect(pill).toContain("text-box: trim-both cap alphabetic;");
    // The trimmed branch retires the estimate — keeping both would
    // double-correct.
    expect(pill).toMatch(/@supports[^{]*\{[\s\S]*?padding-top: 0;[\s\S]*?\n  \}/);
  });
});

describe("the FRONT OFFICE confirm sits on the market's right edge", () => {
  const rows = read("components/SpecialRows.svelte");

  it("takes the chip inset rule at both padding tiers, base first", () => {
    // The player rows' confirm inherits −4/−8 from their `.right` column;
    // these rows' confirm is a direct flex child and carries its own.
    const base = rows.indexOf("margin-right: -4px;\n  }\n  @media (min-width: 760px) {");
    expect(base, "base −4px followed by the wide −8px tier").toBeGreaterThan(-1);
    // Order is the whole ballgame: a media query adds no specificity.
    const confirmIdx = rows.indexOf(".confirm {");
    expect(confirmIdx).toBeGreaterThan(-1);
    expect(rows.slice(confirmIdx)).toContain("margin-right: -8px;");
  });
});

describe("the header mode chip wears the corner-pill uniform", () => {
  it("cardstock, not amber — amber is the trophy register now", () => {
    const chip = read("App.svelte").match(/\.modechip \{[^}]*\}/)?.[0] ?? "";
    expect(chip).toContain("background: var(--card);");
    expect(chip).not.toContain("amber");
  });
});

describe("the ✕ is drawn, not typed", () => {
  it("CloseGlyph strokes one path in currentColor", () => {
    const glyph = read("components/CloseGlyph.svelte");
    expect(glyph).toContain("stroke: currentColor;");
    expect(glyph).toContain('viewBox="0 0 14 14"');
  });

  it("both dismissal pills use it — no literal ✕ glyph is rendered", () => {
    // U+2715 is not in bundled Nunito; as text, every engine substituted its
    // own fallback face and the mark differed between Chrome and Safari.
    expect(read("App.svelte")).toContain("<CloseGlyph />");
    expect(read("components/Sheet.svelte")).toContain("<CloseGlyph />");
    expect(read("App.svelte")).not.toMatch(/\{[^{}]*"✕"[^{}]*\}/);
    expect(read("components/Sheet.svelte")).not.toContain(">✕<");
  });
});

describe("review fixes: the two markets share one right edge", () => {
  it("PrimePicker carries the wide tier's −8px, declared after the base", () => {
    const src = read("components/PrimePicker.svelte");
    const base = src.indexOf("margin-right: -4px;");
    const wide = src.indexOf("margin-right: -8px;");
    expect(base).toBeGreaterThan(-1);
    expect(wide, "wide tier present and after the base rule").toBeGreaterThan(base);
  });
});

describe("review fixes: a failed career tap re-enables the rows", () => {
  it("both pickers release `busy` in finally and close only on success", () => {
    for (const f of ["components/PrimePicker.svelte", "components/SpecialPrimePicker.svelte"]) {
      const src = read(f);
      expect(src, f).toMatch(/try \{\n\s+await game\.applyPrime/);
      expect(src, f).toMatch(/\} finally \{\n\s+busy = false;/);
    }
  });
});

describe("review fixes: the sheet keeps the modal promise", () => {
  const sheet = read("components/Sheet.svelte");

  it("declares aria-modal and cycles Tab inside itself", () => {
    expect(sheet).toContain('aria-modal="true"');
    expect(sheet).toContain("function trapTab(");
    expect(sheet).toContain("trapTab(e)");
  });

  it("hands focus back to the opener on close", () => {
    expect(sheet).toContain("return () => opener?.focus();");
  });
});

describe("review fixes: names and keys assistive tech is owed", () => {
  it("the HUD ✕ carries an accessible name in every state", () => {
    expect(read("App.svelte")).toContain('"Quit this game"');
  });

  it("every role=button confirm answers Space as well as Enter", () => {
    for (const f of ["components/PlayerList.svelte", "components/SpecialRows.svelte"]) {
      const src = read(f);
      // No confirm keydown handler that checks Enter alone.
      expect(src, f).not.toMatch(/onkeydown=\{\(e\) => e\.key === "Enter" &&/);
    }
  });
});

describe("review fixes: the finalization window", () => {
  const engine = read("lib/engine.svelte.ts");

  it("the club-completing move is saved before the async finish", () => {
    expect(engine).toMatch(/this\.save\(\);\n\s+void this\.finishGame\(\);/);
  });

  it("a quit during the dream solve stands the finalizer down", () => {
    expect(engine).toContain("if (this.abandoned) return;");
    expect(read("App.svelte")).toContain("game?.abandon();");
  });
});

describe("review fixes: prototype-safe bank lookup", () => {
  it("SeasonsModal validates history banks with hasOwn, not `in`", () => {
    const src = read("components/SeasonsModal.svelte");
    expect(src).toContain("Object.hasOwn(BANKS, e.bank)");
    expect(src).not.toContain("e.bank in BANKS");
  });
});

describe("review fixes: retired dead code stays dead", () => {
  it("awardDef and --orange-deep are gone", () => {
    expect(read("lib/awards.ts")).not.toContain("awardDef");
    expect(read("app.css")).not.toContain("--orange-deep");
  });
});

describe("the empty-front-office bank is From the Ground Up", () => {
  it("modes.ts names it, and the key stays classic", () => {
    const modes = read("lib/modes.ts");
    expect(modes).toContain('name: "From the Ground Up"');
    expect(modes).toMatch(/classic: \{ emoji: "💼"/);
  });

  it("the help sheet teaches the new name", () => {
    const help = read("components/HelpModal.svelte");
    expect(help).toContain("From the Ground Up adds an owner and a ballpark.");
    expect(help).toContain("<b>💼 From the Ground Up:</b>");
    expect(help).not.toContain("Clean House");
  });
});

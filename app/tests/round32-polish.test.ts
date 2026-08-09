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

  it("draws through app.css's shared chip box", () => {
    expect(pill).toContain('class="chipbox qb ');
    // The height is the chip's own, stated, and a whole number of pixels: a
    // fractional border box lands its edge mid-device-pixel and the ring reads
    // as cut off top and bottom.
    expect(pill).toContain("--chip-h: 16px;");
    expect(pill).toContain("--chip-h: 15px;");
  });

  it("carries no text-box trim branch of its own — the trade lives in app.css", () => {
    // text-box-trim trims a BLOCK CONTAINER's first and last line boxes, so it
    // goes on the `.chiplbl` element this pill wraps its word in, never on the
    // inline-flex chip. Both halves of the trade — the trim and the zeroed
    // padding it replaces — are written once in app.css and pinned together
    // there; a second copy here could hold one half without the other.
    expect(pill).not.toContain("text-box:");
    expect(pill).not.toContain("@supports");
  });
});

describe("the FRONT OFFICE confirm sits on the market's right edge", () => {
  const rows = read("components/SpecialRows.svelte");

  it("carries no chip inset — every right edge is the row's full padding", () => {
    // The chip inset rule is RETIRED (PlayerList's .right documents it): a
    // pulled chip put every chip-terminated row past every text-terminated
    // one, so nothing here pulls. Rows align because nobody does.
    expect(rows).not.toContain("margin-right: -");
  });
});

describe("flags render on Windows — the polyfill and the stack agree", () => {
  // Three pieces that only work together: main.ts registers the font on
  // platforms without flag glyphs, app.css puts it first in the display
  // stack, and the font's flags-only coverage is what makes leading the
  // stack safe. Losing any one silently returns Windows to "US ×7".
  it("main.ts runs the polyfill and --disp leads with its family", () => {
    const main = read("main.ts");
    expect(main).toContain('from "country-flag-emoji-polyfill"');
    expect(main).toContain('polyfillCountryFlagEmojis("Twemoji Country Flags", flagFontUrl)');
    expect(read("app.css")).toContain(
      '--disp: "Twemoji Country Flags", "Nunito"',
    );
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
    // 15.077 = 14 × 14/13: a 14px box (whole-pixel air in the pill) whose
    // ink still paints at the tuned 13px scale, origin backed up so the
    // ink's bbox center holds the viewBox center. Symmetric origins pin
    // GEOMETRIC center — a +0.5px optical lift was tried and reverted the
    // same day (right on one engine, high on the rest); no per-glyph
    // optical constants may creep back.
    expect(glyph).toContain('viewBox="-0.538 -0.538 15.077 15.077"');
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
  it("no surface pulls a chip past the row's padding — the inset is retired", () => {
    // One right edge for market rows, both prime pickers, the front office,
    // the rail and the finale squads: the retired inset pull must not creep
    // back into any of them, or that surface's chips overhang the rest.
    for (const f of [
      "components/PlayerList.svelte",
      "components/MarketRow.svelte",
      "components/PrimePicker.svelte",
      "components/SpecialPrimePicker.svelte",
      "components/SpecialRows.svelte",
      "components/RailSeat.svelte",
      "components/Finale.svelte",
      "components/HelpModal.svelte",
    ]) {
      expect(read(f), f).not.toContain("margin-right: -");
    }
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

  it("confirms are real <button> elements — no role=button spans remain", () => {
    for (const f of ["components/PlayerList.svelte", "components/SpecialRows.svelte"]) {
      const src = read(f);
      // No span with role="button" — confirms are native buttons now.
      expect(src, f).not.toContain('role="button"');
      // No manual keyboard handler — native buttons handle Enter and Space.
      expect(src, f).not.toContain("onkeydown");
      // The confirm button carries class="confirm" on a real <button> element.
      expect(src, f).toMatch(/<button[^>]*class="confirm"/);
    }
  });
});

describe("review fixes: the confirm pill wears one tone, fill matching ring", () => {
  const css = read("app.css");

  it(".confirm base lives in app.css with an ink ring and matching fill", () => {
    // Two blocks answer to `.confirm`: the shared `.chipbox, .confirm` recipe
    // and the pill's own. The last one is the pill's.
    // What this pin protects is the ONE-TONE rule (fill = ring, no halo);
    // the tone itself has been the owner's call twice — ink → gray (round
    // four: no ink-in-a-gray-frame) → ink again (round eight: the gray read
    // washed-out). .pos.pit rode along both times.
    const blocks = [...css.matchAll(/(?:^|\n)\.confirm \{([^}]*)\}/g)].map((m) => m[1]);
    expect(blocks.length, "app.css has a .confirm block").toBeGreaterThan(0);
    const block = blocks.at(-1)!;
    expect(block, "app.css .confirm uses an ink border").toContain("border: 2px solid var(--ink)");
    expect(block, "app.css .confirm has no gray border").not.toContain("border: 2px solid var(--line)");
    expect(block, "app.css .confirm fill matches its ring").toContain("background: var(--ink)");
    expect(block, "app.css .confirm has no gray fill").not.toContain("background: var(--line)");
  });

  it("components keep only their position deltas — no base re-declaration", () => {
    // Each component's .confirm block must NOT re-declare the shared base
    // properties (border, background) that live in app.css. The delta blocks
    // carry flex-position properties only (margin-left, flex, margin-right).
    for (const f of ["components/PlayerList.svelte", "components/SpecialRows.svelte"]) {
      const src = read(f);
      const confirmIdx = src.indexOf(".confirm {");
      // A component may have no bare .confirm block (all deltas on .prow > .confirm).
      if (confirmIdx === -1) continue;
      const block = src.slice(confirmIdx, src.indexOf("}", confirmIdx) + 1);
      expect(block, `${f} .confirm does not re-declare base border`).not.toContain(
        "border: 2px solid var(--line)",
      );
      expect(block, `${f} .confirm does not re-declare base background`).not.toContain(
        "background: var(--line)",
      );
    }
  });
});

describe("review fixes: the finalization window", () => {
  const engine = read("lib/engine.svelte.ts");

  it("the club-completing move is saved before the async finish", () => {
    // The promise is kept rather than discarded — `driveReplay` awaits it, so a
    // replay presents a resolved finale instead of the "landed, no finale yet"
    // window this ordering opens. The ORDER is what this pins: save, then
    // finish.
    expect(engine).toMatch(/this\.save\(\);\n\s+this\.finishing = this\.finishGame\(\);/);
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

describe("the empty-front-office bank is Open Market", () => {
  it("modes.ts names it, and the key stays classic", () => {
    const modes = read("lib/modes.ts");
    expect(modes).toContain('name: "Open Market"');
    expect(modes).toMatch(/classic: \{ emoji: "🛒"/);
  });

  it("the help sheet teaches the new name", () => {
    const help = read("components/HelpModal.svelte");
    expect(help).toContain("Open Market adds an owner and a ballpark.");
    expect(help).toContain("<b>🛒 Open Market:</b>");
  });

  it("no retired name survives in any component, even across a line wrap", () => {
    // Whitespace-normalized on purpose: "Clean\n    House" in wrapped prose
    // slipped past a plain toContain once — the phrase, not the line, is what
    // must be gone. modes.ts is exempt: its comment records the rename
    // history by design. Prettier reflows prose, so any component copy can
    // wrap anywhere.
    const files = fs
      .readdirSync(
        path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/components"),
      )
      .filter((f) => f.endsWith(".svelte"));
    for (const f of files) {
      const flat = read(`components/${f}`).replace(/\s+/g, " ");
      expect(flat, f).not.toContain("Clean House");
      expect(flat, f).not.toContain("From the Ground Up");
      expect(flat, f).not.toContain("Owner's Box");
    }
  });
});

describe("CSS consolidation: shared bases live in app.css", () => {
  const css = read("app.css");

  it("the row tap surface reset (.prow-btn, .srow-btn) is declared in app.css", () => {
    // One shared base for PlayerList and SpecialRows so the two reset blocks
    // cannot drift. Both class names appear in the combined rule.
    expect(css).toContain(".prow-btn,");
    expect(css).toContain(".srow-btn {");
    const btnIdx = css.indexOf(".prow-btn,");
    const block = css.slice(btnIdx, css.indexOf("}", btnIdx) + 1);
    expect(block).toContain("background: none");
    expect(block).toContain("cursor: inherit");
    expect(block).toContain("flex: 1");
  });

  it("PlayerList and SpecialRows do not re-declare the row-btn reset", () => {
    for (const [f, cls] of [
      ["components/PlayerList.svelte", ".prow-btn {"],
      ["components/SpecialRows.svelte", ".srow-btn {"],
    ] as const) {
      const src = read(f);
      // If the class appears it must not carry the reset properties — only
      // the child-combinator .mid scoping rule is allowed to remain.
      const idx = src.indexOf(cls);
      if (idx === -1) continue; // no block at all is also correct
      const block = src.slice(idx, src.indexOf("}", idx) + 1);
      expect(block, `${f} ${cls} must not re-declare background: none`).not.toContain(
        "background: none",
      );
      expect(block, `${f} ${cls} must not re-declare cursor: inherit`).not.toContain(
        "cursor: inherit",
      );
    }
  });

  it("the picker chrome (.picker-note, .picker-list) is declared in app.css", () => {
    // PrimePicker and SpecialPrimePicker share the same loading/error/list
    // chrome; one home in app.css so the two sheets cannot drift.
    expect(css).toContain(".picker-note {");
    expect(css).toContain(".picker-list {");
    const noteIdx = css.indexOf(".picker-note {");
    const noteBlock = css.slice(noteIdx, css.indexOf("}", noteIdx) + 1);
    expect(noteBlock).toContain("text-align: center");
    expect(noteBlock).toContain("color: var(--muted)");
    const listIdx = css.indexOf(".picker-list {");
    const listBlock = css.slice(listIdx, css.indexOf("}", listIdx) + 1);
    expect(listBlock).toContain("display: grid");
    expect(listBlock).toContain("gap: 6px");
  });

  it("both pickers use the global picker-note and picker-list classes", () => {
    for (const f of ["components/PrimePicker.svelte", "components/SpecialPrimePicker.svelte"]) {
      const src = read(f);
      expect(src, `${f} uses picker-note in markup`).toContain('class="picker-note"');
      expect(src, `${f} uses picker-list in markup`).toContain('class="picker-list"');
      // Local .note/.list blocks are gone — the global provides the declarations.
      expect(src, `${f} does not re-declare .note {`).not.toContain("\n  .note {");
      expect(src, `${f} does not re-declare .list {`).not.toContain("\n  .list {");
    }
  });
});

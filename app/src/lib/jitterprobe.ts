/** On-device movement recorder for the corner pills — a diagnostic, not a
 * feature. `?jitter` in the URL is the only thing that loads this module
 * (App.svelte imports it dynamically), so it costs nothing in ordinary play.
 *
 * Why it exists: the owner sees the undo pill move around a reel landing on
 * a real iPhone, and no emulation has reproduced it. This probe samples the
 * page's geometry every animation frame ON THE DEVICE and writes an event to
 * a fixed overlay whenever anything actually moves, tagged by WHICH of three
 * distinct mechanisms moved it:
 *
 *   UNDO-ONLY — the undo pill's rect moved while the ? pill's held still:
 *               the movement is local to the pill (layout or style).
 *   PAGE      — undo and ? moved together: the whole document shifted
 *               (scroll clamp, layout above the HUD, anchoring).
 *   VIEWPORT  — visualViewport's offset/height changed: the browser's own
 *               chrome (toolbar collapse/expand) moved the world.
 *
 * A fourth outcome is the most useful of all: the eye sees movement and the
 * log stays empty. Rects can't see compositor re-rasterization, so a silent
 * log during a visible jitter is positive evidence the artifact lives below
 * layout — in paint — not in geometry.
 *
 * The DISABLED line timestamps the undo pill's disabled-attribute flips.
 * These fire at commit/undo taps, NOT at the land — the pill is DOM-static
 * across every spinning→landed flush — so the line is a session clock for
 * reading movement events against, not a land marker. DOM writes happen
 * only when an event fires — a per-frame writer would repaint the page
 * every frame and perturb the thing being measured. */

const EPS = 0.01;

type Sample = {
  t: number;
  undoTop: number | null;
  helpTop: number | null;
  hudTop: number | null;
  scrollY: number;
  docH: number;
  vvTop: number;
  vvH: number;
  disabled: boolean | null;
};

function read(): Sample {
  const vv = window.visualViewport;
  const top = (sel: string) =>
    document.querySelector(sel)?.getBoundingClientRect().top ?? null;
  const undo = document.querySelector<HTMLButtonElement>(".undo");
  return {
    t: performance.now(),
    undoTop: undo?.getBoundingClientRect().top ?? null,
    helpTop: top(".help:not(.undo):not(.trophy)"),
    hudTop: top(".hud"),
    scrollY: window.scrollY,
    docH: document.documentElement.scrollHeight,
    vvTop: vv?.offsetTop ?? 0,
    vvH: vv?.height ?? window.innerHeight,
    disabled: undo?.disabled ?? null,
  };
}

const moved = (a: number | null, b: number | null) =>
  a !== null && b !== null && Math.abs(a - b) > EPS;

export function startJitterProbe(): void {
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  // Fixed and inert: out of flow so the probe cannot move what it measures,
  // pointer-events none so it cannot swallow the taps that drive the game.
  box.style.cssText =
    "position:fixed;left:4px;right:4px;bottom:4px;z-index:99999;" +
    "pointer-events:none;font:10px/1.5 ui-monospace,monospace;" +
    "color:#e8f0e8;background:rgba(20,24,20,.88);border-radius:6px;" +
    "padding:6px 8px;white-space:pre-wrap;word-break:break-all;";
  box.textContent = "JITTER PROBE armed — play a roll, then screenshot this.";
  document.body.appendChild(box);

  const lines: string[] = [];
  const log = (line: string) => {
    lines.push(line);
    if (lines.length > 14) lines.shift();
    box.textContent = lines.join("\n");
  };

  let prev = read();
  const frame = () => {
    const cur = read();
    const dt = cur.t.toFixed(0).padStart(6);

    if (cur.disabled !== prev.disabled && cur.disabled !== null)
      log(`${dt} DISABLED ${prev.disabled} → ${cur.disabled}`);

    const dUndo = moved(cur.undoTop, prev.undoTop);
    const dHelp = moved(cur.helpTop, prev.helpTop);
    const dVv =
      Math.abs(cur.vvTop - prev.vvTop) > EPS || Math.abs(cur.vvH - prev.vvH) > EPS;

    if (dUndo && !dHelp)
      log(
        `${dt} ⚠ UNDO-ONLY ${prev.undoTop!.toFixed(2)} → ${cur.undoTop!.toFixed(2)}` +
          ` (? held ${cur.helpTop?.toFixed(2)})`,
      );
    else if (dUndo && dHelp)
      log(
        `${dt} PAGE Δ${(cur.undoTop! - prev.undoTop!).toFixed(2)}` +
          ` scrollY ${prev.scrollY.toFixed(1)} → ${cur.scrollY.toFixed(1)}` +
          ` docH ${prev.docH} → ${cur.docH}`,
      );
    if (dVv)
      log(
        `${dt} VIEWPORT top ${prev.vvTop.toFixed(1)} → ${cur.vvTop.toFixed(1)}` +
          ` h ${prev.vvH.toFixed(1)} → ${cur.vvH.toFixed(1)}`,
      );

    prev = cur;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

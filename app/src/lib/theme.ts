/** The day/night switch, persisted at `hotstove.theme`.
 *
 * THREE STATES IN STORAGE, TWO ON SCREEN. Absent means "follow the OS" —
 * the player who never touches the toggle gets the device's own setting on
 * every visit, including when the device changes its mind at sunset. A
 * stored "light" or "dark" is an explicit choice and wins over the OS.
 * The toggle always writes an explicit choice: it flips whatever is
 * currently SHOWING, so a system-dark player who taps it gets light, and
 * the choice sticks.
 *
 * THE ATTRIBUTE IS THE THEME. Every dark rule in app.css keys off
 * `[data-theme="dark"]` on the root element and nothing else — no
 * prefers-color-scheme media queries in the stylesheet, so there is exactly
 * one switch and index.html's pre-paint script and this module are its only
 * two writers. The inline script in index.html duplicates resolveTheme()'s
 * logic BY HAND (it runs before any module exists, to keep the first paint
 * from flashing the wrong ground) — change the two together.
 *
 * theme-color RIDES ALONG: iOS Safari paints the collapsed-toolbar and
 * overscroll regions from the meta tag, not the stylesheet, so a theme
 * change that skipped it would leave day-colored chrome around a night
 * page. The two hexes are app.css's two --ground values — change together. */

export type Theme = "light" | "dark";

const THEME_KEY = "hotstove.theme";
/** app.css --ground, both themes — the meta theme-color's two values. */
const GROUND: Record<Theme, string> = { light: "#f6f1e3", dark: "#171410" };

function stored(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "dark" || t === "light" ? t : null;
  } catch {
    return null;
  }
}

/** What should be showing right now: the stored choice, else the OS's.
 * matchMedia is feature-checked for vitest's DOM, where it does not exist —
 * absent an OS opinion the game defaults to day. */
export function resolveTheme(): Theme {
  const s = stored();
  if (s) return s;
  return typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Stamp the theme onto the document — attribute plus theme-color meta.
 * Always writes both values explicitly rather than removing the attribute
 * for light: [data-theme="light"] matches no rule, so it is inert, and an
 * always-present attribute is one code path instead of two. */
export function applyTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", GROUND[t]);
}

/** Flip whatever is showing, persist the result as an explicit choice, and
 * return it (the toggle's aria-label reads the return). */
export function toggleTheme(): Theme {
  const next: Theme = resolveTheme() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* storage unavailable — the flip still applies for this visit */
  }
  applyTheme(next);
  return next;
}

/** Follow the OS while (and only while) the player has never chosen. Returns
 * the teardown, $effect-style. Guarded like resolveTheme for vitest. */
export function watchSystemTheme(): () => void {
  if (typeof matchMedia === "undefined") return () => {};
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const follow = () => {
    if (!stored()) applyTheme(mq.matches ? "dark" : "light");
  };
  mq.addEventListener("change", follow);
  return () => mq.removeEventListener("change", follow);
}

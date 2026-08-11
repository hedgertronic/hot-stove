import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import flagFontUrl from "./assets/TwemojiCountryFlags.woff2?url";
import { mount } from "svelte";
import "./app.css";
import App from "./App.svelte";
import { applyTheme, resolveTheme, watchSystemTheme } from "./lib/theme";

// The theme attribute is already on <html> — index.html's pre-paint script
// put it there so the first frame never flashes the wrong ground. Re-applying
// here is the module taking ownership: it also stamps the theme-color meta
// (the inline script sets only the attribute), and from here on the OS
// setting is followed live while no explicit choice is stored.
applyTheme(resolveTheme());
// …except on the dev-only OG route (App.svelte gates it the same way): the
// share card is a LIGHT artifact (OgPreview pins the attribute), and a live
// OS watcher could restamp it dark mid-capture on a machine with no stored
// choice. The route renders one frozen frame; it has no use for a live follow.
if (!(import.meta.env.DEV && new URLSearchParams(location.search).has("og-preview")))
  watchSystemTheme();

// Windows ships no country-flag glyphs: Chrome and Edge there draw a
// regional-indicator pair (🇺🇸) as two letter glyphs out of Segoe UI Emoji, so
// every passport stamp read "US" in a face that isn't even ours. The polyfill
// self-detects — on a platform whose emoji font already draws flags (iOS,
// macOS, Android) it does nothing and fetches nothing; where flags are
// missing it registers "Twemoji Country Flags", a font containing ONLY the
// flag sequences (including the 🏴 England/Scotland tag flags), which app.css
// puts first in the display stack. Every other codepoint falls through it,
// so Nunito and the platform emoji font keep everything else.
// The font URL is OUR bundled copy of the package's woff2 (~78KB, fetched
// only if the @font-face is ever used): the package's default is a CDN, and
// this site serves everything it needs itself.
polyfillCountryFlagEmojis("Twemoji Country Flags", flagFontUrl);

// iOS Safari only fires :active on elements when a touchstart listener exists
// somewhere in the ancestor chain. A passive no-op on the document enables the
// pseudo-class globally so press animations (badge slots, buttons, pickers) fire
// on the first tap rather than the second.
document.addEventListener("touchstart", () => {}, { passive: true });

// The static boot copy (index.html) is for crawlers and the pre-JS paint;
// Svelte 5's mount() APPENDS to the target rather than replacing its
// children, so the copy is removed by hand or it would sit above the game
// forever.
document.getElementById("static-boot")?.remove();

export default mount(App, { target: document.getElementById("app")! });

/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [
    svelte(),
    {
      // Preload Nunito from the document itself. The font otherwise loads
      // only after the CSS arrives and matches, and `font-display: swap`
      // shows the fallback stack in the gap — on Windows that's Trebuchet
      // MS Bold wearing the whole interface (no ui-rounded, and Arial
      // Rounded MT Bold only ships with Office). Preloading closes the gap
      // to nothing on any connection that can run the game at all.
      // NUNITO ONLY: the flag font (TwemojiCountryFlags) must NOT preload —
      // main.ts registers it only on platforms without flag glyphs, and a
      // preload would fetch ~78KB everywhere for nothing.
      name: "preload-nunito",
      transformIndexHtml: {
        order: "post",
        handler(_html, ctx) {
          return Object.keys(ctx.bundle ?? {})
            .filter((f) => f.includes("nunito") && f.endsWith(".woff2"))
            .map((f) => ({
              tag: "link",
              attrs: {
                rel: "preload",
                as: "font",
                type: "font/woff2",
                // Fonts are always fetched anonymous-CORS; without the attr
                // the preload and the CSS fetch are different cache keys and
                // the font downloads twice.
                crossorigin: "",
                href: `./${f}`,
              },
              injectTo: "head",
            }));
        },
      },
    },
  ],
  // Relative base so the build works at any GitHub Pages path.
  base: "./",
  test: {
    projects: [
      // Engine/unit tests (plus SSR-string component renders) run in plain
      // node against svelte's server runtime.
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          // The bot STUDY files replay thousands of games (~90s) — research
          // artifacts, not regressions. Opt in with BOT_STUDIES=1; the main
          // powerup-bots.test.ts harness regression always runs.
          exclude: [
            ...configDefaults.exclude,
            "tests/**/*.dom.test.ts",
            ...(process.env.BOT_STUDIES ? [] : ["tests/bots/study*.test.ts"]),
          ],
        },
      },
      // *.dom.test.ts mount real components (client runtime) in jsdom — the
      // browser resolve condition is what routes `mount` to the client build.
      {
        extends: true,
        resolve: { conditions: ["browser"] },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["tests/**/*.dom.test.ts"],
        },
      },
    ],
  },
});

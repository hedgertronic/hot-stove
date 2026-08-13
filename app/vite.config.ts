/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import pkg from "./package.json";

export default defineConfig({
  // The bug-report body stamps the running build (HelpModal reportHref) —
  // without it, issues filed against different deploys are indistinguishable.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // No font preload plugin: Nunito is no longer a bundle asset to race — it
  // ships as a render-blocking data-URI stylesheet (public/nunito.css, linked
  // from index.html), which is what retired the preload it used to need.
  plugins: [svelte()],
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
          // The bot files replay full games through the real engine and
          // dominate the wall clock, so both ride opt-in env flags. The
          // STUDY files (research artifacts, not regressions) need
          // BOT_STUDIES=1; the powerup-bots.test.ts harness regression
          // (400 games/bot, ~10 min — all but ~25s of the whole suite)
          // needs BOT_HARNESS=1. `npm test` sets neither and stays fast;
          // `npm run test:full` runs separately on a schedule or by hand.
          exclude: [
            ...configDefaults.exclude,
            "tests/**/*.dom.test.ts",
            ...(process.env.BOT_STUDIES ? [] : ["tests/bots/study*.test.ts"]),
            ...(process.env.BOT_HARNESS ? [] : ["tests/bots/powerup-bots.test.ts"]),
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

/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
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

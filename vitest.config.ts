import path from "node:path";

import { defineConfig } from "vitest/config";

const monorepoRoot = path.resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: {
      "@generals-plus/engine": path.join(
        monorepoRoot,
        "packages/engine/dist/index.mjs",
      ),
      "@generals-plus/shared-types": path.join(
        monorepoRoot,
        "packages/shared-types/dist/index.js",
      ),
    },
  },
  test: {
    globals: true,
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          include: [
            "apps/client/tests/**/*.test.{ts,tsx}",
            "apps/client/src/**/*.test.{ts,tsx}",
            "packages/*/src/**/*.test.{ts,tsx}",
          ],
          environment: "jsdom",
          setupFiles: ["./apps/client/tests/setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          include: ["apps/server/tests/**/*.test.ts"],
          hookTimeout: 30_000,
          pool: "forks",
          fileParallelism: false,
          setupFiles: ["./apps/server/tests/setup.ts"],
        },
      },
    ],
  },
});

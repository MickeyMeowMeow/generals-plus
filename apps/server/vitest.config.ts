import path from "node:path";

import { sharedConfig } from "@generals-plus/vitest-config";
import { defineConfig } from "vitest/config";

const monorepoRoot = path.resolve(__dirname, "../..");

export default defineConfig({
  ...sharedConfig,
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
    ...sharedConfig.test,
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    pool: "forks",
    fileParallelism: false,
  },
});

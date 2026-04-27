import path from "node:path";
import { fileURLToPath } from "node:url";

import { sharedConfig } from "@generals-plus/vitest-config";
import { defineConfig } from "vitest/config";

const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  ...sharedConfig,
  resolve: {
    alias: {
      "@generals-plus/engine": path.join(
        monorepoRoot,
        "packages/engine/src/index.ts",
      ),
      "@generals-plus/shared-types": path.join(
        monorepoRoot,
        "packages/shared-types/src/index.ts",
      ),
    },
  },
  test: {
    ...sharedConfig.test,
    setupFiles: ["./tests/setup.ts"],
  },
});

import { sharedConfig } from "@generals-plus/vitest-config";
import { defineConfig } from "vitest/config";
export default defineConfig({
  ...sharedConfig,
  projects: [
    {
      name: "packages",
      root: "./packages/*",
      test: {
        ...sharedConfig.test,
        // Project-specific configuration
      },
    },
  ],
});

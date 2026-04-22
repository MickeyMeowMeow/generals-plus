import { webConfig } from "@generals-plus/vitest-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...webConfig,
  test: {
    ...webConfig.test,
    // Package-specific overrides if needed
  },
});

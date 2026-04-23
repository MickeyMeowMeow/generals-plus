import { webConfig } from "@generals-plus/vitest-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...webConfig,
  test: {
    ...webConfig.test,
    passWithNoTests: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
  },
});

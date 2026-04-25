import path from "node:path";

import { webConfig } from "@generals-plus/vitest-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...webConfig,
  test: {
    ...webConfig.test,
    passWithNoTests: false,
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: [
      {
        find: /^@generals-plus\/(.*)/,
        replacement: path.join(__dirname, "../../packages", "$1", "src"),
      },
    ],
  },
});

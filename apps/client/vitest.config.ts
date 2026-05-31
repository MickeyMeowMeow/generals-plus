import path from "node:path";

import { webConfig } from "@generals-plus/vitest-config";
import { defineConfig } from "vitest/config";

export default defineConfig({
  ...webConfig,
  test: {
    ...webConfig.test,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
    },
    server: {
      deps: {
        inline: ["@pixi/react"],
      },
    },
  },
  resolve: {
    alias: [
      {
        find: /^#\/tests\/(.*)/,
        replacement: path.join(import.meta.dirname, "tests", "$1"),
      },
      {
        find: /^@generals-plus\/(.*)/,
        replacement: path.join(
          import.meta.dirname,
          "../../packages",
          "$1",
          "src",
        ),
      },
    ],
  },
});

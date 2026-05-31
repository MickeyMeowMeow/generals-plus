import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/*", "packages/*"],
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text"],
      reportsDirectory: "./coverage",
    },
  },
});

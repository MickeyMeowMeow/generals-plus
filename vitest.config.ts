import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/client/src"),
    },
  },
  test: {
    include: [
      "apps/client/tests/**/*.test.{ts,tsx}",
      "apps/client/src/**/*.test.{ts,tsx}",
    ],
  },
});

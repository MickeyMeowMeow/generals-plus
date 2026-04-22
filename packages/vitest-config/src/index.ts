import { defineConfig } from "vitest/config";

export const sharedConfig = defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    setupFiles: ["./test/setup.ts"],
  },
});

export const webConfig = defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    environment: "jsdom",
  },
});

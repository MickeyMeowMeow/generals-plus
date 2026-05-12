import os from "node:os";
import path from "node:path";
import process from "node:process";

import { defineConfig } from "vitest/config";

export const sharedConfig = defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
  },
});

export const webConfig = defineConfig({
  ...sharedConfig,
  test: {
    ...sharedConfig.test,
    environment: "happy-dom",
    execArgv: [
      "--localstorage-file",
      path.resolve(os.tmpdir(), `vitest-${process.pid}.localstorage`),
    ],
  },
});

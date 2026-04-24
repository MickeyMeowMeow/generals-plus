import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  resolve: {
    /**
     * Keep engine aliases more specific than the client-wide "@" alias.
     */
    alias: [
      {
        find: "@/domain",
        replacement: fileURLToPath(
          new URL("../../packages/engine/src/domain", import.meta.url),
        ),
      },
      {
        find: "@/math",
        replacement: fileURLToPath(
          new URL("../../packages/engine/src/math", import.meta.url),
        ),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
  },
});

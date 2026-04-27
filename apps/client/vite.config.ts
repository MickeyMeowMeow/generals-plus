import path from "node:path";

import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  resolve: {
    alias: [
      {
        // Resolve workspace package imports directly to source during local dev.
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

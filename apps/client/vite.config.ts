import path from "node:path";

import { reactRouter } from "@react-router/dev/vite";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    reactRouter(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      {
        find: /^@generals-plus\/(.*)/,
        replacement: path.join(
          import.meta.dirname,
          "../../packages",
          "$1",
          "src",
        ),
      },
      {
        find: /^#\//,
        replacement: `${path.join(import.meta.dirname, "src")}/`,
      },
    ],
  },
});

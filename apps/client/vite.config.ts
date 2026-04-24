import { reactRouter } from "@react-router/dev/vite";
import babel from "@rolldown/plugin-babel";
import { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [reactRouter(), babel({ presets: [reactCompilerPreset()] })],
});

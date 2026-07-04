import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// "base" must match the GitHub Pages sub-path (the repo name), so that asset
// URLs resolve correctly on https://zakpruitt.github.io/pokemon-binder-planner.
export default defineConfig({
  plugins: [react()],
  base: "/pokemon-binder-planner/",
});

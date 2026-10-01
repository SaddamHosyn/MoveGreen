import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [tanstackStart(), react(), tailwindcss(), tsconfigPaths(), cloudflare({
    viteEnvironment: {
      name: "ssr"
    }
  })],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
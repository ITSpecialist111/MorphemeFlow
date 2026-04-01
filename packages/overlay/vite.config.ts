import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src",
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        overlay: resolve(__dirname, "src/overlay.html"),
        settings: resolve(__dirname, "src/settings.html"),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});

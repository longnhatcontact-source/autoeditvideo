import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const api = "http://127.0.0.1:5190";

export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 4000 },
  server: {
    port: 5191,
    proxy: { "/api": api, "/media": api, "/sfx": api, "/brand": api },
  },
});

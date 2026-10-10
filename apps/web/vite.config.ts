import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    target: "es2022",
    // pdf.js ships its own worker as a separate asset; the warning is about that deliberately lazy chunk.
    chunkSizeWarningLimit: 900
  }
});

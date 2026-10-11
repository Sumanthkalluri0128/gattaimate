import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["gattaimate-icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "GattaiMate — PDF Toolkit",
        short_name: "GattaiMate",
        description: "Merge, split, sign, redact and optimize PDFs privately on your device.",
        theme_color: "#10111d",
        background_color: "#10111d",
        display: "standalone",
        start_url: "/",
        scope: "/",
        categories: ["productivity", "utilities"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // Precache the app shell, every lazy page, the pdf.js worker and the qpdf WebAssembly so it all works offline.
        globPatterns: ["**/*.{js,css,html,svg,png,wasm,mjs}"],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: "index.html",
        runtimeCaching: [{ urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i, handler: "StaleWhileRevalidate", options: { cacheName: "fonts", expiration: { maxEntries: 12 } } }]
      }
    })
  ],
  server: { port: 5173 },
  build: { target: "es2022", chunkSizeWarningLimit: 900 }
});

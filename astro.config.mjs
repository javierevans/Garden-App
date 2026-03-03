import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import VitePWA from "@vite-pwa/astro";

export default defineConfig({
  integrations: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{html,js,css,svg,png,ico,json}"],
      },
      manifest: {
        name: "Garden Planner",
        short_name: "Garden",
        start_url: "/planner",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#16a34a",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["belly_chow_logo.png"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
      manifest: {
        name: "Belly-Chow — Campus Food Delivery",
        short_name: "Belly-Chow",
        description: "Order food from campus vendors. Fast delivery to your hostel or lecture hall.",
        theme_color: "#f97316",
        background_color: "#faf8f5",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/belly_chow_logo.png", sizes: "512x512", type: "image/png" },
          { src: "/belly_chow_logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

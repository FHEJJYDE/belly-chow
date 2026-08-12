import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover'],
          charts: ['recharts'],
          maps: ['leaflet', 'react-leaflet'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  plugins: [
    react(),
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
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        categories: ["food", "lifestyle"],
        shortcuts: [
          {
            name: "Orders",
            short_name: "Orders",
            description: "View your orders",
            url: "/orders",
            icons: [{ src: "/pwa-192.png", sizes: "192x192" }]
          },
          {
            name: "Notifications",
            short_name: "Alerts",
            description: "Check notifications",
            url: "/notifications",
            icons: [{ src: "/pwa-192.png", sizes: "192x192" }]
          }
        ]
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

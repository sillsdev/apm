import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3000,
    host: true,
  },
  optimizeDeps: {
    // Removed force: true to allow Vite to cache optimizations
    // This prevents re-optimization during test runs
  },
  plugins: [
    react(),
    // PWA support for the standalone web build ONLY. The Electron build uses the
    // separate root electron.vite.config.ts and never loads this file, so the
    // service worker is scoped to the web app and cannot affect desktop.
    VitePWA({
      // We register the SW ourselves in main.tsx so we can (a) skip Electron and
      // (b) surface a "reload to update" prompt instead of silently reloading.
      injectRegister: false,
      registerType: 'prompt',
      strategies: 'generateSW',
      workbox: {
        // Precache only the same-origin, content-hashed build shell. Auth0,
        // /api/* (Orbit JSON:API + the AmIOnline probe) and S3 media are NOT
        // listed here and have no runtimeCaching, so they always hit the network.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // The large, lazy-loaded per-language key-term dictionaries are fetched
        // on demand (network) today; keep them out of the install-time precache
        // so installing the PWA does not pull tens of MB of dictionaries.
        globIgnores: ['**/term*.js', '**/verseTerm-*.js'],
        // The main app bundle is a single large content-hashed chunk (~18 MB).
        // Raise the precache size limit so the app shell is precached; the hash
        // means a new deploy replaces it and cleanupOutdatedCaches removes the old.
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        // Serve the app shell for SPA navigations (createBrowserRouter), but never
        // hijack API requests — they must reach the network.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        // Prompt-to-reload flow: do not take over the page mid-session.
        clientsClaim: false,
        skipWaiting: false,
      },
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Audio Project Manager',
        short_name: 'APM',
        description: 'Audio Project Manager',
        // Pin the install identity so it stays stable if start_url ever moves.
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#1976d2',
        background_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            // Artwork sits inside the 80%-diameter safe circle, on an opaque
            // plate, so Android can crop it to any shape without clipping ink.
            purpose: 'maskable',
          },
          {
            // Preferred by installers that can rasterize at the exact size
            // they need; ignored by those that cannot.
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      // Do not run the SW under `npm start` / Cypress — avoids interfering with
      // the dev server and component tests.
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    rollupOptions: {
      // Suppress warnings about mixed static/dynamic imports for eng-vrs.ts
      // This module is intentionally both statically and dynamically imported
      onwarn(warning, warn) {
        if (
          warning.message &&
          warning.message.includes('eng-vrs') &&
          warning.message.includes('dynamically imported')
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
});

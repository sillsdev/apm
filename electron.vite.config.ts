import { resolve, isAbsolute } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: (id) => {
          // Don't externalize relative imports or absolute paths (local files)
          if (id.startsWith('.') || id.startsWith('/') || isAbsolute(id)) {
            return false;
          }
          // Explicitly externalize fs-extra and other transitive dependencies
          if (id === 'fs-extra') {
            return true;
          }
          // Externalize all other node_modules packages
          return true;
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        // `virtual:pwa-register` is provided by vite-plugin-pwa, which is only
        // wired into the web build (src/renderer/vite.config.ts). The shared
        // renderer source imports it in PwaUpdatePrompt.tsx, but that component
        // is mounted only on the web (see Root.tsx: `{!isElectron && ...}`), so
        // the import is never evaluated in Electron. Externalize it here so the
        // Electron build does not try (and fail) to resolve the virtual module.
        external: ['virtual:pwa-register'],
      },
    },
  },
});

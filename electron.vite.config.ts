import { resolve, isAbsolute } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// `virtual:pwa-register` is provided by vite-plugin-pwa, which is only wired
// into the web build (src/renderer/vite.config.ts). The shared renderer source
// imports it in PwaUpdatePrompt.tsx, but that component is mounted only on the
// web (see Root.tsx: `{!isElectron && ...}`), so the import is never evaluated
// in Electron. Stub the virtual module here so neither the dev server's import
// analysis nor the production build fails to resolve it.
const pwaRegisterStub = (): Plugin => ({
  name: 'pwa-register-stub',
  resolveId(id) {
    if (id === 'virtual:pwa-register') return '\0virtual:pwa-register';
  },
  load(id) {
    if (id === '\0virtual:pwa-register') {
      return 'export const registerSW = () => () => Promise.resolve();';
    }
  },
});

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
    plugins: [react(), pwaRegisterStub()],
  },
});

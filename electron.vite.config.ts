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
  },
});

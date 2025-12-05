import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3000,
    host: true,
  },
  plugins: [react()],
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

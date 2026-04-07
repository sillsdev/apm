/* eslint-disable @typescript-eslint/no-var-requires */
import { defineConfig } from 'cypress';
import { devServer } from '@cypress/vite-dev-server';
import { baseConfig } from './base.config';
import viteConfig from '../../vite.config';
import path from 'node:path';
import merge from 'lodash/merge';
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

// Merge the base vite config with test-specific overrides
const testViteConfig = {
  ...viteConfig,
  // Pre-bundle common CT deps so the first spec does not hit "optimized dependencies
  // changed, reloading" mid-run (which can flake the first assertion attempt).
  optimizeDeps: {
    ...viteConfig.optimizeDeps,
    include: [
      ...(Array.isArray(viteConfig.optimizeDeps?.include)
        ? viteConfig.optimizeDeps.include
        : []),
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@mui/material',
      '@mui/material/styles',
      '@mui/icons-material/PlayArrowOutlined',
      '@mui/icons-material/Pause',
      '@mui/icons-material/GetAppOutlined',
    ],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
    'process.env.FA_VERSION': JSON.stringify('test-version'),
  },
  resolve: {
    ...viteConfig.resolve,
    dedupe: ['react', 'react-dom'],
    alias: {
      ...viteConfig.resolve?.alias,
      // Break circular dependency: NavRoutes imports SwitchTeams, but we're testing SwitchTeams
      // Mock NavRoutes to prevent the circular dependency during component tests
      '../routes/NavRoutes': path.resolve(
        __dirname,
        '../../src/routes/__mocks__/NavRoutes.tsx'
      ),
      './routes/NavRoutes': path.resolve(
        __dirname,
        '../../src/routes/__mocks__/NavRoutes.tsx'
      ),
    },
  },
};

const config = {
  e2e: {
    env: {
      ENVIRONMENT: 'local',
    },
    baseUrl: 'http://localhost:3000', // can set to ${process.env.PORT} later
  },
  component: {
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    devServer(devServerConfig: Cypress.DevServerConfig) {
      return devServer({
        ...devServerConfig,
        framework: 'react',
        viteConfig: testViteConfig,
      });
    },
  },
};

export default defineConfig(merge({}, baseConfig, config));

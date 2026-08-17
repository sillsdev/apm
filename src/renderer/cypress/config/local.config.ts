import { defineConfig } from 'cypress';
import { devServer } from '@cypress/vite-dev-server';
import { baseConfig } from './base.config';
import viteConfig from '../../vite.config';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import merge from 'lodash/merge';

// Mirror Vite's env loading order: .env.local first, then .env.development.local overrides
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env.local') });
dotenv.config({
  path: path.resolve(__dirname, '..', '..', '.env.development.local'),
  override: true,
});
// Optional Cypress-only secrets (e.g. VITE_TEST_EMAIL1) — not overwritten by npm run devs
dotenv.config({ path: path.resolve(__dirname, '..', '.env.cypress.local') });

// Mirror the same source AuthApp.tsx uses
const auth0VarsPath = path.resolve(
  __dirname,
  '..',
  '..',
  'src',
  'auth',
  'auth0-variables.json'
);
const { auth0Domain, webClientId, apiIdentifier } = JSON.parse(
  fs.readFileSync(auth0VarsPath, 'utf-8')
);

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
  projectId: 'atwo4k',
  e2e: {
    baseUrl: 'http://localhost:3000',
    env: {
      auth0_domain: auth0Domain,
      auth0_client_id: webClientId,
      auth0_audience: apiIdentifier,
      auth0_scope: 'openid profile email',
      auth0_username: process.env.VITE_TEST_EMAIL1 ?? '',
      auth0_password: process.env.VITE_TEST_PW1 ?? '',
    },
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

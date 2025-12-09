/* eslint-disable @typescript-eslint/no-var-requires */
import { defineConfig } from 'cypress';
import { baseConfig } from './base.config';
import path from 'node:path';
import merge from 'lodash/merge';

const config = {
  e2e: {
    env: {
      ENVIRONMENT: 'ci',
    },
    baseUrl: 'http://localhost:3000',
  },
  component: {
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    devServer: {
      framework: 'react',
      bundler: 'vite',
      viteConfig: {
        server: {
          fs: {
            allow: ['..'],
          },
        },
        define: {
          'process.env.NODE_ENV': JSON.stringify('test'),
          'process.env.FA_VERSION': JSON.stringify('test-version'),
        },
        resolve: {
          alias: {
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
      },
    },
  },
};

export default defineConfig(merge({}, baseConfig, config));


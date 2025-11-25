/* eslint-disable @typescript-eslint/no-var-requires */
import { defineConfig } from 'cypress';
import { baseConfig } from './base.config';
import path from 'node:path';
import merge from 'lodash/merge';
import dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(__dirname, '../../.env'),
});

const config = {
  e2e: {
    env: {
      ENVIRONMENT: 'local',
    },
    baseUrl: 'http://localhost:3000', // can set to ${process.env.PORT} later
  },
  component: {
    experimentalJustInTimeCompile: true,
    specPattern: 'src/**/*.cy.{js,jsx,ts,tsx}',
    devServer: {
      framework: 'react',
      bundler: 'vite',
      viteConfig: {
        define: {
          'process.env.NODE_ENV': JSON.stringify('test'),
          'process.env.FA_VERSION': JSON.stringify('test-version'),
        },
      },
    },
  },
};

export default defineConfig(merge({}, baseConfig, config));

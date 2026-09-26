import { defineConfig } from 'cypress';
import { devServer } from '@cypress/vite-dev-server';
import { baseConfig } from './base.config';
import tasks from '../support/tasks';
import muteBrowserAudio from '../support/muteBrowserAudio';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cypressGrepPlugin = require('@cypress/grep/src/plugin');
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
const { port: _appPort, ...viteServerRest } = viteConfig.server ?? {};
const testViteConfig = {
  ...viteConfig,
  // App `npm start` owns 3000. Prefer 5199 so we are not Vite's 5173 (a
  // leftover CT often stays on [::1]:5173). strictPort is off so a TIME_WAIT
  // on 5199 makes Vite take 5200; Cypress uses the port listen() actually bound.
  server: {
    ...viteServerRest,
    port: 5199,
    strictPort: false,
    warmup: {
      clientFiles: [
        path.resolve(__dirname, '../support/component.tsx'),
        path.resolve(__dirname, '../support/pbtHarness.tsx'),
        path.resolve(
          __dirname,
          '../../src/components/MediaRecord.recording.cy.tsx'
        ),
        path.resolve(
          __dirname,
          '../../src/components/PassageDetail/PassageDetailPhraseBackTranslate.cy.tsx'
        ),
        path.resolve(
          __dirname,
          '../../src/components/PassageDetail/PassageDetailPhraseBackTranslate.playback.cy.tsx'
        ),
      ],
    },
  },
  plugins: [
    ...(Array.isArray(viteConfig.plugins) ? viteConfig.plugins : []),
    {
      name: 'apm-ct-listen-all-interfaces',
      // Cypress mergeConfig forces host 127.0.0.1 (IPv4 only). Chrome loads
      // `http://localhost:...` which is ::1 on Windows, so the spec import
      // fails with Failed to fetch. Listen on IPv6 (dual-stack) as well.
      config() {
        return { server: { host: '::' } };
      },
    },
    {
      name: 'apm-ct-no-full-reload',
      configureServer(server: {
        ws: { send: (...args: unknown[]) => unknown };
      }) {
        const send = server.ws.send.bind(server.ws);
        server.ws.send = (...args: unknown[]) => {
          const payload = args[0] as { type?: string } | undefined;
          if (payload?.type === 'full-reload') return;
          return send(...args);
        };
      },
    },
  ],
  // Pre-bundle common CT deps so the first spec does not hit "optimized dependencies
  // changed, reloading" mid-run (which can flake the first assertion attempt).
  // Pre-bundle CT deps so no spec hits "optimized dependencies changed,
  // reloading" mid-run. That reload is not just slow: it leaves the AUT with
  // two copies of React ("Cannot read properties of null (reading 'useMemo')"
  // inside ThemeProvider), so the spec that triggers it fails outright.
  //
  // This list has to cover every dep the *whole* run touches, not just the
  // common ones — Vite discovers the rest lazily, one spec at a time, and each
  // discovery is another reload. A hand-written list of the obvious ones is
  // what made a separate whole-suite warm-up run necessary.
  //
  // ct-optimize-deps.json is generated from a completed run's dep cache:
  //   node env-config/ctOptimizeDeps.cjs --write
  // Regenerate it if flaky "reloading"-related failures reappear after adding
  // a dependency. See env-config/ctOptimizeDeps.cjs.
  optimizeDeps: {
    ...viteConfig.optimizeDeps,
    // Do not hold the first spec import until crawl-end — Chrome times out
    // ("Failed to fetch dynamically imported module"). Allow discovery so CJS
    // packages (lodash, react-is, …) still get pre-bundled; swallow outdated
    // requests so a mid-run optimize does not abort the next spec import.
    holdUntilCrawlEnd: false,
    ignoreOutdatedRequests: true,
    entries: [
      path.resolve(__dirname, '../support/component.tsx'),
      path.resolve(__dirname, '../support/pbtHarness.tsx'),
    ],
    include: [
      ...(Array.isArray(viteConfig.optimizeDeps?.include)
        ? viteConfig.optimizeDeps.include
        : []),
      ...(JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, 'ct-optimize-deps.json'),
          'utf-8'
        )
      ) as string[]),
    ],
  },
  // Component tests and the app dev server run different vite configs. Sharing
  // the default node_modules/.vite cache makes each invalidate the other's
  // optimized deps, so a CT run and `npm run devs` in the same worktree keep
  // knocking each other into a reload. Give CT its own cache.
  cacheDir: path.resolve(__dirname, '../../node_modules/.vite-ct'),
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
    // Component specs get the same node tasks as e2e (notably cy.task('log'),
    // the only way to surface browser-side detail in `cypress run` output).
    setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions
    ) {
      tasks(on);
      // Recording specs play real audio; keep the run silent.
      muteBrowserAudio(on);
      // @cypress/grep's browser side is registered in support/commands.ts; this
      // is its plugin half, which implements `grepFilterSpecs`.
      //
      // Note: in Cypress 15 component mode the rewritten specPattern this
      // returns is ignored — the runner has already resolved the spec list by
      // the time setupNodeEvents runs, so all specs load even when none of
      // their tests match. That costs ~9s of fixed per-spec overhead each
      // (browser + bundle), which is why cy:run-ct-smoke selects files with
      // --spec instead and leaves grepTags to filter *within* those files.
      // Left registered because it does work for --e2e.
      return cypressGrepPlugin(config);
    },
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

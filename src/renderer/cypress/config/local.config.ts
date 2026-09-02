import { defineConfig } from 'cypress';
import { devServer } from '@cypress/vite-dev-server';
import { baseConfig } from './base.config';
import tasks from '../support/tasks';
import muteBrowserAudio from '../support/muteBrowserAudio';
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
      'react',
      'react-dom',
      'react/jsx-runtime',
      'cypress/react',
      '@cypress/grep',
      '@mui/material',
      '@mui/material/styles',
      '@mui/icons-material/PlayArrowOutlined',
      '@mui/icons-material/PlayArrow',
      '@mui/icons-material/Pause',
      '@mui/icons-material/Stop',
      '@mui/icons-material/GetAppOutlined',
      '@mui/icons-material/ChevronLeft',
      '@mui/icons-material/Loop',
      '@mui/icons-material/ArrowRightAlt',
      '@mui/icons-material/AccessTime',
      '@mui/icons-material/Undo',
      '@mui/icons-material/SettingsVoice',
      '@mui/icons-material/MoreVert',
      '@mui/icons-material/Settings',
      '@mui/icons-material/List',
      '@mui/icons-material/DeleteOutline',
      '@mui/icons-material/CloudUpload',
      '@bugsnag/js',
      '@bugsnag/plugin-react',
      // Deep-mount harnesses (e.g. cypress/support/pbtHarness.tsx) bring the
      // store and Orbit in. Without these, the first spec that imports one
      // triggers a mid-run re-optimize, and the reload that follows leaves the
      // AUT with two copies of React ("Cannot read properties of null
      // (reading 'useMemo')" inside ThemeProvider).
      'react-redux',
      'redux',
      'redux-thunk',
      'lodash',
      'react-is',
      '@orbit/memory',
      '@orbit/records',
      '@orbit/coordinator',
      '@orbit/indexeddb',
      '@orbit/jsonapi',
      'wavesurfer.js',
      'wavesurfer.js/dist/plugins/regions',
      'wavesurfer.js/dist/plugins/timeline',
      'wavesurfer.js/dist/plugins/zoom',
      '@wavesurfer/react',
      // Captured from a CT run: "new dependencies optimized" during the first
      // spec import. If these are only discovered then, Vite reloads and Chrome
      // reports Failed to fetch dynamically imported module.
      'react-router-dom',
      'react-localization',
      '@redux-devtools/extension',
      '@mui/icons-material/Replay',
      '@mui/icons-material/SkipPrevious',
      '@mui/icons-material/Close',
      '@mui/material/Alert',
      '@mui/material/DialogActions',
      'luxon',
      'path-browserify',
      'react-icons/fa',
      '@orbit/core',
      '@mui/x-data-grid/locales',
      'mui-language-picker',
      'axios',
      '@mui/icons-material/CheckBoxOutlineBlank',
      '@mui/icons-material/CheckBoxOutlined',
      '@mui/icons-material/Delete',
      '@mui/icons-material/Edit',
      '@fingerprintjs/fingerprintjs',
      'react-icons/io',
      '@mui/icons-material/Remove',
      '@mui/icons-material/Add',
      '@mui/icons-material/ZoomIn',
      '@mui/icons-material/ZoomOut',
      '@mui/icons-material/Pageview',
      'url-parse',
      'process',
      '@mui/icons-material/Visibility',
      '@auth0/auth0-react',
      'jwt-decode',
      '@mui/material/Paper',
      'react-draggable',
      '@mui/icons-material/ArrowDropDown',
      '@mui/material/TextField',
      '@mui/material/Autocomplete',
      '@mui/icons-material/SupportAgent',
      '@mui/material/Dialog',
      '@mui/material/DialogTitle',
      '@mui/material/DialogContent',
      '@mui/icons-material/Info',
      '@orbit/indexeddb-bucket',
      '@mui/icons-material/NavigateBefore',
      '@mui/icons-material/NavigateNext',
      '@mui/x-data-grid',
      '@orbit/serializers',
      '@mui/icons-material/ExpandMore',
      '@mui/icons-material/Sync',
      '@mui/icons-material/Check',
      'browser-image-compression',
      '@mui/material/Box',
      '@fortawesome/free-solid-svg-icons',
      '@fortawesome/free-regular-svg-icons',
      '@fortawesome/react-fontawesome',
      '@mui/icons-material/VisibilityOff',
      'array-move',
      'react-file-drop',
      '@xmldom/xmldom',
      'xpath',
      '@hello-pangea/dnd',
      '@mui/icons-material/DragIndicator',
      '@mui/icons-material/ChevronRight',
      '@mui/icons-material/ExpandLess',
      'jszip',
      '@mui/x-tree-view',
      '@mui/icons-material/RemoveRedEye',
      '@mui/icons-material/CheckBoxOutlineBlankOutlined',
      '@mui/icons-material/ContentCopy',
      '@mui/icons-material/Link',
      'react-markdown',
      'remark-gfm',
      'usfm-grammar-web/dist/bundle.mjs',
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
      return config;
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

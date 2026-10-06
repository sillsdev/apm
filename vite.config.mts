import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import electron from 'vite-plugin-electron/simple';
import react from '@vitejs/plugin-react';

// Electron app build. The renderer source lives in the web package (./web),
// which also builds standalone for the web with its own web/vite.config.ts.
const repoRoot = import.meta.dirname;
const webRoot = path.join(repoRoot, 'web');

// `virtual:pwa-register` is provided by vite-plugin-pwa, which is only wired
// into the web build (web/vite.config.ts). The shared renderer source imports
// it in PwaUpdatePrompt.tsx, but that component is mounted only on the web
// (see Root.tsx: `{!isElectron && ...}`), so the import is never evaluated in
// Electron. Stub the virtual module here so neither the dev server's import
// analysis nor the production build fails to resolve it.
const pwaRegisterStub = (): Plugin => ({
  name: 'pwa-register-stub',
  resolveId(id) {
    if (id === 'virtual:pwa-register') return '\0virtual:pwa-register';
    return undefined;
  },
  load(id) {
    if (id === '\0virtual:pwa-register') {
      return 'export const registerSW = () => () => Promise.resolve();';
    }
    return undefined;
  },
});

// Main-process dependencies are loaded from node_modules at runtime (keytar is
// native; ffmpeg-static/ffprobe-static resolve binaries next to themselves), so
// bundle only local files and externalize every package import.
const externalizePackages = (id: string): boolean =>
  !(id.startsWith('.') || id.startsWith('/') || path.isAbsolute(id));

// main/preload are built in their own Vite instances; pin them to the repo
// root so their output lands in <repo>/dist-electron, not <repo>/web.
const electronBuild = {
  root: repoRoot,
  build: {
    outDir: path.join(repoRoot, 'dist-electron'),
    rollupOptions: { external: externalizePackages },
  },
};

export default defineConfig({
  root: webRoot,
  envDir: webRoot,
  publicDir: path.join(webRoot, 'public'),
  server: {
    port: 3000,
  },
  build: {
    outDir: path.join(repoRoot, 'dist'),
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        // Rolldown splits the renderer into chunks that import each other
        // (e.g. utils <-> StyledBox). Without this, a chunk can call a
        // CommonJS wrapper (React's) from another chunk before that chunk's
        // body has run: "Uncaught TypeError: So is not a function".
        strictExecutionOrder: true,
      },
      // eng-vrs.ts is intentionally both statically and dynamically imported.
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
  plugins: [
    react(),
    pwaRegisterStub(),
    electron({
      main: {
        // Object form names the output dist-electron/main.js.
        entry: { main: path.join(repoRoot, 'electron/main/index.ts') },
        vite: electronBuild,
        // launch.json sets REMOTE_DEBUGGING_PORT; the plugin ignores it.
        // js-debug also injects NODE_OPTIONS into this process. Electron
        // inherits that bootloader and pauses before the window stays up.
        onstart({ startup }) {
          const port = process.env.REMOTE_DEBUGGING_PORT;
          const env = { ...process.env };
          delete env.NODE_OPTIONS;
          delete env.VSCODE_INSPECTOR_OPTIONS;
          const argv = ['.', '--no-sandbox'];
          if (port) argv.push(`--remote-debugging-port=${port}`);
          return startup(argv, { env });
        },
      },
      preload: {
        input: { preload: path.join(repoRoot, 'electron/preload/index.ts') },
        vite: electronBuild,
      },
    }),
  ],
});

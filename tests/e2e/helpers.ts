import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';

// The built main-process entry. Run `npm run build` before the e2e suite.
export const MAIN_JS = path.join(__dirname, '../../out/main/index.js');

/**
 * Env to hand the launched app.
 *
 * `ELECTRON_RUN_AS_NODE` makes the Electron binary boot as plain Node, so
 * `require('electron').app` is undefined and the app crashes on startup with
 * "Process failed to launch!". Strip it so the test is robust regardless of
 * whatever the surrounding shell exported.
 */
export function launchEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') env[k] = v;
  }
  return env;
}

export interface LaunchedApp {
  app: ElectronApplication;
  profileDir: string;
}

/**
 * Launch the built Electron app with an isolated Chromium profile.
 *
 * A fresh `--user-data-dir` gives two things:
 *  - Deterministic start at the Welcome screen (no localStorage/IndexedDB
 *    carried over from a previous run that would skip straight past it).
 *  - No mutation of the developer's real APM profile.
 *
 * Note: the Auth0 refresh token lives in the OS keychain (keytar), which is
 * NOT isolated by the profile dir. So whether login takes the silent-refresh
 * path or the interactive Auth0 path depends on the keychain, and the caller
 * must handle both.
 */
export async function launchApp(): Promise<LaunchedApp> {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'apm-e2e-'));
  const app = await electron.launch({
    args: [MAIN_JS, `--user-data-dir=${profileDir}`],
    env: launchEnv(),
  });
  return { app, profileDir };
}

export async function closeApp({ app, profileDir }: LaunchedApp): Promise<void> {
  await app.close().catch(() => {});
  fs.rmSync(profileDir, { recursive: true, force: true });
}

// The app opens several BrowserWindows: the renderer (file://…index.html), a
// detached DevTools window (devtools://…) because the unpackaged build runs in
// dev mode, and — during interactive login — the Auth0 window (https://…auth0.com).
// `firstWindow()` can return the DevTools window, so always select by URL.
export const isRenderer = (p: Page): boolean => p.url().includes('index.html');
export const isAuth0 = (p: Page): boolean => p.url().includes('auth0.com');

/** Poll the app's live windows for the first one matching `pred`. */
export async function waitForWindow(
  app: ElectronApplication,
  pred: (p: Page) => boolean,
  timeoutMs = 40_000
): Promise<Page | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const win = app.windows().find((p) => pred(p) && !p.isClosed());
    if (win) return win;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
}

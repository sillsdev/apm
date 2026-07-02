import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
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

export async function closeApp({
  app,
  profileDir,
}: LaunchedApp): Promise<void> {
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

/**
 * Drive the app from the fresh Welcome screen through to an authenticated
 * renderer window landing on the team/projects screen. Handles both the
 * silent-refresh (keychain token present) and interactive Auth0 login paths.
 */
export async function loginToTeamScreen(
  launched: LaunchedApp,
  credentials: { username: string; password: string }
): Promise<Page> {
  const { app } = launched;

  const welcome = await waitForWindow(app, isRenderer, 30_000);
  if (!welcome) throw new Error('renderer window should open');
  await welcome.waitForLoadState('domcontentloaded');

  await welcome
    .locator('#adminonline')
    .waitFor({ state: 'visible', timeout: 25_000 });
  // Clear a leftover re-login guard so the Access auto-login effect runs.
  await welcome.evaluate(() => localStorage.removeItem('goingOnline'));
  await welcome.locator('#adminonline').click();

  // ipc.login() in the main process does one of two things, both of which
  // close the current renderer and produce a new window:
  //   (a) keychain refresh token present -> createWindow() -> authed renderer
  //   (b) no token -> createAuthWindow() -> Auth0 login window
  // Race the two outcomes.
  let auth0: Page | null = null;
  let authed: Page | null = null;
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline && !auth0 && !authed) {
    auth0 = app.windows().find((p) => isAuth0(p) && !p.isClosed()) ?? null;
    authed =
      app
        .windows()
        .find((p) => isRenderer(p) && p !== welcome && !p.isClosed()) ?? null;
    if (!auth0 && !authed) await new Promise((r) => setTimeout(r, 250));
  }

  if (auth0) {
    if (!(credentials.username && credentials.password)) {
      throw new Error(
        'VITE_TEST_EMAIL1 / VITE_TEST_PW1 must be set in src/renderer/.env*.local ' +
          'to drive interactive Auth0 login'
      );
    }

    await auth0.waitForLoadState('domcontentloaded').catch(() => {});

    // A fresh --user-data-dir profile looks "unused" to the main process,
    // which defaults the Auth0 Universal Login page to the Sign Up tab
    // (src/main/auth-service.ts's getAuthenticationURL adds
    // login_hint=signUp for a never-used profile on a -dev tenant). Switch
    // to Log In before filling in credentials for an existing test account.
    // No-op if the tab isn't present (e.g. a reused/non-fresh profile).
    await auth0
      .getByRole('link', { name: 'Log In' })
      .click({ timeout: 10_000 })
      .catch(() => {});

    const userField = auth0
      .locator('input[name="username"], input[name="email"]')
      .first();
    await userField.waitFor({ state: 'visible', timeout: 20_000 });
    await userField.fill(credentials.username);
    await auth0.locator('input[name="password"]').fill(credentials.password);
    await auth0.locator('button[type="submit"]').click();

    // After the callback is intercepted, the main process creates the
    // authenticated renderer window.
    authed = await waitForWindow(
      app,
      (p) => isRenderer(p) && p !== welcome && !p.isClosed(),
      40_000
    );
  }

  if (!authed) {
    throw new Error('an authenticated renderer window should open after login');
  }

  // A confirm dialog can pop during data load; auto-dismiss so it can't block.
  authed.on('dialog', (d) => d.dismiss().catch(() => {}));

  return authed;
}

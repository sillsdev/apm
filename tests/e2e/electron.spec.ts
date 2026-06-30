import { test, expect, Page } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
import {
  launchApp,
  closeApp,
  isRenderer,
  isAuth0,
  waitForWindow,
  LaunchedApp,
} from './helpers';

// Mirror Vite's env loading order, same as src/renderer/cypress/config/local.config.ts.
dotenv.config({ path: path.join(__dirname, '../../src/renderer/.env.local') });
dotenv.config({
  path: path.join(__dirname, '../../src/renderer/.env.development.local'),
  override: true,
});

const TEST_USERNAME = process.env.VITE_TEST_EMAIL1 ?? '';
const TEST_PASSWORD = process.env.VITE_TEST_PW1 ?? '';

test.describe('APM desktop e2e sanity check', () => {
  let launched: LaunchedApp;

  test.beforeEach(async () => {
    launched = await launchApp();
  });

  test.afterEach(async () => {
    if (launched) await closeApp(launched);
  });

  test('launches, signs in, and shows Personal Audio Projects', async () => {
    const { app } = launched;

    // 1. Grab the renderer window (NOT firstWindow() — that can be DevTools).
    const welcome = await waitForWindow(app, isRenderer, 30_000);
    expect(welcome, 'renderer window should open').toBeTruthy();
    await welcome!.waitForLoadState('domcontentloaded');

    // 2. Fresh profile starts on the Welcome screen. Click "Work Online"
    //    (#adminonline). That routes to /access/online-cloud, where the Access
    //    component auto-invokes ipc.login().
    await welcome!
      .locator('#adminonline')
      .waitFor({ state: 'visible', timeout: 25_000 });
    // Clear a leftover re-login guard so the Access auto-login effect runs.
    await welcome!.evaluate(() => localStorage.removeItem('goingOnline'));
    await welcome!.locator('#adminonline').click();

    // 3. ipc.login() in the main process does one of two things, both of which
    //    close the current renderer and produce a new window:
    //      (a) keychain refresh token present -> createWindow() -> authed renderer
    //      (b) no token -> createAuthWindow() -> Auth0 login window
    //    Race the two outcomes.
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

    // 4. Interactive Auth0 path: fill the Universal Login form. Selectors match
    //    src/renderer/cypress/support/commands.ts (loginByAuth0).
    if (auth0) {
      expect(
        TEST_USERNAME && TEST_PASSWORD,
        'VITE_TEST_EMAIL1 / VITE_TEST_PW1 must be set in src/renderer/.env*.local ' +
          'to drive interactive Auth0 login'
      ).toBeTruthy();

      await auth0.waitForLoadState('domcontentloaded').catch(() => {});
      const userField = auth0
        .locator('input[name="username"], input[name="email"]')
        .first();
      await userField.waitFor({ state: 'visible', timeout: 20_000 });
      await userField.fill(TEST_USERNAME);
      await auth0.locator('input[name="password"]').fill(TEST_PASSWORD);
      await auth0.locator('button[type="submit"]').click();

      // After the callback is intercepted, the main process creates the
      // authenticated renderer window.
      authed = await waitForWindow(
        app,
        (p) => isRenderer(p) && p !== welcome && !p.isClosed(),
        40_000
      );
    }

    expect(
      authed,
      'an authenticated renderer window should open after login'
    ).toBeTruthy();

    // A confirm dialog can pop during data load; auto-dismiss so it can't block.
    authed!.on('dialog', (d) => d.dismiss().catch(() => {}));

    // 5. The authed renderer transitions /loading -> /team. Assert the personal
    //    projects header renders (auto-waits through the loading screen).
    await expect(
      authed!.getByText('Personal Audio Projects')
    ).toBeVisible({ timeout: 60_000 });

    // 6. Sanity-check the main process is reachable (mirrors the sample's
    //    electronApp.evaluate step).
    const appPath = await app.evaluate(({ app }) => app.getAppPath());
    expect(appPath.length).toBeGreaterThan(0);
  });

  test('exposes the app path from the main process', async () => {
    const { app } = launched;
    const appPath = await app.evaluate(({ app }) => app.getAppPath());
    expect(typeof appPath).toBe('string');
    expect(appPath.length).toBeGreaterThan(0);
  });
});

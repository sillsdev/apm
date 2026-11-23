import { test, expect, Page } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
import {
  launchApp,
  closeApp,
  loginToTeamScreen,
  waitForOrbitQueueEmpty,
  getRemoteQueueLength,
  deleteTeamIfExists,
  isRenderer,
  LaunchedApp,
} from './helpers';

// Mirror Vite's env loading order, same as electron.spec.ts.
dotenv.config({ path: path.join(__dirname, '../../web/.env.local') });
dotenv.config({
  path: path.join(__dirname, '../../web/.env.development.local'),
  override: true,
});

const credentials = {
  username: process.env.VITE_TEST_EMAIL1 ?? '',
  password: process.env.VITE_TEST_PW1 ?? '',
};
const API_HOST = (process.env.VITE_HOST ?? '').replace(/\/$/, '');
const stamp = Date.now().toString(36);
const ORIGINAL_NAME = `TT-7905 ${stamp}`;
const RENAMED = `TT-7905 renamed ${stamp}`;

const teamCard = (page: Page, name: string) =>
  page.locator('#TeamItem').filter({ hasText: name });

async function renameTeam(page: Page, from: string, to: string) {
  await teamCard(page, from).locator('#teamSettings').click();
  await page.locator('#teamDialog').waitFor({ state: 'visible' });
  await page.locator('#teamName').fill(to);
  await page.locator('#teamCommit').click();
  await page.locator('#teamDialog').waitFor({ state: 'hidden' });
}

/**
 * Restarting the same profile can land on the Welcome screen (click Online,
 * keychain refresh) or go straight to the team screen. Handle both.
 */
async function reopenToTeamScreen(launched: LaunchedApp): Promise<Page> {
  // The Welcome window may auto-login and close itself, so poll every
  // renderer window rather than holding on to the first one.
  const deadline = Date.now() + 120_000;
  let welcomeSince = 0;
  while (Date.now() < deadline) {
    for (const p of launched.app.windows()) {
      if (p.isClosed() || !isRenderer(p)) continue;
      const onTeam = await p
        .getByText('Personal Audio Projects')
        .isVisible()
        .catch(() => false);
      if (onTeam) {
        p.on('dialog', (d) => d.dismiss().catch(() => {}));
        return p;
      }
      const onWelcome = await p
        .locator('#adminonline')
        .isVisible()
        .catch(() => false);
      if (onWelcome) {
        welcomeSince ||= Date.now();
        // Still on Welcome after 10s: no auto-login, click Online ourselves.
        if (Date.now() - welcomeSince > 10_000) {
          await p
            .locator('#adminonline')
            .click()
            .catch(() => {});
          welcomeSince = Date.now();
        }
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('team screen should appear after restart');
}

test.describe('TT-7905 desktop keeps queued offline edits across restart', () => {
  test.afterAll(async () => {
    test.setTimeout(180_000);
    await deleteTeamIfExists(RENAMED, credentials);
    await deleteTeamIfExists(ORIGINAL_NAME, credentials);
  });

  test('an edit queued while the network is down reaches the server after restart', async () => {
    test.setTimeout(480_000);
    expect(API_HOST, 'VITE_HOST must be set').not.toBe('');

    // 1. Online: create a team to edit.
    let launched = await launchApp();
    const profileDir = launched.profileDir;
    try {
      const page = await loginToTeamScreen(launched, credentials);
      await expect(page.getByText('Personal Audio Projects')).toBeVisible({
        timeout: 60_000,
      });
      await page.locator('#TeamActAdd').click();
      await page.locator('#teamDialog').waitFor({ state: 'visible' });
      await page.locator('#teamName').fill(ORIGINAL_NAME);
      await page.locator('#teamCommit').click();
      await teamCard(page, ORIGINAL_NAME).waitFor({
        state: 'visible',
        timeout: 60_000,
      });
      await waitForOrbitQueueEmpty(page, 'remote', 90_000);

      // 2. Cut the network to the API, then rename. The rename is one
      //    queued Orbit transform that cannot reach the server.
      const blocked: string[] = [];
      // Session-level emulation stays in force through the app's quit flow;
      // page.route alone is torn down at close and lets the drain through.
      await launched.app.evaluate(({ session }) =>
        session.defaultSession.enableNetworkEmulation({ offline: true })
      );
      await page.route(`${API_HOST}/**`, (route) => {
        blocked.push(`${route.request().method()} ${route.request().url()}`);
        return route.abort('internetdisconnected');
      });
      await renameTeam(page, ORIGINAL_NAME, RENAMED);
      await expect
        .poll(() => getRemoteQueueLength(page), { timeout: 15_000 })
        .toBeGreaterThan(0);
      // The rename must actually have been refused, not just in flight.
      await expect
        .poll(() => blocked.some((b) => /^PATCH .*organizations/.test(b)), {
          timeout: 15_000,
        })
        .toBe(true);

      // 3. Quit while still offline -- well inside updateError's ~75s retry
      //    window, so the queued task is still persisted.
    } finally {
      await closeApp(launched, { keepProfile: true });
    }

    // 4. Restart the same install online. Before TT-7905 this start skipped
    //    the head of the queue, which here is the rename.
    launched = await launchApp(profileDir);
    // The old startup skip only lost the edit when it landed before the head
    // task was sent. Fail the first replayed PATCH once so the task sits in
    // its retry delay while startup runs, which is that window.
    let failedOnce = false;
    await launched.app.context().route(`${API_HOST}/**`, (route) => {
      const r = route.request();
      if (
        !failedOnce &&
        r.method() === 'PATCH' &&
        /organizations/.test(r.url())
      ) {
        failedOnce = true;
        return route.abort('internetdisconnected');
      }
      return route.continue();
    });
    try {
      const page = await reopenToTeamScreen(launched);
      await waitForOrbitQueueEmpty(page, 'remote', 120_000);
      await waitForOrbitQueueEmpty(page, 'datachanges', 60_000);
      expect(failedOnce, 'the queued rename should replay at startup').toBe(
        true
      );
    } finally {
      await closeApp(launched);
    }

    // 5. A fresh profile loads from the server: the rename must be there.
    const fresh = await launchApp();
    try {
      const page = await loginToTeamScreen(fresh, credentials);
      await expect(page.getByText('Personal Audio Projects')).toBeVisible({
        timeout: 60_000,
      });
      await expect(teamCard(page, RENAMED)).toBeVisible({ timeout: 60_000 });
      await expect(teamCard(page, ORIGINAL_NAME)).toHaveCount(0);
    } finally {
      await closeApp(fresh);
    }
  });
});

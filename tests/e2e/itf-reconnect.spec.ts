import { test, expect, Page, Request } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
import {
  launchApp,
  closeApp,
  loginToTeamScreen,
  waitForOrbitQueueEmpty,
  getRemoteQueueLength,
  deleteTeamIfExists,
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
const TEAM = `TT-7911 ${stamp}`;
const TEAM_RENAMED = `TT-7911 renamed ${stamp}`;
const PROJECT = `Itf ${stamp}`;
const PROJECT_RENAMED = `Itf renamed ${stamp}`;

const teamCard = (page: Page, name: string) =>
  page.locator('#TeamItem').filter({ hasText: name });

async function renameTeam(page: Page, from: string, to: string) {
  await teamCard(page, from).locator('#teamSettings').click();
  await page.locator('#teamDialog').waitFor({ state: 'visible' });
  await page.locator('#teamName').fill(to);
  await page.locator('#teamCommit').click();
  await page.locator('#teamDialog').waitFor({ state: 'hidden' });
}

/** Same steps as electron.spec.ts: a scripture project with one passage. */
async function createProjectWithPassage(page: Page) {
  await teamCard(page, TEAM).locator('[id^="teamAdd-"]').click();
  await page.locator('#projectSettings').waitFor({ state: 'visible' });
  await page.locator('#project-name').fill(PROJECT);
  await page.getByRole('radio', { name: 'Scripture' }).click();
  await page.locator('#lang-bcp47').click();
  const languagePicker = page.locator('#LanguagePicker');
  await languagePicker.waitFor({ state: 'visible' });
  await languagePicker.locator('#language').fill('en');
  await languagePicker
    .getByRole('button', { name: /^English/ })
    .first()
    .click();
  await languagePicker.getByRole('button', { name: 'Save' }).click();
  await languagePicker.waitFor({ state: 'hidden' });
  await page.locator('#primaryAction').click();

  await page
    .locator('#planSheetAddSec')
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('#planSheetAddSec').click();
  await page.locator('#secEnd').click();
  const bookCell = page.locator('td.book.pass').first();
  await bookCell.waitFor({ state: 'visible', timeout: 10_000 });
  await bookCell.dblclick();
  await page.waitForTimeout(300);
  await page.keyboard.type('g');
  await page.waitForTimeout(300);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  await page.keyboard.type('1:1');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  const saveButton = page.locator('#planSheetSave');
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  await saveButton.click();
  await waitForOrbitQueueEmpty(page, 'remote', 60_000);
}

async function renameProject(page: Page, to: string) {
  const card = teamCard(page, TEAM_RENAMED);
  await card.locator('#projectMenu').first().click();
  await page.locator('#projMenuSettings:visible').click();
  await page.locator('#projectSettings').waitFor({ state: 'visible' });
  await page.locator('#project-name').fill(to);
  await page.locator('#primaryAction').click();
  await page.locator('#projectSettings').waitFor({ state: 'hidden' });
}

const needItfSyncFlag = (page: Page) =>
  page.evaluate(() => localStorage.getItem('needItfSync'));

test.describe('TT-7911 desktop sends an ITF when the connection comes back', () => {
  test.afterAll(async () => {
    test.setTimeout(240_000);
    await deleteTeamIfExists(TEAM_RENAMED, credentials);
    await deleteTeamIfExists(TEAM, credentials);
  });

  test('offline edits reach the server through an ITF on reconnect, without a restart', async () => {
    test.setTimeout(600_000);
    expect(API_HOST, 'VITE_HOST must be set').not.toBe('');

    let launched: LaunchedApp = await launchApp();
    try {
      const page = await loginToTeamScreen(launched, credentials);
      await expect(page.getByText('Personal Audio Projects')).toBeVisible({
        timeout: 60_000,
      });

      // 1. Online: a team with a project (offline-available on desktop) and
      //    a saved passage, so the ITF has changes to carry.
      await page.locator('#TeamActAdd').click();
      await page.locator('#teamDialog').waitFor({ state: 'visible' });
      await page.locator('#teamName').fill(TEAM);
      await page.locator('#teamCommit').click();
      await teamCard(page, TEAM).waitFor({ state: 'visible', timeout: 60_000 });
      await waitForOrbitQueueEmpty(page, 'remote', 90_000);
      await createProjectWithPassage(page);
      await page.getByRole('button', { name: 'Home' }).first().click();
      await teamCard(page, TEAM).waitFor({ state: 'visible', timeout: 30_000 });
      expect(await needItfSyncFlag(page)).toBeNull();

      // 2. The network drops. Session-level emulation plus page.route, as in
      //    queue-restart.spec.ts.
      await launched.app.evaluate(({ session }) =>
        session.defaultSession.enableNetworkEmulation({ offline: true })
      );
      await page.route(`${API_HOST}/**`, (route) =>
        route.abort('internetdisconnected')
      );
      const browserOnLine = await page.evaluate(() => navigator.onLine);
      console.log(`navigator.onLine while emulated offline: ${browserOnLine}`);

      // 3. Edit while the network is down: a team rename (not carried by an
      //    ITF) and a project rename (carried by an ITF).
      await renameTeam(page, TEAM, TEAM_RENAMED);
      await renameProject(page, PROJECT_RENAMED);
      await expect
        .poll(() => getRemoteQueueLength(page), { timeout: 15_000 })
        .toBeGreaterThan(0);

      // 4. Nobody switches to offline mode. The app notices the drop itself:
      //    DataChanges.updateBusy polls useCheckOnline every 5s while the
      //    queue is not empty; AmIOnline fails, `connected` goes true→false,
      //    and markNeedItfSyncOnDisconnect sets needItfSync (TT-7905).
      await expect
        .poll(() => needItfSyncFlag(page), { timeout: 60_000 })
        .toBe('true');

      // 5. The network comes back. Record what the app sends from here on.
      const sent: string[] = [];
      const onRequest = (r: Request) => {
        if (r.url().startsWith(API_HOST))
          sent.push(`${r.method()} ${r.url().slice(API_HOST.length)}`);
      };
      page.on('request', onRequest);
      // navigator.onLine stays true under session emulation, so updateError
      // keeps a retry timer running for the failed edit. Until the reconnect
      // is noticed, a timer firing now would send the edit directly (the old
      // replay). Keep edits refused until the ITF has taken the queue, so
      // this test measures the ITF path, not that race.
      let refused = 0;
      await page.unroute(`${API_HOST}/**`);
      await page.route(`${API_HOST}/**`, (route) => {
        if (route.request().method() === 'PATCH') {
          refused += 1;
          return route.abort('internetdisconnected');
        }
        return route.continue();
      });
      await launched.app.evaluate(({ session }) =>
        session.defaultSession.enableNetworkEmulation({ offline: false })
      );

      // 6. The ITF runs in this session: progress, then success.
      const status = page.locator('#itfReconnectStatus');
      await expect(status).toBeVisible({ timeout: 60_000 });
      await page.unroute(`${API_HOST}/**`);
      console.log(`PATCHes refused before the ITF started: ${refused}`);
      // The PATCHes refused above never reached the server.
      sent.splice(
        0,
        sent.length,
        ...sent.filter((s) => !s.startsWith('PATCH '))
      );
      await expect(status).toContainText('have been sent', {
        timeout: 180_000,
      });
      await waitForOrbitQueueEmpty(page, 'remote', 120_000);
      expect(await needItfSyncFlag(page)).toBeNull();
      page.off('request', onRequest);
      console.log(`requests after reconnect:\n  ${sent.join('\n  ')}`);

      // The ITF was uploaded and imported ...
      expect(sent.some((s) => /^PUT \/api\/offlineData\/sync\//.test(s))).toBe(
        true
      );
      // ... the team rename it does not carry was replayed ...
      expect(sent.some((s) => /^PATCH \/api\/organizations\//.test(s))).toBe(
        true
      );
      // ... and the project rename it carries was not sent a second time.
      expect(sent.some((s) => /^PATCH \/api\/projects\//.test(s))).toBe(false);
    } finally {
      await closeApp(launched);
    }

    // 7. A fresh profile loads from the server: both edits are there.
    launched = await launchApp();
    try {
      const page = await loginToTeamScreen(launched, credentials);
      await expect(page.getByText('Personal Audio Projects')).toBeVisible({
        timeout: 60_000,
      });
      const card = teamCard(page, TEAM_RENAMED);
      await expect(card).toBeVisible({ timeout: 60_000 });
      await expect(card).toContainText(PROJECT_RENAMED, { timeout: 60_000 });
      await expect(teamCard(page, TEAM)).toHaveCount(0);
    } finally {
      await closeApp(launched);
    }
  });
});

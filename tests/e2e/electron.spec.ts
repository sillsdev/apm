import { test, expect } from '@playwright/test';
import path from 'path';
import dotenv from 'dotenv';
import { launchApp, closeApp, loginToTeamScreen, LaunchedApp } from './helpers';

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

    const authed = await loginToTeamScreen(launched, {
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
    });

    // The authed renderer transitions /loading -> /team. Assert the personal
    // projects header renders (auto-waits through the loading screen).
    await expect(authed.getByText('Personal Audio Projects')).toBeVisible({
      timeout: 60_000,
    });

    // Sanity-check the main process is reachable (mirrors the sample's
    // electronApp.evaluate step).
    const appPath = await app.evaluate(({ app }) => app.getAppPath());
    expect(appPath.length).toBeGreaterThan(0);
  });

  test('exposes the app path from the main process', async () => {
    const { app } = launched;
    const appPath = await app.evaluate(({ app }) => app.getAppPath());
    expect(typeof appPath).toBe('string');
    expect(appPath.length).toBeGreaterThan(0);
  });

  test('creates a team + hierarchical Scripture project, adds a section/passage, saves, and goes offline', async () => {
    // Many more real-network round trips (team/project create, orbit sync)
    // than the login-only sanity check, so the default 60s test timeout
    // isn't enough headroom.
    test.setTimeout(180_000);

    // Capture this now, before "Go Offline" exits the process — once the
    // underlying connection drops, launched.app.process() itself throws.
    const mainProcess = launched.app.process();

    const authed = await loginToTeamScreen(launched, {
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
    });
    await expect(authed.getByText('Personal Audio Projects')).toBeVisible({
      timeout: 60_000,
    });

    // 1. Create a team. #TeamActAdd opens TeamDialog; #teamCommit is disabled
    //    until the name field is dirty and not already in use.
    await authed.locator('#TeamActAdd').click();
    await authed.locator('#teamDialog').waitFor({ state: 'visible' });
    await authed.locator('#teamName').fill('Test Team');
    await authed.locator('#teamCommit').click();

    // 2. The new team's card renders via TeamItem (id="TeamItem" is reused
    //    across every team, so scope by its visible name). Its "Add Project"
    //    trigger is an unlabeled AddCard with id="teamAdd-<teamId>".
    const teamCard = authed
      .locator('#TeamItem')
      .filter({ hasText: 'Test Team' });
    await teamCard.waitFor({ state: 'visible', timeout: 30_000 });
    await teamCard.locator('[id^="teamAdd-"]').click();

    // 3. ProjectDialog: name + type default to 'scripture' already, but pick
    //    it explicitly since that's what this test is asserting.
    await authed.locator('#projectSettings').waitFor({ state: 'visible' });
    await authed.locator('#project-name').fill('Sample');
    await authed.getByRole('radio', { name: 'Scripture' }).click();

    // 4. Language is required (bcp47 starts as 'und', which disables Add).
    //    mui-language-picker: open -> search -> choose from list -> Save.
    await authed.locator('#lang-bcp47').click();
    const languagePicker = authed.locator('#LanguagePicker');
    await languagePicker.waitFor({ state: 'visible' });
    await languagePicker.locator('#language').fill('en');
    await languagePicker
      .getByRole('button', { name: /^English/ })
      .first()
      .click();
    await languagePicker.getByRole('button', { name: 'Save' }).click();
    await languagePicker.waitFor({ state: 'hidden' });

    // 5. Advanced tab: layout defaults to Hierarchical (flat: false in
    //    initProjectState), but click it explicitly per the scenario.
    await authed.getByRole('tab', { name: 'Advanced' }).click();
    await authed.getByRole('radio', { name: 'Hierarchical' }).click();

    await authed.locator('#primaryAction').click();

    // 6. Project creation navigates to the Plan screen (react-datasheet grid).
    await authed
      .locator('#planSheetAddSec')
      .waitFor({ state: 'visible', timeout: 30_000 });

    // 7. Adding a section via "end of sheet" also inserts its first passage
    //    row underneath (ScriptureTable's addSection -> addPassageTo), so one
    //    menu click yields both a section and a passage row.
    await authed.locator('#planSheetAddSec').click();
    await authed.locator('#secEnd').click();

    // 8. Type a valid chapter:verse reference into the new passage row. The
    //    reference cell is the only one carrying both the row's "pass" class
    //    and a "ref"/"refErr" class (react-datasheet: double-click a <td> to
    //    mount an <input class="data-editor">; Enter commits the edit).
    const referenceCell = authed.locator('td.pass.ref, td.pass.refErr').first();
    await referenceCell.waitFor({ state: 'visible', timeout: 10_000 });
    await referenceCell.dblclick();
    const cellEditor = authed.locator('input.data-editor');
    await cellEditor.fill('1:1');
    await cellEditor.press('Enter');

    // 9. Save persists the sheet; the button is disabled until a change is
    //    pending, which the reference edit above just triggered. Wait for it
    //    to go back to disabled (changed -> false on success) so the save is
    //    actually finished before moving on, rather than racing it.
    const saveButton = authed.locator('#planSheetSave');
    await expect(saveButton).toBeEnabled({ timeout: 10_000 });
    await saveButton.click();
    await expect(saveButton).toBeDisabled({ timeout: 30_000 });

    // 10. Reproduces the reported crash: clicking "Go Offline" used to leave
    //     window-all-closed's app.quit() as the last thing that ran, killing
    //     the whole app with nothing to bring it back. "Go Offline" is
    //     designed to finish by fully restarting the app (relaunchApp() in
    //     the main process) so it reopens straight into the new offline
    //     session — which means the *original* process exiting cleanly
    //     (code 0) is the correct, expected outcome here, not a failure.
    //     The relaunched instance is a brand-new OS process this Playwright
    //     session never launched, so it can't be inspected directly; a
    //     clean exit (vs. hanging forever on "Saving..." or a crash code) is
    //     the regression signal for this bug.
    const goOfflineButton = authed.getByRole('button', { name: 'Go Offline' });
    await goOfflineButton.waitFor({ state: 'visible', timeout: 10_000 });
    await goOfflineButton.click();

    await expect
      .poll(() => mainProcess.exitCode, { timeout: 30_000 })
      .toBe(0);
  });
});

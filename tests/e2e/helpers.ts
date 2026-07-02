import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execFileSync } from 'child_process';

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

/**
 * "Go Offline" now restarts the whole app (relaunchApp() in the main
 * process) rather than just quitting — the relaunched instance is a brand
 * new OS process using the same --user-data-dir, which Playwright's
 * ElectronApplication handle never launched and so can't track or close.
 * Best-effort-kill anything still holding that profile dir so it doesn't
 * leak a background process, and so the directory can actually be removed.
 */
function killProcessesUsingProfile(profileDir: string): void {
  if (process.platform !== 'win32') return;
  try {
    const escaped = profileDir.replace(/\\/g, '\\\\').replace(/'/g, "''");
    const script =
      `Get-CimInstance Win32_Process | ` +
      `Where-Object { $_.CommandLine -like '*${escaped}*' } | ` +
      `ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
      stdio: 'ignore',
    });
  } catch {
    // best-effort cleanup only
  }
}

export async function closeApp({
  app,
  profileDir,
}: LaunchedApp): Promise<void> {
  await app.close().catch(() => {});
  // A relaunch can take a few seconds to actually start (loading the whole
  // bundle again), so a single kill attempt right after exit can miss it —
  // it grabs the profile dir's lockfile sometime after this runs. Re-kill on
  // every retry rather than once up front. This is best-effort OS temp-dir
  // cleanup, not part of what the test is verifying — a leftover profile
  // dir (or a relaunched instance still exiting) shouldn't fail the run.
  for (let attempt = 0; attempt < 10; attempt++) {
    killProcessesUsingProfile(profileDir);
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt === 9) {
        console.warn(`closeApp: could not remove ${profileDir}:`, err);
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
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

/**
 * Team names must be unique (TeamDialog's nameInUse check), so a test that
 * creates one has to clean it up or every subsequent run fails at
 * #teamCommit staying disabled. This spins up its own short-lived app
 * instance rather than reusing the caller's: a test that goes through
 * "Go Offline" ends with its original process exited and a relaunched,
 * untracked instance in its place, so there's no live `authed` page left to
 * do cleanup with by the time the test finishes.
 */
export async function deleteTeamIfExists(
  teamName: string,
  credentials: { username: string; password: string }
): Promise<void> {
  const launched = await launchApp();
  try {
    const authed = await loginToTeamScreen(launched, credentials);
    await authed
      .getByText('Personal Audio Projects')
      .waitFor({ state: 'visible', timeout: 60_000 });

    const teamCard = authed.locator('#TeamItem').filter({ hasText: teamName });
    const exists = await teamCard
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!exists) return;

    await teamCard.locator('#teamSettings').click();
    await authed.locator('#teamDialog').waitFor({ state: 'visible' });
    // #panel1a-header is reused by every accordion in the dialog (Publishing,
    // Advanced, ...) — scope by the "Advanced" tab's accessible name instead
    // of the id, which resolves ambiguously.
    await authed.getByRole('button', { name: 'Advanced' }).click();
    await authed.locator('#deleteExpand').click();
    await authed.locator('#alertYes').click();
    // Let the delete actually sync before tearing this instance down.
    await authed.waitForTimeout(3_000);
  } finally {
    await closeApp(launched);
  }
}

/**
 * The real "is this save actually done" signal, per Orbit's own persistence
 * model — not a UI proxy. Every Orbit Source (Sources.tsx's 'remote' source)
 * persists its pending request queue to an IndexedDB-backed bucket
 * (@orbit/data's Source constructor names it `${sourceName}-requests`,
 * @orbit/core's TaskQueue stores it via bucket.getItem(name)). The bucket
 * itself is an IndexedDBBucket namespaced as
 * `transcriber-<auth0-sub>-bucket` (see Sources.tsx's `bucket` setup), with
 * a single 'data' object store. localStorage's 'auth-id' key (LocalKey.authId)
 * holds that same auth0 sub, so it can be read directly from the page.
 *
 * Neither the Save button's disabled state (flips on save *start*, not
 * completion) nor the "Saving..." toast (auto-hides after 30s regardless of
 * whether the save actually finished — see SnackBar.tsx's autoHideDuration)
 * are reliable stand-ins for this.
 */
export async function getRemoteQueueLength(
  page: Page,
  sourceName: 'remote' | 'datachanges' = 'remote'
): Promise<number> {
  return page.evaluate(async (source) => {
    const authId = localStorage.getItem('auth-id');
    if (!authId) return 0;
    const namespace = `transcriber-${authId.replace(/\|/g, '-')}-bucket`;
    let db: IDBDatabase;
    try {
      db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(namespace);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        // A bucket DB that's never been written to yet means nothing has
        // ever been queued — treat the freshly-created empty DB as empty.
        req.onupgradeneeded = () => resolve(req.result);
      });
    } catch {
      return 0;
    }
    try {
      if (!db.objectStoreNames.contains('data')) return 0;
      const tasks = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(['data'], 'readonly');
        const getReq = tx.objectStore('data').get(`${source}-requests`);
        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => reject(getReq.error);
      });
      return Array.isArray(tasks) ? tasks.length : 0;
    } finally {
      db.close();
    }
  }, sourceName);
}

/** Poll until the named Orbit source's persisted request queue is empty. */
export async function waitForOrbitQueueEmpty(
  page: Page,
  sourceName: 'remote' | 'datachanges' = 'remote',
  timeoutMs = 60_000
): Promise<void> {
  await expectPoll(
    () => getRemoteQueueLength(page, sourceName),
    (len) => len === 0,
    timeoutMs
  );
}

async function expectPoll<T>(
  read: () => Promise<T>,
  isDone: (value: T) => boolean,
  timeoutMs: number,
  intervalMs = 500
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  while (Date.now() < deadline) {
    last = await read();
    if (isDone(last)) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(
    `expectPoll: condition not met within ${timeoutMs}ms (last value: ${JSON.stringify(last)})`
  );
}

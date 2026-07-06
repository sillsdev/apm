import {
  BrowserWindow,
  Menu,
  app,
  dialog,
  MenuItemConstructorOptions,
} from 'electron';
import {
  getAuthenticationURL,
  getGoogleLogOutUrl,
  getLogOutUrl,
  logout,
  loadTokens,
} from './auth-service';
import { createWindow } from './index';
import path from 'path';
import { is } from '@electron-toolkit/utils';
import { setLogingIn } from './loginState.js';
import { getAuthProcessStrings } from './auth-strings.js';

let win: BrowserWindow | null = null;

export function createAuthWindow(hasUsed: boolean, email: string) {
  destroyAuthWin();

  const existingWindows = BrowserWindow.getAllWindows();

  win = new BrowserWindow({
    width: 1000,
    height: 780,
    icon: path.join(__dirname, 'favicon.ico'),
    webPreferences: {
      devTools: is.dev,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // close pre-existing windows
  for (const w of existingWindows) {
    w.close();
  }

  function workOffline() {
    setLogingIn(true);
    createWindow();
    destroyAuthWin();
    setLogingIn(false);
  }

  const buildMenu = () => {
    const s = getAuthProcessStrings();
    return Menu.buildFromTemplate([
      {
        label: s.back,
        submenu: [
          {
            label: s.abortLogin,
            click() {
              return workOffline();
            },
          },
          ...(is.dev
            ? ([
                { role: 'toggleDevTools' },
              ] satisfies MenuItemConstructorOptions[])
            : []),
          {
            label: s.exit,
            click() {
              app.quit();
            },
          },
        ],
      },
    ]);
  };

  Menu.setApplicationMenu(buildMenu());

  const loadAuthUrl = () => {
    if (!win) return Promise.resolve();
    return win.loadURL(getAuthenticationURL(hasUsed, email), {
      userAgent: 'Chrome',
    });
  };

  void loadAuthUrl().catch((error) => {
    if (error.code === 'ERR_NAME_NOT_RESOLVED') {
      // allow working offline
      workOffline();
    }
  });

  const {
    session: { webRequest },
  } = win.webContents;

  const filter = {
    urls: ['http://localhost/callback*'],
  };

  webRequest.onBeforeRequest(filter, async ({ url }) => {
    try {
      await loadTokens(url);
      setLogingIn(true);
      createWindow();
      destroyAuthWin();
      setLogingIn(false);
    } catch (err) {
      if (!win) return;
      const s = getAuthProcessStrings();
      const message = err instanceof Error ? err.message : String(err);
      const { response } = await dialog.showMessageBox(win, {
        type: 'error',
        title: s.loginFailed,
        message: s.tokenExchangeFailed,
        detail: message,
        buttons: [s.tryAgain, s.workOffline],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) void loadAuthUrl();
      else workOffline();
    }
  });

  // win.on('authenticated', () => {
  //   destroyAuthWin();
  // });

  if (is.dev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  win.on('closed', () => {
    win = null;
  });
}

function destroyAuthWin() {
  if (!win) return;
  win.close();
  win = null;
}

export function createLogoutWindow() {
  const googleLogoutWindow = new BrowserWindow({ show: false });

  googleLogoutWindow.loadURL(getGoogleLogOutUrl(), {
    userAgent: 'Chrome',
  });

  googleLogoutWindow.on('ready-to-show', () => {
    googleLogoutWindow.close();
  });

  const logoutWindow = new BrowserWindow({ show: false });

  logoutWindow.loadURL(getLogOutUrl(), { userAgent: 'Chrome' });

  logoutWindow.on('ready-to-show', async () => {
    logoutWindow.close();
    await logout();
  });
}

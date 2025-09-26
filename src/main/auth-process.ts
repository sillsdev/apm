import { BrowserWindow, Menu, app } from 'electron';
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
    createWindow();
    return destroyAuthWin();
  }

  const menu = Menu.buildFromTemplate([
    {
      label: 'Back',
      submenu: [
        {
          label: 'Abort Login',
          click() {
            return workOffline();
          },
        },
        ...(is.dev ? [{ role: 'toggleDevTools' }] : ([] as any)),
        {
          label: 'Exit',
          click() {
            app.quit();
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  // Full userAgent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36',
  win
    .loadURL(getAuthenticationURL(hasUsed, email), {
      userAgent: 'Chrome',
    })
    .catch((error) => {
      if (error.code === 'ERR_NAME_NOT_RESOLVED') {
        // allow working offline
        return workOffline();
      }
    });

  const {
    session: { webRequest },
  } = win.webContents;

  const filter = {
    urls: ['http://localhost/callback*'],
  };

  webRequest.onBeforeRequest(filter, async ({ url }) => {
    await loadTokens(url);
    createWindow();
    return destroyAuthWin();
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

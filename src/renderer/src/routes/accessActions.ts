import { LocalKey, forceLogin } from '../utils';

import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

export const goOnline = (email?: string) => {
  const lastTime = localStorage.getItem('electron-lastTime');
  localStorage.removeItem(LocalKey.authId);
  localStorage.setItem(LocalKey.loggedIn, 'true');
  const hasUsed = lastTime !== null;
  ipc?.login(hasUsed, email);
  ipc?.closeApp();
};

export const doLogout = async () => {
  localStorage.removeItem(LocalKey.onlineUserId);
  forceLogin();
  await ipc?.logout();
};

export const switchUser = async () => {
  await doLogout();
  setTimeout(() => {
    goOnline();
  }, 2000);
};

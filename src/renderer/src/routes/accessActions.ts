import { LocalKey, forceLogin } from '../utils';

const ipc = window?.electron;

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

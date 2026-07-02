// Shared between ipcMethods.ts and auth-process.ts: both close the current
// window(s) and create a replacement as part of a login/re-login cycle, and
// `window-all-closed` (registered in ipcMethods.ts) must not quit the app
// while that replacement is in flight — even though the window count can
// legitimately hit zero for an instant during the handoff.
let isLogingIn = false;

export function setLogingIn(value: boolean): void {
  isLogingIn = value;
}

export function getLogingIn(): boolean {
  return isLogingIn;
}

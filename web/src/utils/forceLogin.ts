import { LocalKey } from './localUserKey';

export function forceLogin(): void {
  localStorage.removeItem(LocalKey.authId);
  localStorage.removeItem(LocalKey.userId);
}

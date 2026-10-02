import { LocalKey } from './localUserKey';

/** True when an online-linked user has been working offline and we should
 *  consider sending an ITF on the next online Electron start. */
export const needItfSync = () =>
  localStorage.getItem(LocalKey.needItfSync) === 'true';

export const markNeedItfSync = () => {
  localStorage.setItem(LocalKey.needItfSync, 'true');
};

export const clearNeedItfSync = () => {
  localStorage.removeItem(LocalKey.needItfSync);
};

/** ITF goes to the server only after an offline session, and only on Electron
 *  coming back online. Callers still skip the upload when the export finds
 *  no records changed since snapshotDate. The flag stays set until that upload
 *  succeeds (or the export finds nothing) so a crash or failed send retries. */
export const shouldRunItfSync = ({
  isElectron,
  offline,
  needItf,
}: {
  isElectron: boolean;
  offline: boolean;
  needItf: boolean;
}) => isElectron && !offline && needItf;

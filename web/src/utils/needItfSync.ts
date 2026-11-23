import type JSONAPISource from '@orbit/jsonapi';
import { LocalKey } from './localUserKey';
import logError, { Severity } from './logErrorService';
import bugsnagClient from '../auth/bugsnagClient';

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

/** A dropped network with queued edits is an offline session too, not only a
 *  manual switch to offline mode. Mark it so the next online start sends an
 *  ITF instead of relying on the persisted queue alone. */
export const markNeedItfSyncOnDisconnect = ({
  isElectron,
  offline,
  remote,
}: {
  isElectron: boolean;
  offline: boolean;
  remote: JSONAPISource | undefined;
}) => {
  if (isElectron && !offline && (remote?.requestQueue?.length ?? 0) > 0) {
    markNeedItfSync();
  }
};

/** Decide what happens to the persisted remote queue at an online start.
 *  - An ITF holding these edits is about to be sent: clear the whole queue so
 *    they are not also replayed on top of the import. (`skip()` would drop
 *    only the first task.)
 *  - Otherwise leave every task in place for `orbitReset` to replay. */
export const prepareRemoteQueueForStartup = async (
  remote: JSONAPISource | undefined,
  sendingItf: boolean
) => {
  // No length check: before the persisted queue is reified from IndexedDB it
  // can report 0. clear() awaits reification itself and is a no-op if empty.
  if (!sendingItf || !remote?.requestQueue) return;
  try {
    await remote.requestQueue.clear();
  } catch (error) {
    // Startup continues: the queue then replays on top of the ITF, which the
    // import tolerates, but report it so duplicate replays are visible.
    logError(
      Severity.error,
      bugsnagClient,
      error instanceof Error ? error : new Error(String(error))
    );
  }
};

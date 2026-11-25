import type JSONAPISource from '@orbit/jsonapi';
import { LocalKey } from './localUserKey';
import type { RecordIdentity } from '@orbit/records';
import { dropQueuedEditsCarriedByItf } from './itfQueue';

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
 *  coming back online: at an online start, or when a running session gets
 *  its connection back (TT-7911). Callers still skip the upload when the export finds
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
 *  - An ITF is about to be sent: drop the queued edits it carries so they are
 *    not also replayed on top of the import, and keep the rest (TT-7911: a
 *    team rename or a delete is not in the ITF; clearing everything lost it).
 *  - Otherwise leave every task in place for `orbitReset` to replay. */
export const prepareRemoteQueueForStartup = async (
  remote: JSONAPISource | undefined,
  itfRecords: readonly RecordIdentity[] | undefined
) => {
  if (!itfRecords) return;
  await dropQueuedEditsCarriedByItf(remote, itfRecords);
};

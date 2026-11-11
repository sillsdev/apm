import { memory, backup, schema } from '../schema';
import { logError, Severity, infoMsg, waitForIt, LocalKey } from '../utils';
import { trackBackupRestore } from '../utils/removeOrbitRemote';
import { UninitializedRecord } from '@orbit/records';
import { related } from '../crud';
import Coordinator from '@orbit/coordinator';
import MemorySource from '@orbit/memory';
import IndexedDBSource from '@orbit/indexeddb';
import bugsnagClient from '../auth/bugsnagClient';
import { findRecords } from './tryFindRecord';

let restorePromise: Promise<string[]> | null = null;

export async function restoreBackup(
  coordinator?: Coordinator
): Promise<string[]> {
  // Pass a thunk so a pending teardown can refuse the query before it starts.
  // A refusal is not cached: restorePromise stays null and a later login can retry.
  restorePromise ??= trackBackupRestore(() => restoreBackupOnce(coordinator));
  return restorePromise;
}

async function restoreBackupOnce(coordinator?: Coordinator): Promise<string[]> {
  const myMemory = memory ?? (coordinator?.getSource('memory') as MemorySource);
  const myBackup =
    backup ?? (coordinator?.getSource('backup') as IndexedDBSource);

  try {
    if (
      typeof myBackup?.cache?.openDB === 'function' &&
      !myBackup.cache.isDBOpen
    ) {
      await myBackup.cache.openDB();
    }
    await waitForIt(
      'migration',
      () => {
        return (
          schema.version === myBackup.schema.version &&
          Boolean(myBackup?.cache?.isDBOpen) &&
          (localStorage.getItem(LocalKey.migration) ?? '') !== 'WAIT'
        );
      },
      () => false,
      600
    );
    console.log('restore backup', localStorage.getItem(LocalKey.migration));
    // Query all records from the IndexedDB backup source
    const allRecords = (await backup.query((q) =>
      q.findRecords()
    )) as UninitializedRecord[];
    // Sync the records from IndexedDB into the memory source
    await memory.sync((t) =>
      allRecords?.map((r: UninitializedRecord) => t.addRecord(r))
    );

    const ops = findRecords(myMemory, 'offlineproject');
    const loaded = ops.filter((o) => o.attributes?.snapshotDate);

    const projs = new Set(loaded.map((p) => related(p, 'project') as string));
    const ret = Array.from(projs);
    return ret;
  } catch (err) {
    restorePromise = null;
    logError(
      Severity.error,
      bugsnagClient,
      infoMsg(err as Error, 'IndexedDB Pull error')
    );
    throw err;
  }
}

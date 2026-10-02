import { memory, backup, schema } from '../schema';
import { logError, Severity, infoMsg, waitForIt, LocalKey } from '../utils';
import { RecordQueryBuilder, UninitializedRecord } from '@orbit/records';
import { related } from '../crud';
import { OfflineProject } from '../model';
import Coordinator from '@orbit/coordinator';
import MemorySource from '@orbit/memory';
import IndexedDBSource from '@orbit/indexeddb';
import bugsnagClient from '../auth/bugsnagClient';

let restorePromise: Promise<string[]> | null = null;

export async function restoreBackup(
  coordinator?: Coordinator
): Promise<string[]> {
  if (!restorePromise) {
    restorePromise = restoreBackupOnce(coordinator);
  }
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

    const ops = myMemory?.cache.query((q: RecordQueryBuilder) =>
      q.findRecords('offlineproject')
    ) as OfflineProject[];
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
  }
  return [];
}

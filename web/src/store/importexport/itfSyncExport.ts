import type Memory from '@orbit/memory';
import type IndexedDBSource from '@orbit/indexeddb';
import type { RecordIdentity } from '@orbit/records';
import type bugsnagClient from '../../auth/bugsnagClient';
import type { OfflineProject, Plan, VProject } from '../../model';
import { ExportType } from './types';
import { electronExport } from './electronExport';
import { clearNeedItfSync } from '../../utils/needItfSync';
import logError, { Severity } from '../../utils/logErrorService';
import { infoMsg } from '../../utils/infoMsg';

/** An ITF ready to send, and the records it carries. */
export interface ItfSyncFile {
  buffer: Buffer;
  fileName: string;
  /** Queued offline edits to these records must not also be replayed. */
  records: RecordIdentity[];
}

export interface ExportItfSyncArgs {
  memory: Memory;
  backup: IndexedDBSource | undefined;
  getOfflineProject: (plan: Plan | VProject | string) => OfflineProject;
  errorReporter: typeof bugsnagClient;
}

/**
 * Packs the offline changes of every offline project into one ITF (desktop
 * only). Shared by the online start (Sources.tsx) and the reconnect path
 * (TT-7911). Returns nothing, and clears needItfSync, when nothing changed, so
 * an empty export is not retried. A failed export is reported and rethrown;
 * the flag stays set so the next start or reconnect tries again.
 */
export async function exportItfSync({
  memory,
  backup,
  getOfflineProject,
  errorReporter,
}: ExportItfSyncArgs): Promise<ItfSyncFile | undefined> {
  try {
    const fr = await electronExport(
      ExportType.ITFSYNC,
      undefined, //all artifact types
      memory,
      backup,
      0,
      0,
      '',
      '',
      getOfflineProject
    );
    if (!fr || fr.changes <= 0) {
      // Nothing to send — don't keep retrying an empty export.
      clearNeedItfSync();
      return undefined;
    }
    if (!fr.buffer) throw new Error('ITFSYNC export returned no data');
    return {
      buffer: fr.buffer,
      fileName: fr.message,
      records: fr.records ?? [],
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logError(
      Severity.error,
      errorReporter,
      infoMsg(error, 'ITFSYNC export failed: ')
    );
    throw error;
  }
}

import type bugsnagClient from '../../auth/bugsnagClient';
import { itfImportTarget, processImportFile } from './actions';
import { IMPORT_ERROR, IMPORT_PENDING } from './types';
import type { ItfSyncFile } from './itfSyncExport';

export interface UploadItfSyncArgs {
  file: ItfSyncFile;
  token: string | null;
  errorReporter: typeof bugsnagClient;
  /** Cancels until the server starts applying the ITF. */
  signal: AbortSignal;
  /** The upload is done and the server is applying it; it can't be cancelled now. */
  onApplying: () => void;
}

/** Reads what processImportFile reports through its dispatch callback. */
const importErrorMessage = (payload: unknown): string => {
  if (typeof payload !== 'object' || payload === null) return 'ITF sync failed';
  const { errMsg } = payload as { errMsg?: unknown };
  return typeof errMsg === 'string' && errMsg ? errMsg : 'ITF sync failed';
};

/**
 * TT-7911: sends a reconnect ITF through the same upload and import as the
 * startup sync (ImportTab → importSyncFromElectron), but reports to its caller
 * instead of the import dialog's Redux status, so it can run in the background
 * of a session. Resolves only when the server confirms the whole import.
 */
export async function uploadItfSync({
  file,
  token,
  errorReporter,
  signal,
  onApplying,
}: UploadItfSyncArgs): Promise<void> {
  let failure: string | undefined;
  await processImportFile({
    filename: file.fileName,
    file: new Blob([new Uint8Array(file.buffer)]),
    itf: true,
    ...itfImportTarget(0),
    token,
    errorReporter,
    pendingmsg: '',
    completemsg: '',
    signal,
    dispatch: (action: { type: string; payload: unknown }) => {
      if (action.type === IMPORT_PENDING) onApplying();
      else if (action.type === IMPORT_ERROR)
        failure = importErrorMessage(action.payload);
    },
  });
  // processImportFile returns normally after some reported errors (too large).
  if (failure !== undefined) throw new Error(failure);
}

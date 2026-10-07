/** Same ArrayBuffer identity ⇒ already started (Strict Mode remount). */
export const shouldStartItfSyncUpload = (
  buffer: Buffer | undefined,
  lastStarted: Buffer | undefined
): buffer is Buffer => Boolean(buffer) && buffer !== lastStarted;

/** Mount action for ImportTab. 'skip' is the Strict Mode remount of an
 *  in-flight ITF sync: do not open the file picker. */
export type ImportMountAction = 'sync' | 'skip' | 'choose' | 'pick';

export function importMountAction({
  isElectron,
  hasSyncFile,
  syncBuffer,
  lastStarted,
  offerPtf,
}: {
  isElectron: boolean;
  hasSyncFile: boolean;
  syncBuffer: Buffer | undefined;
  lastStarted: Buffer | undefined;
  offerPtf: boolean;
}): ImportMountAction {
  if (isElectron && hasSyncFile && syncBuffer) {
    return shouldStartItfSyncUpload(syncBuffer, lastStarted) ? 'sync' : 'skip';
  }
  return offerPtf ? 'choose' : 'pick';
}

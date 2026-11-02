import Memory from '@orbit/memory';
import { RecordKeyMap, RecordTransformBuilder } from '@orbit/records';
import { MediaFile } from '../model';
import { getAllMediaRecs } from './media';
import { VernacularTag } from './useArtifactType';
import {
  clearPendingUploads,
  PendingUploadMediaRecord,
} from '../store/upload/pendingMediaUploads';
import { evictMediaCache } from '../utils/evictMediaCache';
import { logError, Severity } from '../utils/logErrorService';
import bugsnagClient from '../auth/bugsnagClient';

export const AutosaveSuffix = '_autosave';

export const isAutosaveFileName = (name?: string | null) =>
  (name ?? '').includes(AutosaveSuffix);

export const isAutosaveMedia = (m?: MediaFile | null) =>
  isAutosaveFileName(m?.attributes?.originalFile);

export const isAutosavePending = (record: PendingUploadMediaRecord) =>
  isAutosaveFileName(record.originalFile);

const fileOf = (url?: string) => url?.split('?')[0]?.split(/[\\/]/).pop();

interface RemoveAutosavesProps {
  memory: Memory;
  passageId: string;
  planId: string;
  offline: boolean;
  reporter: typeof bugsnagClient | string;
}

/** Evict the removed records' files, except any a kept record still plays. */
const evictFiles = async (removed: MediaFile[], kept: MediaFile[]) => {
  const inUse = new Set(kept.map((m) => fileOf(m.attributes.audioUrl)));
  const files = removed
    .flatMap((m) => [m.attributes.audioUrl, m.attributes.originalFile])
    .filter((f) => f && !inUse.has(fileOf(f)));
  await Promise.all(files.map((f) => evictMediaCache(f)));
};

const removeAutosaves = async ({
  memory,
  passageId,
  planId,
  offline,
  reporter,
  keepNewest,
}: RemoveAutosavesProps & { keepNewest: boolean }) => {
  try {
    clearPendingUploads(
      memory?.keyMap as RecordKeyMap,
      planId,
      passageId,
      isAutosavePending
    );
    const versions = getAllMediaRecs(passageId, memory, VernacularTag);
    const newestId = keepNewest
      ? versions.find(isAutosaveMedia)?.id
      : undefined;
    const oldAutosaves = versions.filter(
      (m) =>
        m.id !== newestId &&
        isAutosaveMedia(m) &&
        // Sync can't delete server records, so Work Offline leaves them
        // for the next online autosave or Save of this passage.
        !(offline && m.keys?.remoteId)
    );
    if (!oldAutosaves.length) return;
    await memory.update((t: RecordTransformBuilder) =>
      oldAutosaves.map((m) => t.removeRecord(m).toOperation())
    );
    await evictFiles(
      oldAutosaves,
      versions.filter((m) => !oldAutosaves.includes(m))
    );
  } catch (err) {
    logError(Severity.error, reporter, err as Error);
  }
};

/** Remove the passage's vernacular autosaves, except its newest one. Best-effort. */
export const removeOldAutosaves = (props: RemoveAutosavesProps) =>
  removeAutosaves({ ...props, keepNewest: true });

/** Remove all the passage's vernacular autosaves. Best-effort. */
export const removeAllAutosaves = (props: RemoveAutosavesProps) =>
  removeAutosaves({ ...props, keepNewest: false });

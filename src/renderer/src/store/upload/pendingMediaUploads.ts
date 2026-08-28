import { UploadType } from '../../components/UploadType';
import { MediaFileAttributes } from '../../model';

const STORAGE_KEY = 'pendingMediaUploadsV1';

/** Serializable snapshot for POST /api/mediafiles (same shape as nextUpload `record`). */
export type PendingUploadMediaRecord = MediaFileAttributes & {
  planId: string;
  passageId?: string;
  artifactTypeId?: string | null;
  userId: string;
  recordedbyUserId?: string;
  sourceMediaId?: string;
};

/**
 * Domain side-effects that normal UI `afterUploadCb` would run on success.
 * Persisted on the pending row so Home → Retry can recreate Orbit links
 * after re-upload (TT-7363).
 */
export type PendingUploadRestore =
  | {
      kind: 'intellectualproperty';
      rightsHolder: string;
      organizationId: string;
      notes?: string;
      transcription?: string;
    }
  | {
      kind: 'comment';
      discussionId: string;
      commentId?: string;
      text: string;
      /**
       * JSON string matching useSaveComment / computeCommentVisibleString.
       * Optional for older pending rows staged before TT-7363 visible fix.
       */
      visible?: string;
    }
  | {
      kind: 'title';
      sectionId: string;
    };

export type PendingRestoreInput =
  PendingUploadRestore | (() => PendingUploadRestore | undefined);

export interface PendingUploadRecord {
  id: string;
  failedAt: string;
  localAbsolutePath: string;
  fileSize: number;
  uploadType: UploadType;
  record: PendingUploadMediaRecord;
  /** Optional secondary-link restore metadata (TT-7363). */
  restore?: PendingUploadRestore;
}

/** Identity for matching pending rows across different staged disk paths (TT-7347). */
export type PendingUploadIdentity = Pick<
  PendingUploadMediaRecord,
  'planId' | 'passageId' | 'artifactTypeId' | 'originalFile'
>;

const randomId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `pu-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

export function loadPendingMediaUploads(): PendingUploadRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as PendingUploadRecord[];
  } catch {
    return [];
  }
}

/** Fired on this window when the pending list changes (localStorage `storage`
 * events only reach *other* windows, so same-window listeners need this). */
const CHANGE_EVENT = 'pendingMediaUploadsChanged';

function savePendingMediaUploads(items: PendingUploadRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / private mode
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

/** Subscribe to pending upload list changes. Returns an unsubscribe function. */
export function subscribePendingMediaUploads(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function pendingUploadIdentityKey(record: PendingUploadIdentity): string {
  return [
    record.planId || '',
    record.passageId || '',
    record.artifactTypeId || '',
    record.originalFile || '',
  ].join('\0');
}

/** Passage-level match (any originalFile) for TT-7366 re-record/upload warn. */
function pendingUploadPassageKey(
  record: Pick<
    PendingUploadMediaRecord,
    'planId' | 'passageId' | 'artifactTypeId'
  >
): string {
  return [
    record.planId || '',
    record.passageId || '',
    record.artifactTypeId || '',
  ].join('\0');
}

/** True when a pending upload exists for this plan/passage/artifact (vernacular: null/''/undefined). */
export function hasPendingUploadForPassage(query: {
  planId: string;
  passageId: string;
  artifactTypeId?: string | null;
}): boolean {
  if (!query.passageId) return false;
  const key = pendingUploadPassageKey(query);
  return loadPendingMediaUploads().some(
    (p) => pendingUploadPassageKey(p.record) === key
  );
}

export function removeMatchingPendingUploads(
  identity: PendingUploadIdentity
): number {
  const key = pendingUploadIdentityKey(identity);
  const items = loadPendingMediaUploads();
  const next = items.filter((p) => pendingUploadIdentityKey(p.record) !== key);
  savePendingMediaUploads(next);
  return items.length - next.length;
}

export function appendPendingMediaUpload(
  entry: Omit<PendingUploadRecord, 'id' | 'failedAt'> & {
    id?: string;
    failedAt?: string;
  }
): PendingUploadRecord {
  const full: PendingUploadRecord = {
    id: entry.id ?? randomId(),
    failedAt: entry.failedAt ?? new Date().toISOString(),
    localAbsolutePath: entry.localAbsolutePath,
    fileSize: entry.fileSize,
    uploadType: entry.uploadType,
    record: entry.record,
    ...(entry.restore ? { restore: entry.restore } : {}),
  };
  const next = loadPendingMediaUploads().filter((p) => {
    const samePath =
      (p.localAbsolutePath || '') === (full.localAbsolutePath || '');
    const sameMeta =
      p.record.planId === full.record.planId &&
      p.record.originalFile === full.record.originalFile &&
      (p.record.passageId || '') === (full.record.passageId || '');
    return !(samePath && sameMeta);
  });
  next.push(full);
  savePendingMediaUploads(next);
  return full;
}

export function updatePendingMediaUpload(
  id: string,
  patch: Partial<
    Pick<
      PendingUploadRecord,
      'localAbsolutePath' | 'fileSize' | 'record' | 'uploadType' | 'restore'
    >
  >
): PendingUploadRecord | undefined {
  const items = loadPendingMediaUploads();
  const idx = items.findIndex((p) => p.id === id);
  if (idx < 0) return undefined;
  const updated: PendingUploadRecord = {
    ...items[idx],
    ...patch,
    failedAt: new Date().toISOString(),
  };
  const next = [...items];
  next[idx] = updated;
  savePendingMediaUploads(next);
  return updated;
}

export function removePendingMediaUpload(id: string): void {
  const next = loadPendingMediaUploads().filter((p) => p.id !== id);
  savePendingMediaUploads(next);
}

export function pendingMediaUploadCount(): number {
  return loadPendingMediaUploads().length;
}

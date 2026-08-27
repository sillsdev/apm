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

export interface PendingUploadRecord {
  id: string;
  failedAt: string;
  localAbsolutePath: string;
  fileSize: number;
  uploadType: UploadType;
  record: PendingUploadMediaRecord;
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

function savePendingMediaUploads(items: PendingUploadRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / private mode
  }
}

function pendingUploadIdentityKey(record: PendingUploadIdentity): string {
  return [
    record.planId || '',
    record.passageId || '',
    record.artifactTypeId || '',
    record.originalFile || '',
  ].join('\0');
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
      'localAbsolutePath' | 'fileSize' | 'record' | 'uploadType'
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

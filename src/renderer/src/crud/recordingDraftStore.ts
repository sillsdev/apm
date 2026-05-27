const STORAGE_KEY = 'recordingDraftsV1';

export interface RecordingDraft {
  passageId: string;
  mediafileId?: string;
  relativeMediaPath: string;
  performedBy?: string;
  mimeType: string;
  filetype: string;
  updatedAt: string;
}

function loadAll(): RecordingDraft[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as RecordingDraft[];
  } catch {
    return [];
  }
}

function saveAll(items: RecordingDraft[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / private mode
  }
}

export function getDraft(passageId: string): RecordingDraft | undefined {
  if (!passageId) return undefined;
  return loadAll().find((d) => d.passageId === passageId);
}

export function upsertDraft(
  draft: Omit<RecordingDraft, 'updatedAt'> & { updatedAt?: string }
): RecordingDraft {
  const full: RecordingDraft = {
    ...draft,
    updatedAt: draft.updatedAt ?? new Date().toISOString(),
  };
  const next = loadAll().filter((d) => d.passageId !== full.passageId);
  next.push(full);
  saveAll(next);
  return full;
}

export function removeDraft(passageId: string): void {
  if (!passageId) return;
  const next = loadAll().filter((d) => d.passageId !== passageId);
  saveAll(next);
}

/** Prefer draft when newer than server media (or when there is no server media). */
export function shouldRestoreDraft(
  draft: RecordingDraft | undefined,
  mediaDateUpdated: string | undefined
): boolean {
  if (!draft) return false;
  if (!mediaDateUpdated) return true;
  const draftTime = Date.parse(draft.updatedAt);
  const mediaTime = Date.parse(mediaDateUpdated);
  if (Number.isNaN(draftTime)) return false;
  if (Number.isNaN(mediaTime)) return true;
  return draftTime >= mediaTime;
}

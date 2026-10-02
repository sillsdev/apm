const STORAGE_KEY = 'pendingProjectResourceConfigV1';

function loadIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return [];
  }
}

function saveIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore quota / private mode
  }
}

/** After Home Retry restores a general resource, queue it for configure resume. */
export function appendPendingProjectResourceConfig(mediaId: string): void {
  if (!mediaId) return;
  const next = loadIds().filter((id) => id !== mediaId);
  next.push(mediaId);
  saveIds(next);
}

/** Drain the configure-resume queue (Internalization consumes on mount). */
export function takePendingProjectResourceConfigs(): string[] {
  const ids = loadIds();
  if (ids.length) saveIds([]);
  return ids;
}

/** Remove specific media ids after they have been handed to the configure UI. */
export function removePendingProjectResourceConfigs(mediaIds: string[]): void {
  if (!mediaIds.length) return;
  const remove = new Set(mediaIds);
  saveIds(loadIds().filter((id) => !remove.has(id)));
}

/** Peek without draining — for tests / debugging. */
export function loadPendingProjectResourceConfigs(): string[] {
  return loadIds();
}

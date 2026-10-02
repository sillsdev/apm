/** True when a wavesurfer/media load was canceled, not a missing/bad file. */
export function isAudioLoadAbort(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false;
  const e = error as { name?: string; code?: number; message?: string };
  if (e.name === 'AbortError') return true;
  if (e.name === 'MediaError' && e.code === 1) return true;
  return e.message === 'The user aborted a request.';
}

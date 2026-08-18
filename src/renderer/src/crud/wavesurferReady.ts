/**
 * WaveSurfer 'ready' after load(url, peaks, duration) fires before currentSrc
 * is set; the src attribute is already the blob URL. Peaks-only preview loads
 * use an empty src (ws.load('', peaks, duration)).
 */
export function isPlayableMediaSrc(
  currentSrc?: string | null,
  srcAttr?: string | null
): boolean {
  const src = currentSrc || srcAttr || '';
  return (
    src.startsWith('blob:') ||
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('file:') ||
    src.startsWith('data:')
  );
}

export function shouldIgnorePeaksReady(opts: {
  currentSrc?: string | null;
  srcAttr?: string | null;
  peaksGeneration: number;
  loadGeneration: number;
  blobGeneration: number;
}): boolean {
  if (isPlayableMediaSrc(opts.currentSrc, opts.srcAttr)) return false;
  return (
    opts.peaksGeneration !== opts.loadGeneration ||
    opts.blobGeneration === opts.loadGeneration
  );
}

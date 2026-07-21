/** Waveform canvas height when zoomed past fit-to-width (scrollbar room). */
export function waveformHeightForZoom(
  baseHeight: number,
  pxPerSec: number,
  fillPx: number,
  scrollbarPx = 40
): number {
  const zoomedIn = fillPx > 0 && pxPerSec > fillPx;
  if (!zoomedIn || baseHeight <= scrollbarPx) return baseHeight;
  return baseHeight - scrollbarPx;
}

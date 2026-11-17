import type WaveSurfer from 'wavesurfer.js';
import type { WaveSurferOptions } from 'wavesurfer.js';
import {
  calculateBarRenderConfig,
  calculateBarSegments,
  calculateVerticalScale,
} from 'wavesurfer.js/dist/renderer-utils.js';

export interface WaveformRenderRefs {
  ws: React.RefObject<WaveSurfer | null>;
  highlights: React.RefObject<{ start: number; end: number; color: string }[]>;
}

/**
 * Creates a WaveSurfer `renderFunction` that draws bars with a gradient
 * to highlight colored regions.
 */
export function createWaveformRenderer(
  refs: WaveformRenderRefs,
  wsOptions: WaveSurferOptions
) {
  return (
    peaks: Array<Float32Array | number[]>,
    ctx: CanvasRenderingContext2D
  ) => {
    const dur = refs.ws.current?.getDuration() || 0;
    const baseColor = wsOptions.waveColor as string;
    const highlights = refs.highlights.current;

    if (highlights && highlights.length > 0 && dur > 0) {
      applyRegionsGradient(ctx, highlights, dur, baseColor, refs.ws);
    }

    drawBars(peaks, ctx, wsOptions);
  };
}

/**
 * Applies a horizontal gradient to `ctx.fillStyle` so that bars inside any
 * of the given regions use that region's color and bars outside use `baseColor`.
 * Accounts for zoom by mapping regions to the canvas chunk's local coordinate space.
 */
function applyRegionsGradient(
  ctx: CanvasRenderingContext2D,
  regions: { start: number; end: number; color: string }[],
  duration: number,
  baseColor: string,
  wsRef: React.RefObject<WaveSurfer | null>
) {
  // When zoomed, WaveSurfer splits into multiple canvas chunks.
  // Map region time ranges to this chunk's local [0,1] fraction.
  const canvasOffsetCSS = parseFloat(ctx.canvas.style.left) || 0;
  const canvasWidthCSS = parseFloat(ctx.canvas.style.width) || ctx.canvas.width;
  const wrapper = wsRef.current?.getWrapper();
  const totalWidthCSS = wrapper?.scrollWidth || canvasWidthCSS;

  const chunkStart = canvasOffsetCSS / totalWidthCSS;
  const chunkSpan = canvasWidthCSS / totalWidthCSS;

  // Convert to local coordinates, filter to those overlapping this chunk, sort
  const localRegions = regions
    .map((r) => ({
      localStart: (r.start / duration - chunkStart) / chunkSpan,
      localEnd: (r.end / duration - chunkStart) / chunkSpan,
      color: r.color,
    }))
    .filter((r) => r.localEnd > 0 && r.localStart < 1)
    .sort((a, b) => a.localStart - b.localStart);

  if (localRegions.length === 0) return;

  const eps = 0.0001;
  const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, 0);
  let cursor = 0;

  for (const region of localRegions) {
    const s = Math.max(0, region.localStart);
    const e = Math.min(1, region.localEnd);

    // Base color from cursor to region start (only if there's a gap)
    if (s > cursor + eps) {
      if (cursor === 0) {
        gradient.addColorStop(0, baseColor);
      } else {
        gradient.addColorStop(cursor, baseColor);
      }
      gradient.addColorStop(s - eps, baseColor);
    }

    // Region color
    gradient.addColorStop(s, region.color);
    gradient.addColorStop(e, region.color);

    cursor = e + eps;
  }

  // Base color to the end
  if (cursor < 1) {
    gradient.addColorStop(Math.min(cursor, 1), baseColor);
    gradient.addColorStop(1, baseColor);
  }

  ctx.fillStyle = gradient;
}

/**
 * Draws waveform bars using WaveSurfer's exported utilities.
 */
function drawBars(
  peaks: Array<Float32Array | number[]>,
  ctx: CanvasRenderingContext2D,
  options: WaveSurferOptions
) {
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const { width, height } = ctx.canvas;

  const vScale = calculateVerticalScale({
    channelData: peaks,
    normalize: options.normalize,
  });
  const config = calculateBarRenderConfig({
    width,
    height,
    length: (peaks[0] || []).length,
    options,
    pixelRatio,
  });
  const segments = calculateBarSegments({
    channelData: peaks,
    barIndexScale: config.barIndexScale,
    barSpacing: config.barSpacing,
    barWidth: config.barWidth,
    halfHeight: config.halfHeight,
    vScale,
    canvasHeight: height,
    barAlign: undefined,
    barMinHeight: config.barMinHeight,
  });

  ctx.beginPath();
  for (const seg of segments) {
    ctx.rect(seg.x, seg.y, seg.width, seg.height);
  }
  ctx.fill();
  ctx.closePath();
}

/**
 * Injects a `<style>` into WaveSurfer's shadow DOM to disable the
 * progress/clip-path split. Without this, `renderProgress` clip-paths the
 * canvasWrapper each frame, causing color artifacts.
 */
export function disableProgressSplit(ws: WaveSurfer) {
  const shadowRoot = ws.getWrapper().getRootNode() as ShadowRoot;
  const style = document.createElement('style');
  style.textContent =
    '.canvases { clip-path: none !important; } .progress { display: none !important; }';
  shadowRoot.appendChild(style);
}

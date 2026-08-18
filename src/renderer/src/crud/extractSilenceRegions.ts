import type { IRegion, IRegionParams } from './useWavesurferRegions';

const roundToFiveDecimals = (n: number) => Math.round(n * 100000) / 100000;

export const SEGMENT_PEAKS_MIN = 512;
export const SEGMENT_PEAKS_MAX = 512 * 16;

export function segmentPeakCount(
  durationSec: number,
  minSeconds: number
): number {
  return Math.min(
    Math.max(Math.floor(durationSec / minSeconds), SEGMENT_PEAKS_MIN),
    SEGMENT_PEAKS_MAX
  );
}

/** Silence-based auto-segment. `peaks` must cover the full duration (coef = duration / length). */
export function extractSilenceRegions(
  peaks: ArrayLike<number>,
  durationSec: number,
  params: IRegionParams
): IRegion[] {
  const minValue = params.silenceThreshold || 0.002;
  const minSeconds = params.timeThreshold || 0.05;
  const minRegionLenSeconds = params.segLenThreshold || 0.5;

  const length = peaks.length;
  if (!length || durationSec <= 0) return [];

  const coef = durationSec / length;
  const minLenSilence = Math.ceil(minSeconds / coef);

  const silences: number[] = [];
  for (let index = 0; index < length; index++) {
    if (Math.abs(peaks[index] ?? 0) < minValue) {
      silences.push(index);
    }
  }

  const clusters: number[][] = [];
  silences.forEach(function (val, index) {
    if (clusters.length && val === silences[index - 1] + 1) {
      clusters[clusters.length - 1].push(val);
    } else {
      clusters.push([val]);
    }
  });

  const fClusters = clusters.filter(function (cluster) {
    return cluster.length >= minLenSilence;
  });

  const regions = fClusters.map(function (cluster, index) {
    const next = fClusters[index + 1];
    return {
      start: cluster[cluster.length - 1] + 1,
      end: next ? next[0] - 1 : length,
    };
  });

  const tRegions = regions.map(function (reg) {
    return {
      start: roundToFiveDecimals(reg.start * coef),
      end: roundToFiveDecimals(reg.end * coef),
    };
  });

  if (tRegions.length > 0) {
    const firstRegion = tRegions[0];
    if (firstRegion.start !== 0) {
      tRegions.unshift({
        start: 0,
        end: firstRegion.start,
      });
    }
  }

  const sRegions = tRegions.map(function (reg, index) {
    const next = tRegions[index + 1];
    return {
      start: reg.start,
      end: next ? next.start : durationSec,
    };
  });
  let ix = 0;
  while (ix < sRegions.length - 1) {
    if (sRegions[ix].end - sRegions[ix].start < minRegionLenSeconds) {
      sRegions[ix].end = sRegions[ix + 1].end;
      sRegions.splice(ix + 1, 1);
    } else {
      ix += 1;
    }
  }
  if (sRegions.length > 0) {
    if (
      sRegions[sRegions.length - 1].end - sRegions[sRegions.length - 1].start <
      minRegionLenSeconds
    )
      sRegions.splice(-1, 1);
    if (sRegions.length > 0) {
      sRegions[sRegions.length - 1].end = durationSec;
    }
  }

  return sRegions;
}

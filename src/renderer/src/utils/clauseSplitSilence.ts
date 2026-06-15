import { IRegion, IRegionParams } from '../crud/useWavesurferRegions';

const roundToFiveDecimals = (n: number) => Math.round(n * 100000) / 100000;

/** Silence clusters touching the clause start or end are not valid split points. */
export const CLAUSE_EDGE_SILENCE_THRESHOLD_SEC = 0.1;

function clusterSilenceIndices(silences: number[]): number[][] {
  const clusters: number[][] = [];
  silences.forEach((val, index) => {
    if (clusters.length && val === silences[index - 1] + 1) {
      clusters[clusters.length - 1].push(val);
    } else {
      clusters.push([val]);
    }
  });
  return clusters;
}

/**
 * Finds the time (seconds) to split a clause at the midpoint of the longest
 * internal silence. Uses the step's silence threshold for detection but does
 * not require a minimum silence duration — any internal dip qualifies.
 */
export function findClauseSplitPoint(
  peaks: ArrayLike<number>,
  duration: number,
  clause: IRegion,
  params: IRegionParams,
  edgeThresholdSec = CLAUSE_EDGE_SILENCE_THRESHOLD_SEC
): number | undefined {
  if (duration <= 0 || peaks.length === 0) return undefined;

  const minValue = params.silenceThreshold * 10 || 0.02;
  const minRegionLenSeconds = params.segLenThreshold || 0.5;

  const length = peaks.length;
  const coef = duration / length;

  const clauseStartIdx = Math.max(0, Math.ceil(clause.start / coef));
  const clauseEndIdx = Math.min(length - 1, Math.floor(clause.end / coef));

  const silences: number[] = [];
  for (let index = clauseStartIdx; index <= clauseEndIdx; index++) {
    if (Math.abs(peaks[index]) < minValue) {
      silences.push(index);
    }
  }

  const internalClusters = clusterSilenceIndices(silences).filter((cluster) => {
    const silenceStart = cluster[0] * coef;
    const silenceEnd = (cluster[cluster.length - 1] + 1) * coef;
    const touchesStart = silenceStart <= clause.start + edgeThresholdSec;
    const touchesEnd = silenceEnd >= clause.end - edgeThresholdSec;
    return !touchesStart && !touchesEnd;
  });

  if (internalClusters.length === 0) return undefined;

  let longest = internalClusters[0];
  for (const cluster of internalClusters) {
    if (cluster.length > longest.length) {
      longest = cluster;
    }
  }

  const splitPoint = roundToFiveDecimals(
    ((longest[0] + longest[longest.length - 1] + 1) / 2) * coef
  );

  const firstLen = splitPoint - clause.start;
  const secondLen = clause.end - splitPoint;
  if (firstLen < minRegionLenSeconds || secondLen < minRegionLenSeconds) {
    return undefined;
  }

  if (splitPoint <= clause.start || splitPoint >= clause.end) {
    return undefined;
  }

  return splitPoint;
}

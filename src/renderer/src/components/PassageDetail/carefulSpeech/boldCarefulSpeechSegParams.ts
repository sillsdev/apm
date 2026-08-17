import { IRegionParams } from '../../../crud/useWavesurferRegions';

/** BOLD Careful Speech auto-segment defaults (WSSegmentParameters UI scale). */
export const boldDefaultSegParams: IRegionParams = {
  silenceThreshold: 0.002,
  timeThreshold: 0.02,
  segLenThreshold: 1.5,
};

const THRESHOLD_MIN = 0.001;
const THRESHOLD_MAX = 0.05;
const THRESHOLD_DELTA = 0.001;
const LENGTH_MIN = 0.05;
const LENGTH_MAX = 8;
const LENGTH_DELTA = 0.5;

export function applyMoreClauses(
  params: IRegionParams,
  changeLength: boolean
): IRegionParams {
  if (changeLength) {
    return {
      ...params,
      segLenThreshold: Math.max(
        LENGTH_MIN,
        params.segLenThreshold - LENGTH_DELTA
      ),
    };
  }
  return {
    ...params,
    silenceThreshold: Math.min(
      THRESHOLD_MAX,
      params.silenceThreshold + THRESHOLD_DELTA
    ),
  };
}

/** Opposite of More Clauses — longer minimum segment, lower silence threshold. */
export function applyFewerClauses(
  params: IRegionParams,
  changeLength: boolean
): IRegionParams {
  if (changeLength) {
    return {
      ...params,
      segLenThreshold: Math.min(
        LENGTH_MAX,
        params.segLenThreshold + LENGTH_DELTA
      ),
    };
  }
  return {
    ...params,
    silenceThreshold: Math.max(
      THRESHOLD_MIN,
      params.silenceThreshold - THRESHOLD_DELTA
    ),
  };
}

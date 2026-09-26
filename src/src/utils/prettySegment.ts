import { IRegion } from '../crud/useWavesurferRegions';

const onePlace = (n: number): string => (Math.round(n * 10) / 10).toFixed(1);

export const prettySegment = (region: IRegion | undefined | string): string => {
  let rgn: IRegion | undefined = undefined;
  if (typeof region === 'string') {
    if (region) rgn = JSON.parse(region) as IRegion;
  } else rgn = region;
  if (rgn?.start !== undefined)
    return `${onePlace(rgn.start)}-${onePlace(rgn.end)} `;
  return '';
};

export const prettySegmentStart = (
  region: IRegion | undefined | string
): string => {
  let rgn: IRegion | undefined = undefined;
  if (typeof region === 'string') {
    if (region) rgn = JSON.parse(region) as IRegion;
  } else rgn = region;
  if (rgn) return onePlace(rgn.start).padStart(8, ' ');
  return '';
};

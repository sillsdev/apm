import { IRegion } from '../../../crud/useWavesurferRegions';

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export const formatClauseRange = (region: IRegion | undefined) => {
  if (!region) return '—';
  return `${formatTime(region.start)} - ${formatTime(region.end)}`;
};

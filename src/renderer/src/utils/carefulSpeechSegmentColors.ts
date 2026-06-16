import { type RefObject } from 'react';
import { type ApplyRegionColor } from '../crud/useWavesurferRegions';

/** Waveform colors for Careful Speech (completed / current / pending). */

export const CAREFUL_SPEECH_COMPLETED_RGBA = 'rgba(76, 175, 80, 0.35)';
export const CAREFUL_SPEECH_CURRENT_RGBA = 'rgba(255, 235, 59, 0.5)';
export const CAREFUL_SPEECH_PENDING_RGBA = 'rgba(158, 158, 158, 0.22)';

export const getCarefulSpeechCompletedColor = () =>
  CAREFUL_SPEECH_COMPLETED_RGBA;
export const getCarefulSpeechCurrentColor = () => CAREFUL_SPEECH_CURRENT_RGBA;
export const getCarefulSpeechPendingColor = () => CAREFUL_SPEECH_PENDING_RGBA;

export interface ICarefulSpeechColorStatus {
  currentIndex: number;
  isCompleted: (regionIndex: number) => boolean;
}

export const getCarefulSpeechRegionBaseColor = (
  regionIndex: number,
  status: ICarefulSpeechColorStatus
) => {
  if (status.isCompleted(regionIndex)) return getCarefulSpeechCompletedColor();
  return getCarefulSpeechPendingColor();
};

export const createCarefulSpeechApplyRegionColor = (
  statusRef: RefObject<ICarefulSpeechColorStatus | null>
): ApplyRegionColor => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (role, regionIndex, _regionCount) => {
    if (role === 'current') return getCarefulSpeechCurrentColor();
    if (role === 'new') return getCarefulSpeechPendingColor();
    const status = statusRef.current;
    if (!status) return getCarefulSpeechPendingColor();
    return getCarefulSpeechRegionBaseColor(regionIndex, status);
  };
};

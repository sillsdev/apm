import { formatTime } from './formatTime';

/** Half the recording plus 15 seconds, rounded. Same ~m:ss shape as download. */
export function estimateAiTimeLabel(durationSeconds: number): string {
  const seconds = Math.round(durationSeconds * 0.5 + 15);
  return `~${formatTime(seconds)}`;
}

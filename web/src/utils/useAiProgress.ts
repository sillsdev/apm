import { useEffect, useState } from 'react';

/** The bar stops short of full so it never looks done before the result is. */
export const AI_PROGRESS_MAX_FRACTION = 0.95;
const TICK_MS = 1000;

export type AiProgress =
  | {
      status: 'estimating';
      elapsedSec: number;
      remainingSec: number;
      fraction: number;
    }
  /** Ran past the estimate, or there was no estimate to run against. */
  | { status: 'overrun' | 'unknown'; elapsedSec: number };

export function aiProgressAt(
  estimateSec: number | undefined,
  elapsedSec: number
): AiProgress {
  if (estimateSec === undefined || estimateSec <= 0)
    return { status: 'unknown', elapsedSec };
  if (elapsedSec > estimateSec) return { status: 'overrun', elapsedSec };
  return {
    status: 'estimating',
    elapsedSec,
    remainingSec: Math.ceil(estimateSec - elapsedSec),
    fraction: Math.min(AI_PROGRESS_MAX_FRACTION, elapsedSec / estimateSec),
  };
}

/** Re-renders once a second with progress against `estimateSec`. */
export function useAiProgress(
  estimateSec: number | undefined,
  startedAt: number
): AiProgress {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return aiProgressAt(estimateSec, Math.max(0, (now - startedAt) / 1000));
}

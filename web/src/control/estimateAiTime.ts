import { LocalKey } from '../utils/localUserKey';

/**
 * TT-6276: AI time estimates learned from how long recent requests took on
 * this device. Only the total time is measured: Aero doesn't yet report when a
 * job leaves the queue, so pending and fulfilling time can't be split
 * (`pendingMs` is reserved for that).
 */
export type AiEstimateKey =
  'noiseremoval' | 'voiceconversion' | `transcription:${string}`;

export interface AiTimingSample {
  durationSec: number;
  totalMs: number;
  pendingMs?: number;
  at: number;
}

export const AI_SAMPLE_WINDOW = 50;
export const AI_MIN_SAMPLES = 5;
/** Below this spread of durations the slope can't be fitted reliably. */
const MIN_DURATION_SPREAD_SEC = 1;

/** Half the recording plus 15 seconds. Used until enough samples exist. */
export function fallbackEstimateSeconds(durationSec: number): number {
  return Math.round(durationSec * 0.5 + 15);
}

/** Nearest-rank 95th percentile. Wait times are skewed by cold starts, so
 * this covers 95% of requests where mean + 2 SD would not. */
export function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1] ?? 0;
}

const mean = (values: number[]) =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

const capped = (seconds: number, capSec?: number) =>
  Math.round(capSec === undefined ? seconds : Math.min(seconds, capSec));

/** Fit total = a + b·duration, then add the p95 of how far requests ran
 * over the line. a is the startup overhead, b the time per second of audio. */
export function estimateFromSamples(
  samples: AiTimingSample[],
  durationSec: number,
  capSec?: number
): number {
  const xs = samples.map((s) => s.durationSec);
  const ys = samples.map((s) => s.totalMs / 1000);
  const mx = mean(xs);
  const my = mean(ys);
  const sxx = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  if (Math.sqrt(sxx / xs.length) < MIN_DURATION_SPREAD_SEC)
    return capped(p95(ys), capSec);
  const sxy = xs.reduce((sum, x, i) => sum + (x - mx) * ((ys[i] ?? 0) - my), 0);
  let b = Math.max(0, sxy / sxx);
  let a = my - b * mx;
  if (a < 0) {
    // Refit through the origin so the line still follows the data.
    a = 0;
    const sumXY = xs.reduce((sum, x, i) => sum + x * (ys[i] ?? 0), 0);
    b = sumXY / xs.reduce((sum, x) => sum + x * x, 0);
  }
  const residuals = xs.map((x, i) => (ys[i] ?? 0) - (a + b * x));
  return capped(a + b * durationSec + Math.max(0, p95(residuals)), capSec);
}

const storageKey = (key: AiEstimateKey) => `${LocalKey.aiTiming}-${key}`;

const isSample = (value: unknown): value is AiTimingSample => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Number.isFinite(v.durationSec) &&
    Number.isFinite(v.totalMs) &&
    Number.isFinite(v.at) &&
    (v.pendingMs === undefined || Number.isFinite(v.pendingMs))
  );
};

/** Samples live per device, not per user: upload time belongs to the
 * device's connection. Missing or corrupt storage reads as no samples. */
export function readAiSamples(key: AiEstimateKey): AiTimingSample[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(storageKey(key)) ?? '[]'
    );
    return Array.isArray(parsed) ? parsed.filter(isSample) : [];
  } catch {
    return [];
  }
}

export function recordAiSample(
  key: AiEstimateKey,
  sample: AiTimingSample
): void {
  const samples = [...readAiSamples(key), sample].slice(-AI_SAMPLE_WINDOW);
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(samples));
  } catch {
    // Storage full or blocked: the estimate falls back to the formula.
  }
}

export function estimateAiSeconds(
  key: AiEstimateKey,
  durationSec: number,
  capSec?: number
): number {
  const samples = readAiSamples(key);
  return samples.length < AI_MIN_SAMPLES
    ? capped(fallbackEstimateSeconds(durationSec), capSec)
    : estimateFromSamples(samples, durationSec, capSec);
}

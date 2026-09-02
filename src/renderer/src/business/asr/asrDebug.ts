/** Enable in DevTools: localStorage.setItem('TT_ASR_DEBUG', '1') */
export const ASR_DEBUG_KEY = 'TT_ASR_DEBUG';

let announced = false;

export function isAsrDebugEnabled(): boolean {
  try {
    return localStorage.getItem(ASR_DEBUG_KEY) === '1';
  } catch {
    return false;
  }
}

/** Truncate long strings (e.g. transcription text) for console output. */
export function asrDebugPreview(value: unknown, maxLen = 120): unknown {
  if (typeof value !== 'string') return value;
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}… (${value.length} chars)`;
}

export function asrDebug(
  event: string,
  detail?: Record<string, unknown>
): void {
  if (!isAsrDebugEnabled()) return;
  if (!announced) {
    announced = true;
    console.info(
      `[ASR] debug enabled — disable with localStorage.removeItem('${ASR_DEBUG_KEY}')`
    );
  }
  console.log('[ASR]', event, {
    t: new Date().toISOString(),
    ...detail,
  });
}

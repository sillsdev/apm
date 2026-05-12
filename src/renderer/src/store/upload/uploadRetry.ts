export const UPLOAD_MAX_ATTEMPTS = 5;

/** Base delay in ms; grows exponentially with attempt index. */
export const uploadRetryDelayMs = (attemptIndexZeroBased: number): number => {
  const base = 400;
  const cap = 8000;
  const exp = Math.min(cap, base * 2 ** attemptIndexZeroBased);
  const jitter = Math.floor(Math.random() * 250);
  return exp + jitter;
};

export const sleepMs = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

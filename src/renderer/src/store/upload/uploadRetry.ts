export const UPLOAD_MAX_ATTEMPTS = 5;

/** Per-attempt S3 PUT timeout from file size (ponytail: assumes ≥500 KB/s; cap 30 min). */
export const uploadPutTimeoutMs = (fileBytes: number): number => {
  const minMs = 5 * 60 * 1000;
  const capMs = 30 * 60 * 1000;
  const estimatedMs = Math.ceil(fileBytes / 500000) * 1000;
  return Math.min(capMs, Math.max(minMs, estimatedMs));
};

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

const axiosHttpStatus = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: number } }).response
      ?.status;
    if (typeof status === 'number') return status;
  }
  return undefined;
};

const uploadErrorHttpStatus = (error: unknown): number | undefined => {
  if (error && typeof error === 'object') {
    const withHttp = error as { httpStatus?: number; statusNum?: number };
    if (typeof withHttp.httpStatus === 'number') return withHttp.httpStatus;
    if (
      typeof withHttp.statusNum === 'number' &&
      withHttp.statusNum >= 100 &&
      withHttp.statusNum < 600
    ) {
      return withHttp.statusNum;
    }
  }
  return axiosHttpStatus(error);
};

/** Permanent client/auth failures should not burn through upload retry budget. */
export const isRetryableUploadError = (error: unknown): boolean => {
  const status = uploadErrorHttpStatus(error);
  if (status === undefined) return true;
  if (status === 0) return true;
  if (status === 408 || status === 429) return true;
  if (status >= 500) return true;
  if (status >= 400 && status < 500) return false;
  return true;
};

export async function runWithUploadRetries<T>(
  runAttempt: (attemptIndexZeroBased: number) => Promise<T>,
  onRetry?: (error: unknown, attemptIndexZeroBased: number) => void
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS; attempt++) {
    try {
      return await runAttempt(attempt);
    } catch (error: unknown) {
      lastError = error;
      if (!isRetryableUploadError(error)) throw error;
      if (attempt < UPLOAD_MAX_ATTEMPTS - 1) {
        onRetry?.(error, attempt);
        await sleepMs(uploadRetryDelayMs(attempt));
      }
    }
  }
  throw lastError ?? new Error('upload failed');
}

/** First-login ImportTab sync (`importSyncFromElectron`) holds `importexportBusy` until uploads finish. */
export const IMPORT_EXPORT_BUSY_POLL_MS = 400;
export const IMPORT_EXPORT_BUSY_MAX_WAIT_MS = 30 * 60 * 1000;

export async function waitForImportExportIdle(
  getBusy: () => boolean
): Promise<void> {
  const deadline = Date.now() + IMPORT_EXPORT_BUSY_MAX_WAIT_MS;
  while (getBusy() && Date.now() < deadline) {
    await sleepMs(IMPORT_EXPORT_BUSY_POLL_MS);
  }
}

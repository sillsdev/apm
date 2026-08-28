export const UPLOAD_MAX_ATTEMPTS = 5;

/** Per-attempt S3 PUT timeout from file size (assumes ≥500 KB/s; cap 30 min). */
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
  return isRetryableUploadStatus(status);
};

export const isRetryableUploadStatus = (
  status: number | undefined
): boolean => {
  if (status === undefined) return true;
  if (status === 0) return true;
  if (status === 408 || status === 429) return true;
  if (status >= 500) return true;
  if (status >= 400 && status < 500) return false;
  return true;
};

/**
 * Why an upload item failed. Named rather than a status number because the local
 * rejections never reach the server and so have no status at all — and `undefined`
 * already means "never got a response" to {@link isRetryableUploadStatus}.
 */
export enum UploadFailureReason {
  /** File type we refuse to upload. */
  UnsupportedType = 'unsupportedType',
  /** Over the size limit for this upload type. */
  TooBig = 'tooBig',
  /** Offline staging to the local media folder failed. */
  LocalWriteFailed = 'localWriteFailed',
  /** Server answered 4xx — it heard us and said no. */
  Rejected = 'rejected',
  /** Server answered 5xx — reachable, but failing. */
  ServerError = 'serverError',
  /** The request was sent but timed out waiting. */
  Timeout = 'timeout',
  /** Never reached the server at all. */
  NoResponse = 'noResponse',
}

/** Why an upload item failed, so callers can tell a connection problem from a rejected file. */
export interface UploadFailureInfo {
  reason: UploadFailureReason;
  /** HTTP status of the last attempt; undefined when the request never reached the server. */
  statusNum?: number;
}

/** Classify the status of a failed server round-trip. */
export const uploadFailureReasonFromStatus = (
  status: number | undefined
): UploadFailureReason => {
  if (status === undefined || status === 0)
    return UploadFailureReason.NoResponse;
  // 408 here is our own XHR timeout (see uploadFile), not a server-sent status.
  if (status === 408) return UploadFailureReason.Timeout;
  if (status >= 500) return UploadFailureReason.ServerError;
  if (status >= 400 && status < 500) return UploadFailureReason.Rejected;
  return UploadFailureReason.ServerError;
};

/**
 * Does this failure look like the user's connection, rather than the file or the
 * server? Only a request that never completed is evidence of that: a 4xx/5xx means
 * we reached the server, and a locally rejected file never involved the network.
 * No failure info at all is not evidence either, so stay quiet.
 */
export const suggestsConnectionProblem = (
  failure: UploadFailureInfo | undefined
): boolean =>
  failure?.reason === UploadFailureReason.NoResponse ||
  failure?.reason === UploadFailureReason.Timeout;

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

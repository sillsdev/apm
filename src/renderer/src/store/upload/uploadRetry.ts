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

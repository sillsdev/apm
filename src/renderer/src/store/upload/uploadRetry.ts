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

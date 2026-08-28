/** Same ArrayBuffer identity ⇒ already started (Strict Mode remount). */
export const shouldStartItfSyncUpload = (
  buffer: Buffer | undefined,
  lastStarted: Buffer | undefined
): buffer is Buffer => Boolean(buffer) && buffer !== lastStarted;

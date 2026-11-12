/** Stop the recorder and keep any audio already captured. Always cleanup. */
export async function finalizeRecordingOnDeviceLoss(
  recorder: { stop(): Promise<Blob>; cleanup(): void } | undefined,
  wasRecording: boolean
): Promise<Blob | undefined> {
  if (!recorder) return undefined;
  let blob: Blob | undefined;
  if (wasRecording) {
    try {
      const stopped = await recorder.stop();
      if (stopped.size > 0) blob = stopped;
    } catch {
      // UI still stops via onError; the take is gone if stop cannot flush.
    }
  }
  try {
    recorder.cleanup();
  } catch {
    /* AudioContext may already be shut down */
  }
  return blob;
}

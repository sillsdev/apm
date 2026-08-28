export const CAPTURE_DEVICE_LOSS_RETRY_MS = 250;

export function buildCaptureConstraints(
  deviceId: string | undefined,
  echoCancellation: boolean,
  noiseSuppression: boolean
): MediaStreamConstraints {
  const supported =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getSupportedConstraints === 'function'
      ? navigator.mediaDevices.getSupportedConstraints()
      : ({} as MediaTrackSupportedConstraints);

  const audio: MediaTrackConstraints = {
    autoGainControl: false,
    sampleRate: 48000,
    channelCount: 1,
  };

  if (deviceId) {
    // A bare string is only { ideal }; Chromium may keep the OS-default input
    // (headset) instead of the microphone the user picked.
    audio.deviceId = { exact: deviceId };
  }

  if (supported.echoCancellation) {
    audio.echoCancellation = echoCancellation;
  }
  if (supported.noiseSuppression) {
    audio.noiseSuppression = noiseSuppression;
  }

  return { audio, video: false };
}

export function constraintsWithoutDeviceId(
  constraints: MediaStreamConstraints
): MediaStreamConstraints {
  const audio = constraints.audio;
  if (!audio || typeof audio === 'boolean') return constraints;
  const { deviceId: _ignored, ...audioRest } = audio;
  return { ...constraints, audio: audioRest };
}

export function isUnusableCaptureStream(stream?: MediaStream | null): boolean {
  if (!stream) return true;
  if (!stream.active) return true;
  const tracks = stream.getAudioTracks();
  return (
    tracks.length === 0 || tracks.every((track) => track.readyState !== 'live')
  );
}

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const e = error as { name?: string; message?: string; error?: string };
  return `${e.name ?? ''} ${e.message ?? ''} ${e.error ?? ''}`;
}

/** Headset/USB unplug: Chromium tears down the audio IPC. */
export function isDeviceLossError(error: unknown): boolean {
  const text = errorText(error);
  if (/shutdown/i.test(text)) return true;
  return (error as { name?: string } | undefined)?.name === 'NotReadableError';
}

function requestedExactDeviceId(constraints: MediaStreamConstraints): boolean {
  const audio = constraints.audio;
  if (!audio || typeof audio === 'boolean') return false;
  const id = audio.deviceId;
  return (
    typeof id === 'object' && id !== null && 'exact' in id && Boolean(id.exact)
  );
}

function isRecoverableCaptureError(error: unknown): boolean {
  if (isDeviceLossError(error)) return true;
  if (!error || typeof error !== 'object') return false;
  const { name, constraint } = error as {
    name?: string;
    constraint?: string;
  };
  if (name !== 'OverconstrainedError') return false;
  return constraint === 'deviceId' || constraint == null || constraint === '';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getUserMediaWithDeviceFallback(
  constraints: MediaStreamConstraints,
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
  wait: (ms: number) => Promise<void> = delay
): Promise<MediaStream> {
  try {
    return await getUserMedia(constraints);
  } catch (error) {
    if (!isRecoverableCaptureError(error)) {
      throw error;
    }
    const retryConstraints = requestedExactDeviceId(constraints)
      ? constraintsWithoutDeviceId(constraints)
      : constraints;
    if (isDeviceLossError(error)) {
      await wait(CAPTURE_DEVICE_LOSS_RETRY_MS);
    }
    return await getUserMedia(retryConstraints);
  }
}

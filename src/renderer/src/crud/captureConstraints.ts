export const CAPTURE_DEVICE_LOSS_RETRY_MS = 250;

export class CaptureDeviceLostError extends Error {
  readonly deviceLost = true as const;

  constructor(cause?: unknown) {
    const message =
      cause && typeof cause === 'object' && 'message' in cause
        ? String((cause as { message?: unknown }).message)
        : 'microphone disconnected';
    super(message);
    this.name = 'CaptureDeviceLostError';
  }
}

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

export function captureStreamDeviceId(stream: MediaStream): string | undefined {
  if (typeof stream.getAudioTracks !== 'function') return undefined;
  const id = stream.getAudioTracks()[0]?.getSettings?.().deviceId;
  return id || undefined;
}

/** If the saved input is gone, the deviceId to select instead (usually the first remaining mic). */
export function fallbackInputDeviceId(
  inputs: Pick<MediaDeviceInfo, 'deviceId'>[],
  selectedId: string | undefined
): string | undefined {
  if (!selectedId) return undefined;
  if (!inputs.some((device) => device.deviceId)) return undefined;
  if (inputs.some((device) => device.deviceId === selectedId)) return undefined;
  return inputs[0]?.deviceId ?? '';
}

function stopCaptureStream(stream: MediaStream) {
  if (typeof stream.getTracks !== 'function') return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      /* already gone */
    }
  });
}

async function requestedCaptureDeviceMissing(
  requestedDeviceId: string | undefined
): Promise<boolean> {
  if (!requestedDeviceId) return false;
  if (typeof navigator.mediaDevices?.enumerateDevices !== 'function') {
    return false;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return (
      fallbackInputDeviceId(
        devices.filter((device) => device.kind === 'audioinput'),
        requestedDeviceId
      ) !== undefined
    );
  } catch {
    return false;
  }
}

export function isUnusableCaptureStream(stream?: MediaStream | null): boolean {
  if (!stream) return true;
  if (!stream.active) return true;
  if (typeof stream.getAudioTracks !== 'function') return false;
  const tracks = stream.getAudioTracks();
  return (
    tracks.length === 0 || tracks.every((track) => track.readyState !== 'live')
  );
}

/** True when a cached stream should be replaced: gone, or still muted after the short retry. */
export async function waitOutTransientCaptureMute(
  stream: MediaStream | undefined | null,
  wait: (ms: number) => Promise<void> = delay
): Promise<boolean> {
  if (isUnusableCaptureStream(stream)) return true;
  const track = stream!.getAudioTracks()[0];
  if (!track?.muted) return false;
  await wait(CAPTURE_DEVICE_LOSS_RETRY_MS);
  return isUnusableCaptureStream(stream) || Boolean(track.muted);
}

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const e = error as { name?: string; message?: string; error?: string };
  return `${e.name ?? ''} ${e.message ?? ''} ${e.error ?? ''}`;
}

function requestedExactDeviceId(
  constraints: MediaStreamConstraints
): string | undefined {
  const audio = constraints.audio;
  if (!audio || typeof audio === 'boolean') return undefined;
  const id = audio.deviceId;
  if (typeof id === 'object' && id !== null && 'exact' in id) {
    const exact = (id as ConstrainDOMStringParameters).exact;
    return typeof exact === 'string' && exact ? exact : undefined;
  }
  return undefined;
}

function isMissingDeviceError(
  error: unknown,
  constraints: MediaStreamConstraints
): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, constraint } = error as {
    name?: string;
    constraint?: string;
  };
  if (name === 'NotFoundError') return true;
  if (!requestedExactDeviceId(constraints)) return false;
  if (name !== 'OverconstrainedError') return false;
  return constraint === 'deviceId' || constraint == null || constraint === '';
}

/** Headset/USB unplug: Chromium tears down the audio IPC. */
export function isDeviceLossError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  if ((error as { deviceLost?: boolean }).deviceLost) return true;
  const { name } = error as { name?: string };
  if (name === 'CaptureDeviceLostError' || name === 'NotFoundError') {
    return true;
  }
  const text = errorText(error);
  if (/shutdown/i.test(text)) return true;
  return name === 'NotReadableError';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toDeviceLostError(cause?: unknown): CaptureDeviceLostError {
  return cause instanceof CaptureDeviceLostError
    ? cause
    : new CaptureDeviceLostError(cause);
}

export async function ensureCaptureStreamUsable(
  stream: MediaStream,
  constraints: MediaStreamConstraints,
  wait: (ms: number) => Promise<void> = delay
): Promise<void> {
  if (typeof stream.getAudioTracks !== 'function') return;
  if (isUnusableCaptureStream(stream)) throw toDeviceLostError();
  const track = stream.getAudioTracks()[0];
  if (!track) throw toDeviceLostError();
  const requested = requestedExactDeviceId(constraints);
  const actual = track.getSettings?.().deviceId;
  if (requested && actual && actual !== requested) throw toDeviceLostError();
  if (track.muted) {
    await wait(CAPTURE_DEVICE_LOSS_RETRY_MS);
    if (track.muted || track.readyState !== 'live') throw toDeviceLostError();
  }
  if (await requestedCaptureDeviceMissing(requested)) throw toDeviceLostError();
}

export function captureTrackIsLost(track?: MediaStreamTrack | null): boolean {
  if (!track) return true;
  return track.readyState !== 'live' || Boolean(track.muted);
}

/** Fires when the capture device is unplugged (`ended`) or stays muted during a take. */
export function listenForCaptureDeviceLoss(
  stream: MediaStream,
  onLost: () => void,
  isCapturing?: () => boolean
): () => void {
  if (typeof stream.getAudioTracks !== 'function') return () => undefined;
  const tracks = stream.getAudioTracks();
  const heardAudio = new WeakSet<MediaStreamTrack>();
  let muteConfirmTimer: ReturnType<typeof setTimeout> | undefined;

  const clearMuteConfirm = () => {
    if (muteConfirmTimer === undefined) return;
    clearTimeout(muteConfirmTimer);
    muteConfirmTimer = undefined;
  };

  const confirmLost = () => {
    clearMuteConfirm();
    onLost();
  };

  const onEnded = () => confirmLost();
  const onUnmute = (event: Event) => {
    const track = event.target as MediaStreamTrack | null;
    if (track) heardAudio.add(track);
    clearMuteConfirm();
  };
  const onMute = (event: Event) => {
    const track = event.target as MediaStreamTrack | null;
    if (!track) return;
    // Windows often mutes on unplug without a prior unmute. Idle muted-at-open
    // is handled by ensureCaptureStreamUsable; mute during a take may be
    // transient (AEC / Bluetooth) and is confirmed after a short wait.
    if (!(heardAudio.has(track) || isCapturing?.())) return;
    if (muteConfirmTimer !== undefined) return;
    muteConfirmTimer = setTimeout(() => {
      muteConfirmTimer = undefined;
      if (!(heardAudio.has(track) || isCapturing?.())) return;
      if (track.readyState !== 'live' || track.muted) onLost();
    }, CAPTURE_DEVICE_LOSS_RETRY_MS);
  };
  tracks.forEach((track) => {
    track.addEventListener('ended', onEnded);
    track.addEventListener('unmute', onUnmute);
    track.addEventListener('mute', onMute);
  });

  const onDeviceChange = () => {
    if (!isCapturing?.()) return;
    const track = stream.getAudioTracks()[0];
    if (!track || track.readyState !== 'live') {
      confirmLost();
      return;
    }
    const captureId = track.getSettings?.().deviceId;
    if (!captureId || !navigator.mediaDevices?.enumerateDevices) return;
    void navigator.mediaDevices.enumerateDevices().then((devices) => {
      if (!isCapturing?.()) return;
      if (
        fallbackInputDeviceId(
          devices.filter((device) => device.kind === 'audioinput'),
          captureId
        ) !== undefined
      ) {
        confirmLost();
      }
    });
  };
  navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);

  return () => {
    clearMuteConfirm();
    tracks.forEach((track) => {
      track.removeEventListener('ended', onEnded);
      track.removeEventListener('unmute', onUnmute);
      track.removeEventListener('mute', onMute);
    });
    navigator.mediaDevices?.removeEventListener?.(
      'devicechange',
      onDeviceChange
    );
  };
}

export async function getUserMediaWithDeviceFallback(
  constraints: MediaStreamConstraints,
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
  wait: (ms: number) => Promise<void> = delay
): Promise<{ stream: MediaStream; fellBack: boolean }> {
  const acquire = async (next: MediaStreamConstraints) => {
    const stream = await getUserMedia(next);
    try {
      await ensureCaptureStreamUsable(stream, next, wait);
      return stream;
    } catch (error) {
      stopCaptureStream(stream);
      throw error;
    }
  };

  try {
    return { stream: await acquire(constraints), fellBack: false };
  } catch (error) {
    if (
      !isDeviceLossError(error) &&
      !isMissingDeviceError(error, constraints)
    ) {
      throw error;
    }

    const hadExact = Boolean(requestedExactDeviceId(constraints));
    const shutdownRetry =
      isDeviceLossError(error) &&
      !(error instanceof CaptureDeviceLostError) &&
      !isMissingDeviceError(error, constraints);

    if (shutdownRetry) {
      await wait(CAPTURE_DEVICE_LOSS_RETRY_MS);
      try {
        return { stream: await acquire(constraints), fellBack: false };
      } catch {
        // Selected device is still gone; try the OS default below.
      }
    }

    if (!hadExact) {
      throw error instanceof CaptureDeviceLostError
        ? error
        : toDeviceLostError(error);
    }

    try {
      return {
        stream: await acquire(constraintsWithoutDeviceId(constraints)),
        fellBack: true,
      };
    } catch (fallbackError) {
      throw toDeviceLostError(fallbackError);
    }
  }
}

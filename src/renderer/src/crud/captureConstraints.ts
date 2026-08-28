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

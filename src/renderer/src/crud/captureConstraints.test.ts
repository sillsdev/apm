import {
  buildCaptureConstraints,
  CAPTURE_DEVICE_LOSS_RETRY_MS,
  constraintsWithoutDeviceId,
  getUserMediaWithDeviceFallback,
  isDeviceLossError,
  isUnusableCaptureStream,
} from './captureConstraints';

describe('buildCaptureConstraints', () => {
  it('requires the selected microphone instead of treating it as optional', () => {
    const constraints = buildCaptureConstraints(
      'computer-mic-id',
      false,
      false
    );
    const audio = constraints.audio as MediaTrackConstraints;
    expect(audio.deviceId).toEqual({ exact: 'computer-mic-id' });
  });

  it('omits deviceId when none is selected', () => {
    const constraints = buildCaptureConstraints(undefined, false, false);
    const audio = constraints.audio as MediaTrackConstraints;
    expect(audio.deviceId).toBeUndefined();
  });

  it('omits deviceId when the stored id is empty', () => {
    const constraints = buildCaptureConstraints('', false, false);
    const audio = constraints.audio as MediaTrackConstraints;
    expect(audio.deviceId).toBeUndefined();
  });
});

describe('isDeviceLossError', () => {
  it('recognizes Chromium audio shutdown after unplug', () => {
    expect(
      isDeviceLossError(
        Object.assign(new Error('The operation failed due to shutdown'), {
          name: 'AbortError',
        })
      )
    ).toBe(true);
    expect(isDeviceLossError(new Error('Failed due to shutdown'))).toBe(true);
  });

  it('recognizes NotReadableError', () => {
    expect(
      isDeviceLossError(
        Object.assign(new Error('Could not start audio source'), {
          name: 'NotReadableError',
        })
      )
    ).toBe(true);
  });

  it('ignores permission denial', () => {
    expect(
      isDeviceLossError(
        Object.assign(new Error('Permission denied'), {
          name: 'NotAllowedError',
        })
      )
    ).toBe(false);
  });
});

describe('isUnusableCaptureStream', () => {
  it('treats a missing or ended stream as unusable', () => {
    expect(isUnusableCaptureStream(undefined)).toBe(true);
    expect(
      isUnusableCaptureStream({
        active: false,
        getAudioTracks: () => [{ readyState: 'live' }],
      } as unknown as MediaStream)
    ).toBe(true);
    expect(
      isUnusableCaptureStream({
        active: true,
        getAudioTracks: () => [{ readyState: 'ended' }],
      } as unknown as MediaStream)
    ).toBe(true);
  });

  it('accepts a live stream', () => {
    expect(
      isUnusableCaptureStream({
        active: true,
        getAudioTracks: () => [{ readyState: 'live' }],
      } as unknown as MediaStream)
    ).toBe(false);
  });
});

describe('getUserMediaWithDeviceFallback', () => {
  const exactConstraints = buildCaptureConstraints('gone-mic', false, false);
  const defaultConstraints = buildCaptureConstraints(undefined, false, false);
  const fallbackStream = { id: 'os-default' } as MediaStream;
  const wait = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    wait.mockClear();
  });

  it('returns the first stream when the exact device is available', async () => {
    const wanted = { id: 'wanted' } as MediaStream;
    const getUserMedia = jest.fn().mockResolvedValue(wanted);
    await expect(
      getUserMediaWithDeviceFallback(exactConstraints, getUserMedia, wait)
    ).resolves.toBe(wanted);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('retries without deviceId when the exact device is gone', async () => {
    const overconstrained = Object.assign(new Error('OverconstrainedError'), {
      name: 'OverconstrainedError',
      constraint: 'deviceId',
    });
    const getUserMedia = jest
      .fn()
      .mockRejectedValueOnce(overconstrained)
      .mockResolvedValueOnce(fallbackStream);

    await expect(
      getUserMediaWithDeviceFallback(exactConstraints, getUserMedia, wait)
    ).resolves.toBe(fallbackStream);

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    const retry = getUserMedia.mock.calls[1][0] as MediaStreamConstraints;
    expect(retry).toEqual(constraintsWithoutDeviceId(exactConstraints));
    expect((retry.audio as MediaTrackConstraints).deviceId).toBeUndefined();
    expect(wait).not.toHaveBeenCalled();
  });

  it('retries after Chromium audio shutdown when a headset is unplugged', async () => {
    const shutdown = Object.assign(
      new Error('The operation failed due to shutdown'),
      { name: 'AbortError' }
    );
    const getUserMedia = jest
      .fn()
      .mockRejectedValueOnce(shutdown)
      .mockResolvedValueOnce(fallbackStream);

    await expect(
      getUserMediaWithDeviceFallback(exactConstraints, getUserMedia, wait)
    ).resolves.toBe(fallbackStream);

    expect(wait).toHaveBeenCalledWith(CAPTURE_DEVICE_LOSS_RETRY_MS);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[1][0]).toEqual(
      constraintsWithoutDeviceId(exactConstraints)
    );
  });

  it('retries the default device after shutdown when none was selected', async () => {
    const shutdown = new Error('Failed due to shutdown');
    const getUserMedia = jest
      .fn()
      .mockRejectedValueOnce(shutdown)
      .mockResolvedValueOnce(fallbackStream);

    await expect(
      getUserMediaWithDeviceFallback(defaultConstraints, getUserMedia, wait)
    ).resolves.toBe(fallbackStream);

    expect(wait).toHaveBeenCalledWith(CAPTURE_DEVICE_LOSS_RETRY_MS);
    expect(getUserMedia.mock.calls[1][0]).toBe(defaultConstraints);
  });

  it('does not retry permission failures', async () => {
    const denied = Object.assign(new Error('NotAllowedError'), {
      name: 'NotAllowedError',
    });
    const getUserMedia = jest.fn().mockRejectedValue(denied);
    await expect(
      getUserMediaWithDeviceFallback(exactConstraints, getUserMedia, wait)
    ).rejects.toBe(denied);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('does not drop the selected device for unrelated overconstraints', async () => {
    const sampleRate = Object.assign(new Error('OverconstrainedError'), {
      name: 'OverconstrainedError',
      constraint: 'sampleRate',
    });
    const getUserMedia = jest.fn().mockRejectedValue(sampleRate);
    await expect(
      getUserMediaWithDeviceFallback(exactConstraints, getUserMedia, wait)
    ).rejects.toBe(sampleRate);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });
});

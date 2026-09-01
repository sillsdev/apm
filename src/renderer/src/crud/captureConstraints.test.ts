import {
  buildCaptureConstraints,
  CAPTURE_DEVICE_LOSS_RETRY_MS,
  CaptureDeviceLostError,
  captureTrackIsLost,
  constraintsWithoutDeviceId,
  fallbackInputDeviceId,
  getUserMediaWithDeviceFallback,
  isDeviceLossError,
  isUnusableCaptureStream,
  listenForCaptureDeviceLoss,
  waitOutTransientCaptureMute,
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

  it('recognizes CaptureDeviceLostError', () => {
    expect(isDeviceLossError(new CaptureDeviceLostError())).toBe(true);
  });

  it('recognizes NotFoundError', () => {
    expect(
      isDeviceLossError(
        Object.assign(new Error('Requested device not found'), {
          name: 'NotFoundError',
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

  it('does not treat a live muted track as unusable', () => {
    expect(
      isUnusableCaptureStream({
        active: true,
        getAudioTracks: () => [{ readyState: 'live', muted: true }],
      } as unknown as MediaStream)
    ).toBe(false);
  });
});

describe('fallbackInputDeviceId', () => {
  it('returns the first remaining mic when the selected one is gone', () => {
    expect(
      fallbackInputDeviceId(
        [{ deviceId: 'laptop' }, { deviceId: 'usb' }],
        'headset'
      )
    ).toBe('laptop');
  });

  it('does nothing when the selected mic is still listed', () => {
    expect(
      fallbackInputDeviceId(
        [{ deviceId: 'headset' }, { deviceId: 'laptop' }],
        'headset'
      )
    ).toBeUndefined();
  });

  it('does nothing when device ids are still hidden (no permission yet)', () => {
    expect(
      fallbackInputDeviceId([{ deviceId: '' }, { deviceId: '' }], 'headset')
    ).toBeUndefined();
  });

  it('does nothing when nothing was selected', () => {
    expect(fallbackInputDeviceId([{ deviceId: 'laptop' }], '')).toBeUndefined();
    expect(
      fallbackInputDeviceId([{ deviceId: 'laptop' }], undefined)
    ).toBeUndefined();
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
    ).resolves.toEqual({ stream: wanted, fellBack: false });
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it('falls back to the OS default when the exact device is gone', async () => {
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
    ).resolves.toEqual({ stream: fallbackStream, fellBack: true });

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[1][0]).toEqual(
      constraintsWithoutDeviceId(exactConstraints)
    );
    expect(wait).not.toHaveBeenCalled();
  });

  it('retries the same device after Chromium audio shutdown', async () => {
    const shutdown = Object.assign(
      new Error('The operation failed due to shutdown'),
      { name: 'AbortError' }
    );
    const recovered = { id: 'same-mic' } as MediaStream;
    const getUserMedia = jest
      .fn()
      .mockRejectedValueOnce(shutdown)
      .mockResolvedValueOnce(recovered);

    await expect(
      getUserMediaWithDeviceFallback(exactConstraints, getUserMedia, wait)
    ).resolves.toEqual({ stream: recovered, fellBack: false });

    expect(wait).toHaveBeenCalledWith(CAPTURE_DEVICE_LOSS_RETRY_MS);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[1][0]).toBe(exactConstraints);
  });

  it('signals device loss when shutdown retry still cannot open the selected mic', async () => {
    const shutdown = new Error('Failed due to shutdown');
    const getUserMedia = jest.fn().mockRejectedValue(shutdown);

    await expect(
      getUserMediaWithDeviceFallback(exactConstraints, getUserMedia, wait)
    ).rejects.toBeInstanceOf(CaptureDeviceLostError);

    expect(wait).toHaveBeenCalledWith(CAPTURE_DEVICE_LOSS_RETRY_MS);
    expect(getUserMedia).toHaveBeenCalledTimes(3);
    expect(getUserMedia.mock.calls[1][0]).toBe(exactConstraints);
    expect(getUserMedia.mock.calls[2][0]).toEqual(
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
    ).resolves.toEqual({ stream: fallbackStream, fellBack: false });

    expect(wait).toHaveBeenCalledWith(CAPTURE_DEVICE_LOSS_RETRY_MS);
    expect(getUserMedia.mock.calls[1][0]).toBe(defaultConstraints);
  });

  it('signals device loss when the requested device is not found', async () => {
    const notFound = Object.assign(new Error('Requested device not found'), {
      name: 'NotFoundError',
    });
    const getUserMedia = jest
      .fn()
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce(fallbackStream);
    await expect(
      getUserMediaWithDeviceFallback(exactConstraints, getUserMedia, wait)
    ).resolves.toEqual({ stream: fallbackStream, fellBack: true });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('falls back to the default when the opened track stays muted', async () => {
    const muted = {
      id: 'ghost',
      active: true,
      getAudioTracks: () => [
        {
          readyState: 'live',
          muted: true,
          getSettings: () => ({ deviceId: 'gone-mic' }),
        },
      ],
    } as unknown as MediaStream;
    const getUserMedia = jest
      .fn()
      .mockResolvedValueOnce(muted)
      .mockResolvedValueOnce(fallbackStream);
    await expect(
      getUserMediaWithDeviceFallback(exactConstraints, getUserMedia, wait)
    ).resolves.toEqual({ stream: fallbackStream, fellBack: true });
    expect(wait).toHaveBeenCalledWith(CAPTURE_DEVICE_LOSS_RETRY_MS);
  });

  it('falls back when the exact device is missing from the device list after open', async () => {
    const track = {
      readyState: 'live',
      muted: false,
      getSettings: () => ({ deviceId: 'gone-mic' }),
      stop: jest.fn(),
    };
    const ghost = {
      id: 'ghost',
      active: true,
      getAudioTracks: () => [track],
      getTracks: () => [track],
    } as unknown as MediaStream;
    const getUserMedia = jest
      .fn()
      .mockResolvedValueOnce(ghost)
      .mockResolvedValueOnce(fallbackStream);
    const previous = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: jest
          .fn()
          .mockResolvedValue([{ kind: 'audioinput', deviceId: 'laptop-mic' }]),
      },
    });
    try {
      await expect(
        getUserMediaWithDeviceFallback(exactConstraints, getUserMedia, wait)
      ).resolves.toEqual({ stream: fallbackStream, fellBack: true });
      expect(track.stop).toHaveBeenCalled();
      expect(getUserMedia).toHaveBeenCalledTimes(2);
    } finally {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: previous,
      });
    }
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

describe('captureTrackIsLost', () => {
  it('treats a missing, ended, or muted track as lost', () => {
    expect(captureTrackIsLost(undefined)).toBe(true);
    expect(
      captureTrackIsLost({
        readyState: 'ended',
        muted: false,
      } as MediaStreamTrack)
    ).toBe(true);
    expect(
      captureTrackIsLost({
        readyState: 'live',
        muted: true,
      } as MediaStreamTrack)
    ).toBe(true);
    expect(
      captureTrackIsLost({
        readyState: 'live',
        muted: false,
      } as MediaStreamTrack)
    ).toBe(false);
  });
});

describe('waitOutTransientCaptureMute', () => {
  it('does not wait when the stream is live and unmuted', async () => {
    const wait = jest.fn();
    await expect(
      waitOutTransientCaptureMute(
        {
          active: true,
          getAudioTracks: () => [{ readyState: 'live', muted: false }],
        } as unknown as MediaStream,
        wait
      )
    ).resolves.toBe(false);
    expect(wait).not.toHaveBeenCalled();
  });

  it('replaces a stream that stays muted after the short retry', async () => {
    const wait = jest.fn().mockResolvedValue(undefined);
    await expect(
      waitOutTransientCaptureMute(
        {
          active: true,
          getAudioTracks: () => [{ readyState: 'live', muted: true }],
        } as unknown as MediaStream,
        wait
      )
    ).resolves.toBe(true);
    expect(wait).toHaveBeenCalledWith(CAPTURE_DEVICE_LOSS_RETRY_MS);
  });

  it('keeps a stream that unmutes during the wait', async () => {
    const track = { readyState: 'live', muted: true };
    const wait = jest.fn().mockImplementation(async () => {
      track.muted = false;
    });
    await expect(
      waitOutTransientCaptureMute(
        {
          active: true,
          getAudioTracks: () => [track],
        } as unknown as MediaStream,
        wait
      )
    ).resolves.toBe(false);
  });
});

describe('listenForCaptureDeviceLoss', () => {
  function trackWithListeners() {
    const listeners: Record<string, (event?: Event) => void> = {};
    const track = {
      muted: false,
      readyState: 'live',
      getSettings: () => ({ deviceId: 'headset' }),
      addEventListener: (type: string, fn: (event?: Event) => void) => {
        listeners[type] = fn;
      },
      removeEventListener: jest.fn(),
    };
    return { track, listeners };
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports when the capture track ends immediately', () => {
    const { track, listeners } = trackWithListeners();
    const onLost = jest.fn();
    const stop = listenForCaptureDeviceLoss(
      { getAudioTracks: () => [track] } as unknown as MediaStream,
      onLost
    );
    listeners.ended();
    expect(onLost).toHaveBeenCalledTimes(1);
    stop();
  });

  it('cancels mute confirmation when the track unmutes', () => {
    const { track, listeners } = trackWithListeners();
    const onLost = jest.fn();
    listenForCaptureDeviceLoss(
      { getAudioTracks: () => [track] } as unknown as MediaStream,
      onLost,
      () => true
    );
    track.muted = true;
    listeners.mute?.({ target: track } as unknown as Event);
    track.muted = false;
    listeners.unmute?.({ target: track } as unknown as Event);
    jest.advanceTimersByTime(CAPTURE_DEVICE_LOSS_RETRY_MS);
    expect(onLost).not.toHaveBeenCalled();
  });

  it('reports sustained mute during a take after the confirmation wait', () => {
    const { track, listeners } = trackWithListeners();
    const onLost = jest.fn();
    listenForCaptureDeviceLoss(
      { getAudioTracks: () => [track] } as unknown as MediaStream,
      onLost,
      () => true
    );
    track.muted = true;
    listeners.mute?.({ target: track } as unknown as Event);
    expect(onLost).not.toHaveBeenCalled();
    jest.advanceTimersByTime(CAPTURE_DEVICE_LOSS_RETRY_MS);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('ignores mute before a take when the track never unmuted', () => {
    const { track, listeners } = trackWithListeners();
    const onLost = jest.fn();
    listenForCaptureDeviceLoss(
      { getAudioTracks: () => [track] } as unknown as MediaStream,
      onLost,
      () => false
    );
    track.muted = true;
    listeners.mute?.({ target: track } as unknown as Event);
    jest.advanceTimersByTime(CAPTURE_DEVICE_LOSS_RETRY_MS);
    expect(onLost).not.toHaveBeenCalled();
  });

  it('reports immediately when enumeration shows the capture device is gone', async () => {
    const { track } = trackWithListeners();
    const onLost = jest.fn();
    const previous = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        enumerateDevices: jest
          .fn()
          .mockResolvedValue([{ kind: 'audioinput', deviceId: 'laptop' }]),
      },
    });
    try {
      listenForCaptureDeviceLoss(
        { getAudioTracks: () => [track] } as unknown as MediaStream,
        onLost,
        () => true
      );
      const onDeviceChange = (
        navigator.mediaDevices.addEventListener as jest.Mock
      ).mock.calls.find((call) => call[0] === 'devicechange')?.[1] as
        | (() => void)
        | undefined;
      onDeviceChange?.();
      await Promise.resolve();
      expect(onLost).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: previous,
      });
    }
  });
});

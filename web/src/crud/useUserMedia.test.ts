import { act, renderHook } from '@testing-library/react';
import { CaptureAcquireSupersededError, useUserMedia } from './useUserMedia';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeStream(id: string) {
  const track = {
    stop: jest.fn(),
    readyState: 'live',
    muted: false,
    getSettings: () => ({ deviceId: id }),
  };
  return {
    id,
    active: true,
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
}

describe('useUserMedia acquire generation', () => {
  let pending: ReturnType<typeof deferred<MediaStream>>[];

  beforeEach(() => {
    pending = [];
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: jest.fn(() => {
          const d = deferred<MediaStream>();
          pending.push(d);
          return d.promise;
        }),
        getSupportedConstraints: () => ({}),
        enumerateDevices: jest.fn().mockResolvedValue([]),
      },
    });
  });

  it('does not let an older getUserMedia overwrite the cached stream', async () => {
    const { result, rerender } = renderHook(
      ({ constraints }) => useUserMedia(constraints),
      {
        initialProps: {
          constraints: {
            audio: { deviceId: { exact: 'old' } },
            video: false,
          } as MediaStreamConstraints,
        },
      }
    );

    let first: Promise<{ stream: MediaStream; fellBack: boolean }>;
    act(() => {
      first = result.current(true);
    });
    expect(pending).toHaveLength(1);

    rerender({
      constraints: {
        audio: { deviceId: { exact: 'new' } },
        video: false,
      },
    });

    let second: Promise<{ stream: MediaStream; fellBack: boolean }>;
    act(() => {
      second = result.current(true);
    });
    expect(pending).toHaveLength(2);

    const oldStream = fakeStream('old');
    const newStream = fakeStream('new');

    const firstCaught = first!.then(
      () => {
        throw new Error('expected first acquire to be superseded');
      },
      (err: unknown) => err
    );
    await act(async () => {
      pending[0].resolve(oldStream);
    });
    expect(await firstCaught).toBeInstanceOf(CaptureAcquireSupersededError);
    expect(oldStream.getTracks()[0].stop).toHaveBeenCalled();

    await act(async () => {
      pending[1].resolve(newStream);
    });
    await expect(second!).resolves.toEqual({
      stream: newStream,
      fellBack: false,
    });

    await expect(result.current(false)).resolves.toEqual({
      stream: newStream,
      fellBack: false,
    });
    expect(oldStream.getTracks()[0].stop).toHaveBeenCalled();
    expect(newStream.getTracks()[0].stop).not.toHaveBeenCalled();
  });

  it('treats a stale failure as superseded so it cannot clear a newer acquire', async () => {
    const { result } = renderHook(() =>
      useUserMedia({ audio: true, video: false })
    );

    let first: Promise<{ stream: MediaStream; fellBack: boolean }>;
    let second: Promise<{ stream: MediaStream; fellBack: boolean }>;
    act(() => {
      first = result.current(true);
    });
    act(() => {
      second = result.current(true);
    });

    const latest = fakeStream('latest');
    const firstCaught = first!.then(
      () => {
        throw new Error('expected first acquire to be superseded');
      },
      (err: unknown) => err
    );
    await act(async () => {
      pending[0].reject(
        Object.assign(new Error('gone'), { name: 'NotFoundError' })
      );
    });
    expect(await firstCaught).toBeInstanceOf(CaptureAcquireSupersededError);

    await act(async () => {
      pending[1].resolve(latest);
    });
    await expect(second!).resolves.toEqual({
      stream: latest,
      fellBack: false,
    });
  });
});

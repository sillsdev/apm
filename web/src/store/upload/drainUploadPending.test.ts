jest.mock('./uploadPendingBlobs', () => ({
  isUploadPendingInFlight: (key: string) => key === 'busy',
}));

import { UploadType } from '../../components/UploadType';
import type { UploadPendingEntry } from './uploadPendingBlobs';
import { drainUploadPending, withProjectDrainLock } from './drainUploadPending';

const entry = (key: string): UploadPendingEntry => ({
  key,
  projectId: 'proj1',
  file: new File(['a'], `${key}.webm`),
  retryCount: 0,
  request: {
    uploadType: UploadType.Media,
    record: {} as UploadPendingEntry['request']['record'],
  },
});

describe('drainUploadPending', () => {
  it('does nothing for an empty queue', async () => {
    const upload = jest.fn();
    await drainUploadPending([], upload);
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads each entry in order, one at a time', async () => {
    const order: string[] = [];
    let running = 0;
    const upload = jest.fn(async (e: UploadPendingEntry) => {
      running += 1;
      expect(running).toBe(1);
      order.push(e.key);
      await Promise.resolve();
      running -= 1;
      return true;
    });

    await drainUploadPending([entry('a'), entry('b'), entry('c')], upload);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('stops at the first failure so the next online event resumes', async () => {
    const upload = jest.fn(async (e: UploadPendingEntry) => e.key !== 'b');

    await drainUploadPending([entry('a'), entry('b'), entry('c')], upload);
    expect(upload.mock.calls.map(([e]) => e.key)).toEqual(['a', 'b']);
  });

  it('skips an entry already uploading in this tab', async () => {
    const upload = jest.fn(async (_e: UploadPendingEntry) => true);

    await drainUploadPending([entry('busy'), entry('a')], upload);
    expect(upload.mock.calls.map(([e]) => e.key)).toEqual(['a']);
  });
});

describe('withProjectDrainLock', () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator'
  );
  afterEach(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    }
  });

  /** Web Locks where `held` names are taken by another tab. */
  const setLocks = (held: string[]) => {
    const request = jest.fn(
      async (
        name: string,
        _options: LockOptions,
        callback: (lock: Lock | null) => Promise<unknown>
      ) => callback(held.includes(name) ? null : ({ name } as Lock))
    );
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { locks: { request } },
    });
    return request;
  };

  it('drains while holding the project lock, only if it is free', async () => {
    const request = setLocks([]);
    const drain = jest.fn(async () => 'drained');

    await expect(withProjectDrainLock('p1', drain, 'skipped')).resolves.toBe(
      'drained'
    );
    expect(request).toHaveBeenCalledWith(
      'upload-pending-drain:p1',
      { ifAvailable: true },
      expect.any(Function)
    );
  });

  it('skips when another tab is draining the same project', async () => {
    setLocks(['upload-pending-drain:p1']);
    const drain = jest.fn(async () => 'drained');

    await expect(withProjectDrainLock('p1', drain, 'skipped')).resolves.toBe(
      'skipped'
    );
    expect(drain).not.toHaveBeenCalled();
  });

  it('still drains a different project', async () => {
    setLocks(['upload-pending-drain:p1']);
    await expect(
      withProjectDrainLock('p2', async () => 'drained', 'skipped')
    ).resolves.toBe('drained');
  });

  it('drains unlocked without Web Locks', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {},
    });
    await expect(
      withProjectDrainLock('p1', async () => 'drained', 'skipped')
    ).resolves.toBe('drained');
  });
});

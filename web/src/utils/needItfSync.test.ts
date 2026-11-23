import JSONAPISource from '@orbit/jsonapi';
import {
  clearNeedItfSync,
  markNeedItfSync,
  markNeedItfSyncOnDisconnect,
  needItfSync,
  prepareRemoteQueueForStartup,
  shouldRunItfSync,
} from './needItfSync';
import { LocalKey } from './localUserKey';

const mockLogError = jest.fn();
jest.mock('./logErrorService', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockLogError(...args),
  Severity: { error: 'error' },
}));
jest.mock('../auth/bugsnagClient', () => ({ __esModule: true, default: {} }));

describe('needItfSync', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is off until an online-linked user goes offline', () => {
    expect(needItfSync()).toBe(false);
    markNeedItfSync();
    expect(needItfSync()).toBe(true);
    expect(localStorage.getItem(LocalKey.needItfSync)).toBe('true');
  });

  it('does not export ITF on a normal online Electron start', () => {
    expect(
      shouldRunItfSync({
        isElectron: true,
        offline: false,
        needItf: needItfSync(),
      })
    ).toBe(false);
  });

  it('exports ITF only after an offline session when back online on Electron', () => {
    markNeedItfSync();
    expect(
      shouldRunItfSync({ isElectron: true, offline: false, needItf: true })
    ).toBe(true);
    expect(
      shouldRunItfSync({ isElectron: true, offline: true, needItf: true })
    ).toBe(false);
    expect(
      shouldRunItfSync({ isElectron: false, offline: false, needItf: true })
    ).toBe(false);
  });

  it('clears the flag when there is nothing to send or after a confirmed upload', () => {
    markNeedItfSync();
    clearNeedItfSync();
    expect(needItfSync()).toBe(false);
  });

  it('stays set after packaging so a failed or interrupted upload can retry', () => {
    markNeedItfSync();
    expect(needItfSync()).toBe(true);
    expect(
      shouldRunItfSync({ isElectron: true, offline: false, needItf: true })
    ).toBe(true);
  });
});

describe('prepareRemoteQueueForStartup (TT-7905)', () => {
  const makeRemote = (length: number) =>
    ({
      requestQueue: {
        length,
        empty: length === 0,
        skip: jest.fn().mockResolvedValue(undefined),
        clear: jest.fn().mockResolvedValue(undefined),
      },
    }) as unknown as JSONAPISource;

  it('keeps every queued offline edit when no ITF is being sent', async () => {
    const remote = makeRemote(3);
    await prepareRemoteQueueForStartup(remote, false);
    expect(remote.requestQueue.skip).not.toHaveBeenCalled();
    expect(remote.requestQueue.clear).not.toHaveBeenCalled();
  });

  it('clears the whole queue when an ITF holding those edits is being sent', async () => {
    const remote = makeRemote(3);
    await prepareRemoteQueueForStartup(remote, true);
    expect(remote.requestQueue.clear).toHaveBeenCalledTimes(1);
    // skip() drops only the first task; the rest would replay on top of the ITF.
    expect(remote.requestQueue.skip).not.toHaveBeenCalled();
  });

  it('clears even when the queue reports 0 before it is reified', async () => {
    const remote = makeRemote(0);
    await prepareRemoteQueueForStartup(remote, true);
    expect(remote.requestQueue.clear).toHaveBeenCalledTimes(1);
  });

  it('reports a failed clear instead of throwing', async () => {
    const remote = makeRemote(2);
    (remote.requestQueue.clear as jest.Mock).mockRejectedValueOnce(
      new Error('settling')
    );
    await expect(
      prepareRemoteQueueForStartup(remote, true)
    ).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalled();
  });

  it('does nothing without a remote', async () => {
    await expect(
      prepareRemoteQueueForStartup(undefined, true)
    ).resolves.toBeUndefined();
  });
});

describe('markNeedItfSyncOnDisconnect (TT-7905)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  const remote = (length: number) =>
    ({ requestQueue: { length } }) as unknown as JSONAPISource;

  it('marks ITF sync when Electron loses the network with queued edits', () => {
    markNeedItfSyncOnDisconnect({
      isElectron: true,
      offline: false,
      remote: remote(2),
    });
    expect(needItfSync()).toBe(true);
  });

  it('does not mark when the queue is empty', () => {
    markNeedItfSyncOnDisconnect({
      isElectron: true,
      offline: false,
      remote: remote(0),
    });
    expect(needItfSync()).toBe(false);
  });

  it('does not mark on web or in offline-only mode', () => {
    markNeedItfSyncOnDisconnect({
      isElectron: false,
      offline: false,
      remote: remote(2),
    });
    markNeedItfSyncOnDisconnect({
      isElectron: true,
      offline: true,
      remote: remote(2),
    });
    expect(needItfSync()).toBe(false);
  });
});

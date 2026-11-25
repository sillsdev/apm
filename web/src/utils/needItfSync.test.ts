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

describe('prepareRemoteQueueForStartup (TT-7905, TT-7911)', () => {
  const passageEdit = {
    type: 'update',
    data: {
      id: 't1',
      operations: [
        { op: 'replaceAttribute', record: { type: 'passage', id: 'p1' } },
      ],
    },
  };
  const teamRename = {
    type: 'update',
    data: {
      id: 't2',
      operations: [
        { op: 'updateRecord', record: { type: 'organization', id: 'o1' } },
      ],
    },
  };
  const makeRemote = (tasks: unknown[]) => {
    const queue = {
      autoProcess: true,
      reified: Promise.resolve(),
      entries: [...tasks],
      get length() {
        return queue.entries.length;
      },
      skip: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn(async () => {
        queue.entries = [];
      }),
      push: jest.fn((task: unknown) => {
        queue.entries.push(task);
        return new Promise(() => undefined);
      }),
    };
    return { requestQueue: queue } as unknown as JSONAPISource & {
      requestQueue: typeof queue;
    };
  };

  it('keeps every queued offline edit when no ITF is being sent', async () => {
    const remote = makeRemote([passageEdit, teamRename]);
    await prepareRemoteQueueForStartup(remote, undefined);
    expect(remote.requestQueue.skip).not.toHaveBeenCalled();
    expect(remote.requestQueue.clear).not.toHaveBeenCalled();
    expect(remote.requestQueue.entries).toHaveLength(2);
  });

  it('drops the edits the ITF carries so they are not replayed on top of it', async () => {
    const remote = makeRemote([passageEdit]);
    await prepareRemoteQueueForStartup(remote, [{ type: 'passage', id: 'p1' }]);
    expect(remote.requestQueue.entries).toEqual([]);
    // skip() drops only the first task; the rest would replay on top of the ITF.
    expect(remote.requestQueue.skip).not.toHaveBeenCalled();
  });

  it('keeps an edit the ITF does not carry, so it is replayed, not lost', async () => {
    const remote = makeRemote([passageEdit, teamRename]);
    await prepareRemoteQueueForStartup(remote, [{ type: 'passage', id: 'p1' }]);
    expect(remote.requestQueue.entries).toEqual([teamRename]);
  });

  it('reports a failed rebuild instead of throwing', async () => {
    const remote = makeRemote([passageEdit, teamRename]);
    remote.requestQueue.clear.mockRejectedValueOnce(new Error('settling'));
    await expect(
      prepareRemoteQueueForStartup(remote, [{ type: 'passage', id: 'p1' }])
    ).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalled();
  });

  it('does nothing without a remote', async () => {
    await expect(
      prepareRemoteQueueForStartup(undefined, [{ type: 'passage', id: 'p1' }])
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

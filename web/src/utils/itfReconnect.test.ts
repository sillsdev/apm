/**
 * TT-7911: when the connection comes back during a session that needs an ITF,
 * the ITF is built and sent instead of replaying the queued offline edits it
 * carries. Cancel and failure keep the flag and replay the queue normally.
 */
jest.mock('../../api-variable', () => ({
  API_CONFIG: { host: 'https://api.test', snagId: '' },
  OrbitNetworkErrorRetries: 5,
  isElectron: true,
}));
jest.mock('./logErrorService', () => ({
  __esModule: true,
  default: jest.fn(),
  Severity: { error: 'error' },
}));
jest.mock('../auth/bugsnagClient', () => ({ __esModule: true, default: {} }));

import type JSONAPISource from '@orbit/jsonapi';
import type { Task } from '@orbit/core';
import {
  cancelItfReconnect,
  dismissItfReconnect,
  getItfReconnectStatus,
  runItfReconnect,
  setItfReconnectRunner,
  startItfOnReconnect,
  subscribeItfReconnect,
  whenItfReconnectSettled,
  type ItfReconnectRunner,
  type ItfReconnectStatus,
} from './itfReconnect';
import {
  markNeedItfSync,
  markNeedItfSyncOnDisconnect,
  needItfSync,
} from './needItfSync';
import { isRemoteQueueHeld, releaseRemoteQueueOnReconnect } from './itfQueue';
import { orbitReset } from '../crud/orbitReset';
import type { ItfSyncFile } from '../store/importexport/itfSyncExport';

const editPassage: Task = {
  type: 'update',
  data: {
    id: 't-passage',
    operations: [
      { op: 'replaceAttribute', record: { type: 'passage', id: 'p1' } },
    ],
  },
};
const renameTeam: Task = {
  type: 'update',
  data: {
    id: 't-org',
    operations: [
      { op: 'updateRecord', record: { type: 'organization', id: 'o1' } },
    ],
  },
};

class FakeQueue {
  autoProcess = true;
  tasks: Task[];
  reified = Promise.resolve();
  constructor(tasks: Task[]) {
    this.tasks = [...tasks];
  }
  get entries() {
    return this.tasks;
  }
  get length() {
    return this.tasks.length;
  }
  get empty() {
    return this.tasks.length === 0;
  }
  clear = jest.fn(async () => {
    this.tasks = [];
  });
  push = jest.fn((task: Task) => {
    this.tasks.push(task);
    return new Promise<void>(() => undefined);
  });
  /** What a replay would send, in order. */
  sent: Task[] = [];
  retry = jest.fn(async () => {
    this.sent.push(...this.tasks);
    this.tasks = [];
  });
}

const itfFile = (): ItfSyncFile => ({
  buffer: Buffer.from('itf'),
  fileName: 'sync.itf',
  records: [{ type: 'passage', id: 'p1' }],
});

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const makeRunner = (queue: FakeQueue, overrides = {}) => {
  const remote = { requestQueue: queue } as unknown as JSONAPISource;
  const runner: ItfReconnectRunner & {
    [K in keyof ItfReconnectRunner]: jest.Mock;
  } = {
    canStart: jest.fn(() => true),
    getRemote: jest.fn(() => remote),
    exportItf: jest.fn(async () => itfFile()),
    uploadItf: jest.fn(async () => undefined),
    replay: jest.fn((r: JSONAPISource) => orbitReset(r, jest.fn())),
    afterSent: jest.fn(async () => undefined),
    setBusy: jest.fn(),
    reportError: jest.fn(),
    ...overrides,
  } as never;
  setItfReconnectRunner(runner);
  return runner;
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('ITF on reconnect (TT-7911)', () => {
  let statuses: ItfReconnectStatus[];
  let unsubscribe: () => void;

  beforeEach(() => {
    localStorage.clear();
    statuses = [];
    unsubscribe = subscribeItfReconnect(() =>
      statuses.push(getItfReconnectStatus())
    );
  });
  afterEach(async () => {
    cancelItfReconnect();
    await whenItfReconnectSettled();
    dismissItfReconnect();
    setItfReconnectRunner(undefined);
    unsubscribe();
  });

  it('sends the ITF and drops the edits it carries instead of replaying them', async () => {
    markNeedItfSync();
    const queue = new FakeQueue([editPassage, renameTeam]);
    const runner = makeRunner(queue);

    expect(startItfOnReconnect({ offline: false })).toBe(true);
    await whenItfReconnectSettled();

    expect(runner.exportItf).toHaveBeenCalledTimes(1);
    expect(runner.uploadItf).toHaveBeenCalledTimes(1);
    // Only the edit the ITF does not carry is replayed.
    expect(queue.sent).toEqual([renameTeam]);
    expect(needItfSync()).toBe(false);
    expect(runner.afterSent).toHaveBeenCalled();
    expect(getItfReconnectStatus()).toBe('sent');
    expect(statuses).toEqual(
      expect.arrayContaining(['exporting', 'uploading', 'sent'])
    );
  });

  it('exports before any replay can start and holds the queue until sent', async () => {
    markNeedItfSync();
    const queue = new FakeQueue([editPassage]);
    const upload = deferred<void>();
    makeRunner(queue, { uploadItf: jest.fn(() => upload.promise) });

    startItfOnReconnect({ offline: false });
    await flush();
    // Another reconnect path tries to replay mid-ITF: it must not send.
    await orbitReset(
      { requestQueue: queue } as unknown as JSONAPISource,
      jest.fn()
    );
    expect(queue.retry).not.toHaveBeenCalled();
    expect(queue.autoProcess).toBe(false);

    upload.resolve();
    await whenItfReconnectSettled();
    expect(queue.sent).toEqual([]);
    expect(queue.autoProcess).toBe(true);
  });

  it('keeps the old replay when no ITF is due', async () => {
    const queue = new FakeQueue([editPassage]);
    const runner = makeRunner(queue);

    expect(startItfOnReconnect({ offline: false })).toBe(false);
    expect(runner.exportItf).not.toHaveBeenCalled();
  });

  it('keeps the old replay in offline mode or with no runner (web)', () => {
    markNeedItfSync();
    expect(startItfOnReconnect({ offline: false })).toBe(false);
    makeRunner(new FakeQueue([]));
    expect(startItfOnReconnect({ offline: true })).toBe(false);
  });

  it('keeps the old replay while another import is busy', () => {
    markNeedItfSync();
    makeRunner(new FakeQueue([]), { canStart: jest.fn(() => false) });
    expect(startItfOnReconnect({ offline: false })).toBe(false);
  });

  it('replays the queue and clears the flag when the export finds nothing', async () => {
    markNeedItfSync();
    const queue = new FakeQueue([editPassage]);
    const runner = makeRunner(queue, {
      exportItf: jest.fn(async () => {
        // exportItfSync clears the flag itself when nothing changed.
        localStorage.removeItem('needItfSync');
        return undefined;
      }),
    });

    startItfOnReconnect({ offline: false });
    await whenItfReconnectSettled();

    expect(runner.uploadItf).not.toHaveBeenCalled();
    expect(queue.sent).toEqual([editPassage]);
    expect(needItfSync()).toBe(false);
    expect(getItfReconnectStatus()).toBe('idle');
  });

  it('cancel keeps the flag and replays the queue so edits are not parked', async () => {
    markNeedItfSync();
    const queue = new FakeQueue([editPassage, renameTeam]);
    const upload = deferred<void>();
    const runner = makeRunner(queue, {
      uploadItf: jest.fn(() => upload.promise),
    });

    startItfOnReconnect({ offline: false });
    await flush();
    expect(getItfReconnectStatus()).toBe('uploading');
    cancelItfReconnect();
    await whenItfReconnectSettled();

    expect(getItfReconnectStatus()).toBe('cancelled');
    expect(needItfSync()).toBe(true);
    // Nothing is dropped; every queued edit is replayed one at a time.
    expect(queue.clear).not.toHaveBeenCalled();
    expect(queue.sent).toEqual([editPassage, renameTeam]);
    expect(queue.autoProcess).toBe(true);
    expect(runner.afterSent).not.toHaveBeenCalled();
    expect(runner.setBusy).toHaveBeenLastCalledWith(false);
    // The upload finishing later changes nothing.
    upload.resolve();
    await flush();
    expect(needItfSync()).toBe(true);
  });

  it('cannot cancel once the server has started applying the ITF', async () => {
    markNeedItfSync();
    const queue = new FakeQueue([editPassage]);
    const upload = deferred<void>();
    makeRunner(queue, {
      uploadItf: jest.fn(
        (_file: ItfSyncFile, opts: { onApplying: () => void }) => {
          opts.onApplying();
          return upload.promise;
        }
      ),
    });

    startItfOnReconnect({ offline: false });
    await flush();
    expect(getItfReconnectStatus()).toBe('applying');
    cancelItfReconnect();
    upload.resolve();
    await whenItfReconnectSettled();

    expect(getItfReconnectStatus()).toBe('sent');
    expect(needItfSync()).toBe(false);
  });

  it('a failed upload keeps the flag, reports, and replays the queue', async () => {
    markNeedItfSync();
    const queue = new FakeQueue([editPassage]);
    const runner = makeRunner(queue, {
      uploadItf: jest.fn(async () => {
        throw new Error('Network Error');
      }),
    });

    startItfOnReconnect({ offline: false });
    await whenItfReconnectSettled();

    expect(getItfReconnectStatus()).toBe('failed');
    expect(runner.reportError).toHaveBeenCalled();
    expect(needItfSync()).toBe(true);
    expect(queue.sent).toEqual([editPassage]);
    expect(queue.entries).toEqual([]);
  });

  it('runs one ITF at a time when several checks see the same reconnect', async () => {
    markNeedItfSync();
    const queue = new FakeQueue([editPassage]);
    const upload = deferred<void>();
    const runner = makeRunner(queue, {
      uploadItf: jest.fn(() => upload.promise),
    });

    expect(startItfOnReconnect({ offline: false })).toBe(true);
    expect(startItfOnReconnect({ offline: false })).toBe(true);
    upload.resolve();
    await whenItfReconnectSettled();
    expect(runner.exportItf).toHaveBeenCalledTimes(1);
  });

  it('retries after a cancel', async () => {
    markNeedItfSync();
    const queue = new FakeQueue([editPassage]);
    const upload = deferred<void>();
    const runner = makeRunner(queue, {
      uploadItf: jest
        .fn()
        .mockImplementationOnce(() => upload.promise)
        .mockImplementation(async () => undefined),
    });

    startItfOnReconnect({ offline: false });
    await flush();
    cancelItfReconnect();
    await whenItfReconnectSettled();
    await runItfReconnect();

    expect(runner.uploadItf).toHaveBeenCalledTimes(2);
    expect(getItfReconnectStatus()).toBe('sent');
    expect(needItfSync()).toBe(false);
  });
});

/**
 * TT-7911 retry race: the disconnect that marks the ITF as due holds the
 * queue, so no retry can send a carried edit between the network returning
 * and the reconnect edge being noticed. Every reconnect path ends that hold.
 */
describe('queue held from the disconnect (TT-7911)', () => {
  const remoteOf = (queue: FakeQueue) =>
    ({ requestQueue: queue }) as unknown as JSONAPISource;
  const disconnect = (queue: FakeQueue) =>
    markNeedItfSyncOnDisconnect({
      isElectron: true,
      offline: false,
      remote: remoteOf(queue),
    });

  beforeEach(() => localStorage.clear());
  afterEach(async () => {
    cancelItfReconnect();
    await whenItfReconnectSettled();
    dismissItfReconnect();
    setItfReconnectRunner(undefined);
    releaseRemoteQueueOnReconnect();
  });

  it('sends nothing directly before the ITF, and the carried edit only once', async () => {
    const queue = new FakeQueue([editPassage]);
    const runner = makeRunner(queue);

    disconnect(queue);
    // An edit made while offline waits behind the held one.
    void queue.push(renameTeam);
    // The network is back but the edge is not seen yet: a replay attempt
    // (orbitReset, a retry timer) must not send.
    await orbitReset(remoteOf(queue), jest.fn());
    expect(queue.retry).not.toHaveBeenCalled();
    expect(queue.autoProcess).toBe(false);

    expect(startItfOnReconnect({ offline: false })).toBe(true);
    await whenItfReconnectSettled();

    expect(runner.uploadItf).toHaveBeenCalledTimes(1);
    // The passage edit went in the ITF only; the team rename replays after.
    expect(queue.sent).toEqual([renameTeam]);
    expect(isRemoteQueueHeld()).toBe(false);
    expect(queue.autoProcess).toBe(true);
  });

  it.each([
    ['another import is busy', { canStart: jest.fn(() => false) }, false],
    ['the session is in offline mode', {}, true],
  ])(
    'releases and replays when the ITF cannot start (%s)',
    async (_case, overrides, offline) => {
      const queue = new FakeQueue([editPassage]);
      const runner = makeRunner(queue, overrides);
      disconnect(queue);

      expect(startItfOnReconnect({ offline })).toBe(false);
      expect(isRemoteQueueHeld()).toBe(false);
      expect(queue.autoProcess).toBe(true);
      // useCheckOnline then replays as before.
      await orbitReset(remoteOf(queue), jest.fn());
      expect(queue.sent).toEqual([editPassage]);
      expect(runner.exportItf).not.toHaveBeenCalled();
    }
  );

  it('releases and replays when no runner is registered', async () => {
    const queue = new FakeQueue([editPassage]);
    disconnect(queue);

    expect(startItfOnReconnect({ offline: false })).toBe(false);
    expect(isRemoteQueueHeld()).toBe(false);
    await orbitReset(remoteOf(queue), jest.fn());
    expect(queue.sent).toEqual([editPassage]);
  });

  it('releases and replays when the ITF is no longer due', async () => {
    const queue = new FakeQueue([editPassage]);
    makeRunner(queue);
    disconnect(queue);
    // e.g. the startup sync sent it meanwhile.
    localStorage.removeItem('needItfSync');

    expect(startItfOnReconnect({ offline: false })).toBe(false);
    expect(isRemoteQueueHeld()).toBe(false);
  });

  it('a failed ITF releases and replays the queue', async () => {
    const queue = new FakeQueue([editPassage]);
    makeRunner(queue, {
      uploadItf: jest.fn(async () => {
        throw new Error('Network Error');
      }),
    });
    disconnect(queue);

    startItfOnReconnect({ offline: false });
    await whenItfReconnectSettled();

    expect(isRemoteQueueHeld()).toBe(false);
    expect(queue.sent).toEqual([editPassage]);
  });

  it('a disconnect during a running ITF is released when it settles', async () => {
    markNeedItfSync();
    const queue = new FakeQueue([editPassage]);
    const upload = deferred<void>();
    makeRunner(queue, { uploadItf: jest.fn(() => upload.promise) });

    startItfOnReconnect({ offline: false });
    await flush();
    disconnect(queue);
    // Reconnect joins the running ITF.
    expect(startItfOnReconnect({ offline: false })).toBe(true);
    upload.resolve();
    await whenItfReconnectSettled();

    expect(isRemoteQueueHeld()).toBe(false);
    expect(queue.autoProcess).toBe(true);
  });
});

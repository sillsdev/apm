/**
 * TT-7911: when an ITF carrying queued offline edits is sent, those edits must
 * not also be replayed (no duplicates), but queued edits the ITF does not
 * carry (a team rename, a delete, a project not marked for offline) must still
 * replay, or they are lost.
 */
import type JSONAPISource from '@orbit/jsonapi';
import type { Task } from '@orbit/core';

const mockLogError = jest.fn();
jest.mock('./logErrorService', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockLogError(...args),
  Severity: { error: 'error' },
}));
jest.mock('../auth/bugsnagClient', () => ({ __esModule: true, default: {} }));

import {
  dropQueuedEditsCarriedByItf,
  holdRemoteQueue,
  holdRemoteQueueUntilReconnect,
  isRemoteQueueHeld,
  releaseRemoteQueueOnReconnect,
  isTaskCarriedByItf,
  itfRecordKeys,
} from './itfQueue';

const update = (
  id: string,
  operations: Array<Record<string, unknown>>
): Task => ({ type: 'update', data: { id, operations } });

const renameTeam = update('t-org', [
  {
    op: 'updateRecord',
    record: { type: 'organization', id: 'o1', attributes: { name: 'x' } },
  },
]);
const editPassage = update('t-passage', [
  { op: 'replaceAttribute', record: { type: 'passage', id: 'p1' } },
]);
const addSection = update('t-section', [
  { op: 'addRecord', record: { type: 'section', id: 's1' } },
]);
const carried = [
  { type: 'passage', id: 'p1' },
  { type: 'section', id: 's1' },
];

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
    // A pushed task settles only when it is processed.
    return new Promise<void>(() => undefined);
  });
  retry = jest.fn(async () => undefined);
}

const remoteWith = (queue: FakeQueue) =>
  ({ requestQueue: queue }) as unknown as JSONAPISource;

describe('isTaskCarriedByItf (TT-7911)', () => {
  const keys = itfRecordKeys(carried);

  it('is true when every operation targets a record the ITF carries', () => {
    expect(isTaskCarriedByItf(editPassage, keys)).toBe(true);
    expect(isTaskCarriedByItf(addSection, keys)).toBe(true);
  });

  it('is false for a record type the ITF does not carry', () => {
    expect(isTaskCarriedByItf(renameTeam, keys)).toBe(false);
  });

  it('is false for a delete: the ITF holds records, not removals', () => {
    const remove = update('t-rm', [
      { op: 'removeRecord', record: { type: 'passage', id: 'p1' } },
    ]);
    expect(isTaskCarriedByItf(remove, keys)).toBe(false);
  });

  it('is false when only some operations are carried', () => {
    const mixed = update('t-mixed', [
      { op: 'replaceAttribute', record: { type: 'passage', id: 'p1' } },
      { op: 'replaceAttribute', record: { type: 'organization', id: 'o1' } },
    ]);
    expect(isTaskCarriedByItf(mixed, keys)).toBe(false);
  });

  it('is false for queries and malformed persisted tasks', () => {
    expect(isTaskCarriedByItf({ type: 'query', data: {} }, keys)).toBe(false);
    expect(isTaskCarriedByItf({ type: 'update' }, keys)).toBe(false);
    expect(
      isTaskCarriedByItf({ type: 'update', data: { operations: [] } }, keys)
    ).toBe(false);
  });

  it('accepts a single operation that is not wrapped in an array', () => {
    const single: Task = {
      type: 'update',
      data: {
        id: 't1',
        operations: {
          op: 'updateRecord',
          record: { type: 'passage', id: 'p1' },
        },
      },
    };
    expect(isTaskCarriedByItf(single, keys)).toBe(true);
  });
});

describe('dropQueuedEditsCarriedByItf (TT-7911)', () => {
  beforeEach(() => mockLogError.mockClear());

  it('drops the carried edits and keeps the rest in order', async () => {
    const queue = new FakeQueue([editPassage, renameTeam, addSection]);
    await dropQueuedEditsCarriedByItf(remoteWith(queue), carried);
    expect(queue.entries).toEqual([renameTeam]);
    // It never sends anything itself; the caller replays what is left.
    expect(queue.retry).not.toHaveBeenCalled();
    expect(queue.autoProcess).toBe(true);
  });

  it('empties the queue when the ITF carries every queued edit', async () => {
    const queue = new FakeQueue([editPassage, addSection]);
    await dropQueuedEditsCarriedByItf(remoteWith(queue), carried);
    expect(queue.entries).toEqual([]);
    expect(queue.push).not.toHaveBeenCalled();
  });

  it('leaves the queue alone when the ITF carries none of it', async () => {
    const queue = new FakeQueue([renameTeam]);
    await dropQueuedEditsCarriedByItf(remoteWith(queue), carried);
    expect(queue.clear).not.toHaveBeenCalled();
    expect(queue.entries).toEqual([renameTeam]);
  });

  it('keeps autoProcess off when the queue is held', async () => {
    const queue = new FakeQueue([editPassage, renameTeam]);
    const release = holdRemoteQueue(remoteWith(queue));
    await dropQueuedEditsCarriedByItf(remoteWith(queue), carried);
    expect(queue.autoProcess).toBe(false);
    release();
    expect(queue.autoProcess).toBe(true);
  });

  it('reports a failed rebuild instead of throwing', async () => {
    const queue = new FakeQueue([editPassage, renameTeam]);
    queue.clear.mockRejectedValueOnce(new Error('settling'));
    await expect(
      dropQueuedEditsCarriedByItf(remoteWith(queue), carried)
    ).resolves.toBeUndefined();
    expect(mockLogError).toHaveBeenCalled();
  });

  it('does nothing without a remote', async () => {
    await expect(
      dropQueuedEditsCarriedByItf(undefined, carried)
    ).resolves.toBeUndefined();
  });
});

describe('holdRemoteQueue (TT-7911)', () => {
  it('stops the queue sending until released', () => {
    const queue = new FakeQueue([editPassage]);
    expect(isRemoteQueueHeld()).toBe(false);
    const release = holdRemoteQueue(remoteWith(queue));
    expect(isRemoteQueueHeld()).toBe(true);
    expect(queue.autoProcess).toBe(false);
    release();
    expect(isRemoteQueueHeld()).toBe(false);
    expect(queue.autoProcess).toBe(true);
  });

  it('can be released more than once', () => {
    const queue = new FakeQueue([]);
    const release = holdRemoteQueue(remoteWith(queue));
    release();
    release();
    expect(isRemoteQueueHeld()).toBe(false);
    expect(queue.autoProcess).toBe(true);
  });

  it('holds even without a remote, so retries stay blocked', () => {
    const release = holdRemoteQueue(undefined);
    expect(isRemoteQueueHeld()).toBe(true);
    release();
    expect(isRemoteQueueHeld()).toBe(false);
  });

  it('stays held until every holder releases (disconnect hold + ITF)', () => {
    const queue = new FakeQueue([editPassage]);
    const releaseDisconnect = holdRemoteQueue(remoteWith(queue));
    const releaseItf = holdRemoteQueue(remoteWith(queue));
    releaseDisconnect();
    // The other holder's release must not undo the ITF's hold.
    expect(isRemoteQueueHeld()).toBe(true);
    expect(queue.autoProcess).toBe(false);
    releaseDisconnect();
    expect(isRemoteQueueHeld()).toBe(true);
    releaseItf();
    expect(isRemoteQueueHeld()).toBe(false);
    expect(queue.autoProcess).toBe(true);
  });
});

describe('holdRemoteQueueUntilReconnect (TT-7911)', () => {
  afterEach(() => releaseRemoteQueueOnReconnect());

  it('holds once however many disconnects are seen, and one reconnect releases', () => {
    const queue = new FakeQueue([editPassage]);
    holdRemoteQueueUntilReconnect(remoteWith(queue));
    holdRemoteQueueUntilReconnect(remoteWith(queue));
    expect(isRemoteQueueHeld()).toBe(true);
    expect(queue.autoProcess).toBe(false);
    releaseRemoteQueueOnReconnect();
    expect(isRemoteQueueHeld()).toBe(false);
    expect(queue.autoProcess).toBe(true);
  });

  it('a later disconnect with a recreated remote holds that queue too', () => {
    const before = new FakeQueue([editPassage]);
    const after = new FakeQueue([editPassage]);
    holdRemoteQueueUntilReconnect(remoteWith(before));
    holdRemoteQueueUntilReconnect(remoteWith(after));
    expect(after.autoProcess).toBe(false);
    expect(before.autoProcess).toBe(false);
    releaseRemoteQueueOnReconnect();
    expect(isRemoteQueueHeld()).toBe(false);
    expect(after.autoProcess).toBe(true);
  });

  it('a reconnect with no disconnect hold changes nothing', () => {
    const queue = new FakeQueue([editPassage]);
    const releaseItf = holdRemoteQueue(remoteWith(queue));
    releaseRemoteQueueOnReconnect();
    expect(isRemoteQueueHeld()).toBe(true);
    releaseItf();
    expect(isRemoteQueueHeld()).toBe(false);
  });
});

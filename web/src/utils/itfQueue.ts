import type JSONAPISource from '@orbit/jsonapi';
import type { Task } from '@orbit/core';
import type { RecordIdentity } from '@orbit/records';
import logError, { Severity } from './logErrorService';
import bugsnagClient from '../auth/bugsnagClient';

/**
 * TT-7911: while an ITF holding queued offline edits is built and sent, the
 * remote queue must not replay them (no duplicates). Only one hold exists at a
 * time; the replay paths (orbitReset, updateError's retry timer, queryError)
 * check it before calling `requestQueue.retry()`, which ignores autoProcess.
 */
let heldQueue: { queue?: JSONAPISource['requestQueue'] } | undefined;

export const isRemoteQueueHeld = () => heldQueue !== undefined;

/** Stops the remote queue sending until the returned release is called. */
export const holdRemoteQueue = (remote: JSONAPISource | undefined) => {
  const hold = { queue: remote?.requestQueue };
  heldQueue = hold;
  // autoProcess off: an edit pushed meanwhile waits behind the held tasks
  // instead of being sent ahead of them.
  if (hold.queue) hold.queue.autoProcess = false;
  return () => {
    if (heldQueue !== hold) return;
    heldQueue = undefined;
    if (hold.queue) hold.queue.autoProcess = true;
  };
};

const recordKey = (r: RecordIdentity) => `${r.type}:${r.id}`;

export const itfRecordKeys = (records: readonly RecordIdentity[]) =>
  new Set(records.map(recordKey));

const isRecordIdentity = (value: unknown): value is RecordIdentity =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as RecordIdentity).type === 'string' &&
  typeof (value as RecordIdentity).id === 'string';

/** Operations of a queued update, read from a task persisted in IndexedDB. */
const taskOperations = (task: Task): unknown[] => {
  if (task.type !== 'update') return [];
  const data = task.data;
  if (typeof data !== 'object' || data === null) return [];
  const ops = (data as { operations?: unknown }).operations;
  if (Array.isArray(ops)) return ops;
  return ops === undefined ? [] : [ops];
};

/**
 * True when the ITF already sends what this queued update would: every
 * operation writes a record the export included. A delete is never carried
 * (the ITF holds records, not removals), nor is a query.
 */
export const isTaskCarriedByItf = (
  task: Task,
  carried: ReadonlySet<string>
): boolean => {
  const ops = taskOperations(task);
  return (
    ops.length > 0 &&
    ops.every((op) => {
      if (typeof op !== 'object' || op === null) return false;
      const { op: kind, record } = op as { op?: unknown; record?: unknown };
      return (
        kind !== 'removeRecord' &&
        isRecordIdentity(record) &&
        carried.has(recordKey(record))
      );
    })
  );
};

/**
 * Removes the queued edits an ITF carries, keeping every other task in order
 * for the caller to replay. Edits the ITF does not carry (a team rename, a
 * delete, a project not marked for offline) would otherwise be lost.
 * Never sends anything itself and never throws: a failure is reported and the
 * queue then replays on top of the ITF, which the import tolerates.
 */
export const dropQueuedEditsCarriedByItf = async (
  remote: JSONAPISource | undefined,
  records: readonly RecordIdentity[]
) => {
  const queue = remote?.requestQueue;
  if (!queue) return;
  const autoProcess = queue.autoProcess;
  try {
    // Before the persisted queue is reified it can report no tasks.
    await queue.reified;
    const carried = itfRecordKeys(records);
    const keep = queue.entries.filter((t) => !isTaskCarriedByItf(t, carried));
    if (keep.length === queue.length) return;
    // TaskQueue cannot remove a task from the middle; rebuild it. With
    // autoProcess off nothing is sent while the kept tasks go back in.
    queue.autoProcess = false;
    await queue.clear();
    for (const task of keep) {
      // push() settles when the task is eventually sent; a send failure is
      // handled by the remote-update-fail strategy, not here.
      queue.push(task).catch(() => undefined);
    }
    await queue.reified;
  } catch (error) {
    logError(
      Severity.error,
      bugsnagClient,
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    queue.autoProcess = autoProcess;
  }
};

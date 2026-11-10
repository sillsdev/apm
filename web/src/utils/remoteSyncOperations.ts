import { Task } from '@orbit/core';
import { RecordOperation } from '@orbit/records';

/** The fields of a remote request-queue task this filter reads. */
type QueueTask = Pick<Task, 'type' | 'data'>;

/**
 * Ops that write a record's data. replaceKey (the server id) and removeRecord
 * are never stale against a queued write, so they always sync.
 */
const DATA_OPS = new Set([
  'addRecord',
  'updateRecord',
  'replaceAttribute',
  'replaceRelatedRecord',
  'replaceRelatedRecords',
  'addToRelatedRecords',
  'removeFromRelatedRecords',
]);

// Orbit hands transform/task operations around as unknown or as one op or
// many; every entry is a RecordOperation once falsy values are dropped.
const opsOf = (operations: unknown): RecordOperation[] =>
  (Array.isArray(operations) ? operations : [operations]).filter(
    Boolean
  ) as RecordOperation[];

const recordKey = (op: RecordOperation) =>
  `${op.record?.type}:${op.record?.id}`;

// An update task's data is the transform it sends.
const taskRecordKeys = (task: QueueTask) =>
  opsOf((task.data as { operations?: unknown } | undefined)?.operations).map(
    recordKey
  );

/**
 * Operations from a remote transform that remote-sync should copy to memory.
 *
 * Server responses describe a record as it was when that request ran, which
 * can be older than local writes still waiting in the remote queue. Syncing
 * them reverts those writes in memory until their own responses arrive
 * (TT-7800: Submit, Reopen and Reject flipped step checkboxes back and forth).
 *
 * `queue` is the remote request queue; its first entry is the task whose
 * response this is. Two kinds of op are dropped:
 * - `included` records in an update's response, which @orbit/jsonapi turns
 *   into plain updateRecord ops for records the update did not touch;
 * - data ops for any record a *later* queued update will rewrite, e.g. the
 *   first of several queued passage writes coming back with the passage as
 *   it was before the others.
 * Everything else syncs; datachanges still delivers real server-side changes.
 */
export function remoteSyncOperations(
  operations: unknown,
  queue: readonly QueueTask[]
): RecordOperation[] {
  const ops = opsOf(operations);
  const [current, ...later] = queue;
  const own =
    current?.type === 'update' ? new Set(taskRecordKeys(current)) : undefined;
  const rewrittenLater = new Set(
    later.filter((t) => t.type === 'update').flatMap(taskRecordKeys)
  );
  return ops.filter((o) => {
    const key = recordKey(o);
    if (own && o.op === 'updateRecord' && !own.has(key)) return false;
    if (DATA_OPS.has(o.op) && rewrittenLater.has(key)) return false;
    return true;
  });
}

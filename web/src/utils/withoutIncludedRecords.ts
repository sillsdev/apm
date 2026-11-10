import { Task } from '@orbit/core';
import { RecordOperation } from '@orbit/records';

/** The fields of a remote request-queue task this filter reads. */
type QueueTask = Pick<Task, 'type' | 'data'>;

const opsOf = (operations: unknown): RecordOperation[] =>
  (Array.isArray(operations) ? operations : [operations]).filter(
    Boolean
  ) as RecordOperation[];

const recordKey = (op: RecordOperation) =>
  `${op.record?.type}:${op.record?.id}`;

/**
 * Operations from a remote transform that remote-sync should copy to memory.
 *
 * A JSON:API response to an update carries `included` records, which
 * @orbit/jsonapi turns into plain `updateRecord` ops. They are the server's
 * copy *before* any later queued writes, so syncing them reverts local
 * changes still waiting in the remote queue (TT-7800: Submit unchecked the
 * Transcribe step until its own PATCH came back). While an update task is
 * being processed, drop `updateRecord` ops for records that task did not
 * itself touch. Query responses (and anything outside an update) are
 * returned unchanged; datachanges still delivers real server-side changes.
 */
export function withoutIncludedRecords(
  operations: unknown,
  currentTask: QueueTask | undefined
): RecordOperation[] {
  const ops = opsOf(operations);
  if (currentTask?.type !== 'update') return ops;
  const own = new Set(
    opsOf((currentTask.data as { operations?: unknown })?.operations).map(
      recordKey
    )
  );
  return ops.filter((o) => o.op !== 'updateRecord' || own.has(recordKey(o)));
}

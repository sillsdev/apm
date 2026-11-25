import type Memory from '@orbit/memory';
import type {
  InitializedRecord,
  RecordOperation,
  RecordTransformBuilder,
} from '@orbit/records';
import { findRecord } from './tryFindRecord';

/** The `offlineId` a server record carries, or undefined when it has none. */
export const offlineIdOf = (
  record: Partial<InitializedRecord> | undefined
): string | undefined => {
  const id = (record?.attributes as { offlineId?: unknown } | undefined)
    ?.offlineId;
  return typeof id === 'string' && id !== '' ? id : undefined;
};

/**
 * Offline-id rule: a record created on this device is sent with its local id
 * as `offlineId`. When the server record comes back carrying that id, it
 * replaces the local copy. Returns the operation that removes the local copy,
 * or undefined when no such copy is in memory.
 */
export const localCopyRemoval = (
  memory: Memory,
  serverRecord: InitializedRecord,
  tb: RecordTransformBuilder
): RecordOperation | undefined => {
  const offlineId = offlineIdOf(serverRecord);
  // A record whose own id is its offline id is the server copy itself.
  if (!offlineId || offlineId === serverRecord.id) return undefined;
  if (!findRecord(memory, serverRecord.type, offlineId)) return undefined;
  return tb
    .removeRecord({ type: serverRecord.type, id: offlineId })
    .toOperation();
};

import type Memory from '@orbit/memory';
import type {
  InitializedRecord,
  RecordIdentity,
  RecordKeyMap,
  RecordOperation,
  RecordTransform,
} from '@orbit/records';
import { isLocalMediaPath } from '../utils/localMediaPath';

/**
 * Web offline recordings (ADR 0016): when a recording cannot reach the server,
 * `useMediaUpload` still creates its Orbit mediafile so later steps (e.g. LWC
 * translation after Careful Speech) can see and play it. That record is
 * **local-only**: its id is the Upload Pending blob key, its `audioUrl` is a
 * `local-media:` path, and it has no server id yet. The Upload Pending drain
 * creates it on the server and then links the server id to it
 * (`linkLocalOnlyMediafile`), which ends its local-only life.
 *
 * Local-only records are never sent through Orbit's remote queue: the server
 * has no row for them, and the drain is what creates one.
 */

type Lookup = Pick<Memory, 'cache'> & { keyMap?: RecordKeyMap };

const hasRemoteId = (memory: Lookup, id: string): boolean =>
  Boolean(memory.keyMap?.idToKey('mediafile', 'remoteId', id));

const audioUrlOf = (rec: Partial<InitializedRecord> | undefined) =>
  (rec?.attributes as { audioUrl?: string } | undefined)?.audioUrl;

/** True for a mediafile that exists only on this device (see module doc). */
export const isLocalOnlyMediafile = (memory: Lookup, id: string): boolean => {
  if (!id || hasRemoteId(memory, id)) return false;
  const rec = memory.cache?.getRecordSync({ type: 'mediafile', id });
  return isLocalMediaPath(audioUrlOf(rec));
};

const relatedIdentities = (op: RecordOperation): RecordIdentity[] => {
  const o = op as {
    relatedRecord?: RecordIdentity | null;
    relatedRecords?: RecordIdentity[];
  };
  return [
    ...(o.relatedRecord ? [o.relatedRecord] : []),
    ...(o.relatedRecords ?? []),
  ];
};

export interface LocalOnlySplit {
  /** The transform to send to the server, or undefined when nothing is left. */
  toSend: RecordTransform | undefined;
  /** Local-only mediafiles this transform removes (their blobs must go too). */
  removedLocalOnly: string[];
  /** Kept-out ops on other records that pointed at a local-only mediafile. */
  droppedLinks: RecordOperation[];
}

/**
 * Splits a memory→remote transform: operations on local-only mediafiles stay
 * on this device. Called from `beforeUpdate`, so a record added by this same
 * transform is not in the cache yet; it is recognised from the addRecord op.
 * Keeps the transform id, so updateError can still roll back by id.
 */
const localIdsIn = (memory: Lookup, ops: RecordOperation[]): Set<string> => {
  const ids = new Set<string>();
  for (const op of ops) {
    const rec = (op as { record?: Partial<InitializedRecord> }).record;
    if (rec?.type !== 'mediafile' || !rec.id) continue;
    const addsLocal =
      op.op === 'addRecord' && isLocalMediaPath(audioUrlOf(rec));
    if (addsLocal || isLocalOnlyMediafile(memory, rec.id)) ids.add(rec.id);
  }
  return ids;
};

export const splitLocalOnlyOps = (
  memory: Lookup,
  transform: RecordTransform
): LocalOnlySplit => {
  const ops = Array.isArray(transform.operations)
    ? transform.operations
    : [transform.operations];
  const localIds = localIdsIn(memory, ops);
  const isLocal = (r: RecordIdentity | undefined) =>
    r?.type === 'mediafile' &&
    (localIds.has(r.id) || isLocalOnlyMediafile(memory, r.id));

  const kept: RecordOperation[] = [];
  const removedLocalOnly: string[] = [];
  const droppedLinks: RecordOperation[] = [];
  for (const op of ops) {
    const rec = (op as { record?: RecordIdentity }).record;
    if (isLocal(rec)) {
      if (op.op === 'removeRecord' && rec) removedLocalOnly.push(rec.id);
      continue;
    }
    if (relatedIdentities(op).some(isLocal)) {
      // The server can't resolve a local id. Prototype limit: such links
      // (e.g. a section resource pointing at an offline take) stay local.
      droppedLinks.push(op);
      continue;
    }
    kept.push(op);
  }
  if (kept.length === ops.length) {
    return { toSend: transform, removedLocalOnly, droppedLinks };
  }
  return {
    toSend: kept.length > 0 ? { ...transform, operations: kept } : undefined,
    removedLocalOnly,
    droppedLinks,
  };
};

/**
 * The drain created the server row for local-only mediafile `localId`: map
 * its server id to the existing record, so the following pull updates it in
 * place instead of adding a second record. If a sync already pulled that
 * server row in as another record, that copy is removed (sync, so nothing is
 * sent to the server) and the local record keeps its id, which other offline
 * records may link to.
 */
export const linkLocalOnlyMediafile = async (
  memory: Memory,
  localId: string,
  remoteId: string
): Promise<void> => {
  const keyMap = memory.keyMap;
  if (!keyMap) return;
  const other = keyMap.keyToId('mediafile', 'remoteId', remoteId);
  if (
    other &&
    other !== localId &&
    memory.cache.getRecordSync({ type: 'mediafile', id: other })
  ) {
    await memory.sync((t) => t.removeRecord({ type: 'mediafile', id: other }));
  }
  keyMap.pushRecord({
    type: 'mediafile',
    id: localId,
    keys: { remoteId },
  });
  // Persist the key on the record too; the backup rebuilds the keyMap from it.
  await memory.sync((t) =>
    t.updateRecord({
      type: 'mediafile',
      id: localId,
      keys: { remoteId },
    })
  );
};

/**
 * Upload Pending key `nextUpload` hands back (in its failure `data`) when a
 * web take never reached the server but is saved on this device.
 */
export const savedOnDeviceKey = (data: unknown): string | undefined => {
  const key = (data as { uploadPendingKey?: unknown } | undefined)
    ?.uploadPendingKey;
  return typeof key === 'string' && key !== '' ? key : undefined;
};

/**
 * Server id for `id` when it names a mediafile, else `id` unchanged. Returns
 * undefined when `id` is a local-only mediafile not yet on the server, so a
 * recording linked to it must wait.
 */
export const resolveMediafileIdForServer = (
  memory: Lookup,
  id: string | undefined
): string | undefined => {
  if (!id || /^\d+$/.test(id)) return id;
  const remote = memory.keyMap?.idToKey('mediafile', 'remoteId', id);
  if (remote) return remote;
  return isLocalOnlyMediafile(memory, id) ? undefined : id;
};

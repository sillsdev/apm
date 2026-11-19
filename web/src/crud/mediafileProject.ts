import Memory from '@orbit/memory';
import { RecordKeyMap } from '@orbit/records';
import { MediaFileD } from '../model';
import { getMediaProjRec } from './media';
import { remoteIdGuid } from './remoteId';
import { findRecord } from './tryFindRecord';

export interface MediafileProject {
  /** Orbit mediafile id (the Local Media Blob key). */
  mediafileId: string;
  projectId: string;
}

/**
 * Resolves the id `fetchUrl` receives (a remote numeric id, or an Orbit id)
 * to the Orbit mediafile id and the project it belongs to. Undefined when the
 * mediafile, its plan, or its project isn't in Orbit memory yet; callers then
 * treat the media as not storable on this device.
 */
export const resolveMediafileProject = (
  id: string,
  memory: Memory | undefined
): MediafileProject | undefined => {
  if (!id || !memory) return undefined;
  const mediafileId = isNaN(Number(id))
    ? id
    : // Safe: Orbit memory always carries a keyMap once the coordinator is up.
      remoteIdGuid('mediafile', id, memory.keyMap as RecordKeyMap);
  if (!mediafileId) return undefined;
  const mediaRec = findRecord(memory, 'mediafile', mediafileId) as
    MediaFileD | undefined;
  if (!mediaRec) return undefined;
  try {
    const projectId = getMediaProjRec(mediaRec, memory)?.id;
    return projectId ? { mediafileId, projectId } : undefined;
  } catch {
    // getMediaProjRec throws when the plan or project isn't synced yet; that
    // is the same "not resolvable yet" answer as a missing record above.
    return undefined;
  }
};

import Memory from '@orbit/memory';
import IndexedDBSource from '@orbit/indexeddb';
import { RecordTransformBuilder } from '@orbit/records';
import { OfflineProjectD } from '../model';
import { findRecords, findRecord } from './tryFindRecord';
import { related } from './related';

/**
 * Local project ids whose offlineproject row goes away with this delete.
 * Membership deletes apply only when the membership is the current user's.
 */
export const offlineProjectIdsForDeleted = (
  memory: Memory,
  currentUser: string,
  type: string,
  localId: string
): string[] => {
  const projects = () => findRecords(memory, 'project');
  const idsFor = (rel: 'organization' | 'group', id: string | null) => {
    // A missing link must not match every project that also has no link.
    if (!id) return [];
    return projects()
      .filter((p) => related(p, rel) === id)
      .map((p) => p.id);
  };

  if (type === 'project') return [localId];
  if (type === 'organization') return idsFor('organization', localId);
  if (type === 'organizationmembership') {
    const membership = findRecord(memory, 'organizationmembership', localId);
    if (!membership || related(membership, 'user') !== currentUser) return [];
    return idsFor('organization', related(membership, 'organization'));
  }
  if (type === 'groupmembership') {
    const membership = findRecord(memory, 'groupmembership', localId);
    if (!membership || related(membership, 'user') !== currentUser) return [];
    return idsFor('group', related(membership, 'group'));
  }
  return [];
};

export const offlineProjectsFor = (
  memory: Memory,
  projectIds: Iterable<string>
): OfflineProjectD[] => {
  const ids = new Set(projectIds);
  if (ids.size === 0) return [];
  return findRecords(memory, 'offlineproject').filter((op) =>
    ids.has(related(op, 'project'))
  );
};

export const deleteOfflineProjects = async (
  memory: Memory,
  backup: IndexedDBSource,
  projectIds: Iterable<string>
) => {
  const records = offlineProjectsFor(memory, projectIds);
  if (records.length === 0) return;
  const removes = (t: RecordTransformBuilder) =>
    records.map((op) => t.removeRecord(op));
  await backup.sync(removes);
  await memory.sync(removes);
};

import Memory from '@orbit/memory';
import IndexedDBSource from '@orbit/indexeddb';
import { RecordTransformBuilder } from '@orbit/records';
import { OfflineProjectD, ProjectD } from '../model';
import { findRecord } from './tryFindRecord';
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
  const projects = () =>
    memory.cache.query((q) => q.findRecords('project')) as ProjectD[];
  const idsFor = (rel: 'organization' | 'group', id: string | null) => {
    // A missing link must not match every project that also has no link.
    if (!id) return [];
    return projects()
      .filter((p) => related(p, rel) === id)
      .map((p) => p.id);
  };

  if (type === 'project') return [localId];
  if (type === 'organization') return idsFor('organization', localId);
  if (type !== 'organizationmembership' && type !== 'groupmembership')
    return [];

  const membership = findRecord(memory, type, localId);
  if (!membership || related(membership, 'user') !== currentUser) return [];
  const rel = type === 'organizationmembership' ? 'organization' : 'group';
  return idsFor(rel, related(membership, rel));
};

export const offlineProjectsFor = (
  memory: Memory,
  projectIds: Iterable<string>
): OfflineProjectD[] => {
  const ids = new Set(projectIds);
  if (ids.size === 0) return [];
  return (
    memory.cache.query((q) =>
      q.findRecords('offlineproject')
    ) as OfflineProjectD[]
  ).filter((op) => ids.has(related(op, 'project')));
};

export const deleteOfflineProjects = async (
  memory: Memory,
  backup: IndexedDBSource,
  projectIds: Iterable<string>
) => {
  console.log(
    'deleteOfflineProjects',
    projectIds,
    (
      memory.cache.query((q) =>
        q.findRecords('offlineproject')
      ) as OfflineProjectD[]
    ).length
  );
  const records = offlineProjectsFor(memory, projectIds);
  if (records.length === 0) return;
  const removes = (t: RecordTransformBuilder) =>
    records.map((op) => t.removeRecord(op));
  await backup.sync(removes);
  await memory.sync(removes);
  console.log(
    'after',
    (
      memory.cache.query((q) =>
        q.findRecords('offlineproject')
      ) as OfflineProjectD[]
    ).length
  );
};

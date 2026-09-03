/**
 * Exports project data in PTF format (data/*.json) for burrito creation
 * or other contexts. Uses the same table selection as electronExport.
 */
import Memory from '@orbit/memory';
import { getSerializer } from '../../serializers/getSerializer';
import { InitializedRecord } from '@orbit/records';
import { updateableFiles, staticFiles } from '../../crud';
import { ProjectD, MediaFileD, OrganizationD } from '../../model';
import { createExportCollector } from './exportTableRecs';

export interface ProjectDataFiles {
  [filename: string]: string;
}

function serializeRecords(
  recs: InitializedRecord[],
  needsRemoteIds: boolean,
  ser: ReturnType<typeof getSerializer>
): Record<string, unknown>[] {
  return needsRemoteIds
    ? (recs.map((r) => ser.serialize(r)) as unknown as Record<
        string,
        unknown
      >[])
    : recs.map((r) => {
        const ri = ser.serialize(r) as unknown as Record<string, unknown>;
        ri.id = r.id;
        ri.relationships = r.relationships;
        return ri;
      });
}

const onlyOneProject = (memory: Memory): boolean => {
  const p = memory.cache.query((q) => q.findRecords('project'));
  if (p && Array.isArray(p)) return p.length === 1;
  return true;
};

export async function getProjectDataFiles(
  memory: Memory,
  project: ProjectD
): Promise<ProjectDataFiles> {
  const ser = getSerializer(memory);
  const needsRemoteIds = Boolean(project?.keys?.remoteId);
  const { getTableRecs, supportingProjects, supportingOrgs } =
    createExportCollector(memory, needsRemoteIds);
  const files: ProjectDataFiles = {};
  const limit = onlyOneProject(memory) ? undefined : project;

  const addJsonFile = (
    table: string,
    recs: InitializedRecord[],
    sort: string
  ) => {
    const resources = serializeRecords(recs, needsRemoteIds, ser);
    const json = '{"data":' + JSON.stringify(resources) + '}';
    files[`data/${sort}_${table}.json`] = json;
  };

  const addAll = (
    info: (typeof updateableFiles)[number],
    excludeNew: boolean
  ) => {
    let recs = getTableRecs(info, limit, needsRemoteIds);
    if (!recs?.length) return;
    if (needsRemoteIds && excludeNew)
      recs = recs.filter((r) => Boolean(r.keys?.remoteId));
    if (recs.length > 0) addJsonFile(info.table + 's', recs, info.sort);
  };

  for (const info of updateableFiles) addAll(info, true);
  for (const info of staticFiles) addAll(info, false);

  if (limit) {
    const projects = supportingProjects(limit).filter((r) =>
      Boolean(r.keys?.remoteId)
    );
    if (projects.length > 0) addJsonFile('supportingprojects', projects, 'Z');
    const orgs = supportingOrgs(limit).filter((o) => Boolean(o.keys?.remoteId));
    if (orgs.length > 0) addJsonFile('supportingorgs', orgs, 'Z');
  }

  return files;
}

export interface OrganizationIntellectualPropertyExport {
  dataFiles: ProjectDataFiles;
  releaseMediafiles: MediaFileD[];
}

/**
 * PTF-style speaker rights JSON for a team (organization), plus release media rows
 * referenced by those intellectualproperty records.
 */
export function getOrganizationIntellectualPropertyFiles(
  memory: Memory,
  organizationId: string
): OrganizationIntellectualPropertyExport {
  const ser = getSerializer(memory);
  const orgs = memory.cache.query((q) =>
    q.findRecords('organization')
  ) as OrganizationD[];
  const org = orgs.find((o) => o.id === organizationId);
  const needsRemoteIds = Boolean(org?.keys?.remoteId);
  const { getTableRecs } = createExportCollector(memory, needsRemoteIds, {
    organizationId,
  });

  const ips = getTableRecs(
    { table: 'intellectualproperty', sort: 'I' },
    undefined,
    needsRemoteIds
  );
  const releaseMediafiles = getTableRecs(
    { table: 'mediafile', sort: 'H' },
    undefined,
    needsRemoteIds
  ) as MediaFileD[];

  const files: ProjectDataFiles = {};
  if (ips.length > 0) {
    files['data/I_intellectualpropertys.json'] =
      '{"data":' +
      JSON.stringify(serializeRecords(ips, needsRemoteIds, ser)) +
      '}';
  }
  if (releaseMediafiles.length > 0) {
    files['data/H_mediafiles.json'] =
      '{"data":' +
      JSON.stringify(serializeRecords(releaseMediafiles, needsRemoteIds, ser)) +
      '}';
  }

  return { dataFiles: files, releaseMediafiles };
}

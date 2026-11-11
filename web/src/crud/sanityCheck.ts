import type Memory from '@orbit/memory';
import { DateTime } from 'luxon';
import { BaseModel } from '../model/baseModel';
import type { RecordByType } from '../model/recordByType';
import type { PlanD } from '../model/plan';
import type { ProjectD } from '../model/project';
import { findRecord, findRecords } from './tryFindRecord';
import { related, type RelKey } from './related';
import { mediaReplacementsForPlans } from './mediaReplacementsForPlans';
import type { SyncTable } from './fileOrder';

/** Server vwchecksum sums each row's date millis modulo this. */
export const CHECKSUM_MODULUS = 100_000_000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Fallback repair window when a pull from the local max dateUpdated is still wrong. */
export const FULL_PULL_DAYS = 365 * 4;

const WHOLE_REMOTE_TABLES = [
  'activitystate',
  'artifacttype',
  'bible',
  'integration',
  'passagetype',
  'plantype',
  'projecttype',
  'role',
  'workflowstep',
] as const satisfies readonly SyncTable[];
type WholeRemoteTable = (typeof WHOLE_REMOTE_TABLES)[number];

const ORG_TABLES = [
  'graphic',
  'intellectualproperty',
  'invitation',
  'organizationbible',
  'organizationmembership',
  'organizationscheme',
  'orgkeyterm',
  'orgkeytermreference',
  'orgkeytermtarget',
  'orgworkflowstep',
] as const satisfies readonly (SyncTable & keyof RecordByType)[];
type OrgTable = (typeof ORG_TABLES)[number];

// includes() on a literal tuple only accepts its own members; widening the
// array to SyncTable[] is safe because every member is a SyncTable.
const isWholeRemoteTable = (table: SyncTable): table is WholeRemoteTable =>
  (WHOLE_REMOTE_TABLES as readonly SyncTable[]).includes(table);
const isOrgTable = (table: SyncTable): table is OrgTable =>
  (ORG_TABLES as readonly SyncTable[]).includes(table);

/** Rows with no remote id share this key: the server has no row for them. */
export const LOCAL_ONLY_REMOTE_ID = '0';

export interface ChecksumRow {
  id: string;
  updatedMillis: number;
}

/** Empty or unparseable timestamps contribute 0 so one bad row cannot NaN the checksum. */
export function isoToMillis(value: string): number {
  if (!value) return 0;
  const iso = value.endsWith('Z') ? value : `${value}Z`;
  const millis = DateTime.fromISO(iso).toMillis();
  return Number.isFinite(millis) ? millis : 0;
}

export function checksumOf(rows: ChecksumRow[]): number {
  return rows.reduce(
    (sum, row) => sum + (row.updatedMillis % CHECKSUM_MODULUS),
    0
  );
}

/** One row per remote id. The first row wins; rows with no relationships are ignored. */
export function dedupedChecksumRows(rows: BaseModel[]): ChecksumRow[] {
  const byRemoteId = new Map<string, BaseModel>();
  for (const row of rows) {
    if (!row?.relationships) continue;
    const id = row.keys?.remoteId || LOCAL_ONLY_REMOTE_ID;
    if (!byRemoteId.has(id)) byRemoteId.set(id, row);
  }
  return [...byRemoteId.entries()].map(([id, row]) => ({
    id,
    // A local-only row's dateUpdated must not enter the checksum, because
    // the server has no matching row.
    updatedMillis:
      id === LOCAL_ONLY_REMOTE_ID
        ? 0
        : isoToMillis(row.attributes?.dateUpdated ?? ''),
  }));
}

export function maxUpdatedMillis(rows: ChecksumRow[]): number {
  return rows.reduce((max, row) => Math.max(max, row.updatedMillis), 0);
}

export function fullPullSinceMillis(): number {
  return DateTime.now().toMillis() - FULL_PULL_DAYS * MS_PER_DAY;
}

/** Records of `table` whose `relation` points at `record`. */
export function recordsRelatedTo<T extends BaseModel>(
  memory: Memory,
  table: string,
  relation: string,
  record: { type: string; id: string }
): T[] {
  // Relation-filtered cache.query is untyped; the table selects the model.
  return (
    (memory.cache.query((q) =>
      q.findRecords(table).filter({ relation, record })
    ) as T[] | undefined) ?? []
  );
}

/** The records one project's sanity check is scoped to. */
export interface SanityScope {
  memory: Memory;
  project: ProjectD;
  plan: PlanD;
}

export function rowsForSanityTable(
  scope: SanityScope,
  table: SyncTable
): BaseModel[] {
  const { memory, project, plan } = scope;
  // related() returns the to-one id as any; a missing organization is null.
  const org: string | null = related(project, 'organization') ?? null;

  const allRecords = <Table extends keyof RecordByType>(name: Table) =>
    findRecords(memory, name);

  const relatedTo = <T extends BaseModel>(
    name: string,
    relation: string,
    recordType: string,
    id: string
  ) => recordsRelatedTo<T>(memory, name, relation, { type: recordType, id });

  const remoteRows = <T extends BaseModel>(rows: T[]) =>
    rows.filter(
      (row) => Boolean(row?.keys?.remoteId) && Boolean(row.relationships)
    );

  const remoteIdRows = <T extends BaseModel>(rows: T[]) =>
    rows.filter((row) => Boolean(row?.keys?.remoteId));

  const idSet = (rows: { id?: string }[]) => new Set(rows.map((row) => row.id));

  /** Rows whose `relation` id is in `ids`. */
  const filterByRelatedIds = <T extends BaseModel>(
    rows: T[],
    relation: RelKey<T>,
    ids: Set<string | undefined>
  ) => rows.filter((row) => ids.has(related(row, relation)));

  const byOrg = <Table extends keyof RecordByType>(name: Table) =>
    // Org-scoped sync tables extend BaseModel; analytics tables do not use this path.
    (org
      ? relatedTo(name, 'organization', 'organization', org)
      : []) as RecordByType[Table][];

  const groups = () =>
    org ? remoteIdRows(relatedTo('group', 'owner', 'organization', org)) : [];

  const mediafiles = () =>
    remoteRows(relatedTo('mediafile', 'plan', 'plan', plan.id));

  const sections = () =>
    remoteIdRows(relatedTo('section', 'plan', 'plan', plan.id));

  const passages = () =>
    filterByRelatedIds(allRecords('passage'), 'section', idSet(sections()));

  const sectionResources = () =>
    filterByRelatedIds(
      allRecords('sectionresource'),
      'section',
      idSet(sections())
    );

  const discussions = () => {
    const mediafileIds = idSet(mediafiles());
    return allRecords('discussion').filter(
      (row) =>
        Boolean(row.relationships) &&
        mediafileIds.has(related(row, 'mediafile'))
    );
  };

  const sharedResources = () =>
    filterByRelatedIds(
      allRecords('sharedresource'),
      'passage',
      idSet(passages())
    );

  if (isWholeRemoteTable(table)) {
    // activitystate is in the schema but not RecordByType.
    return remoteRows(findRecords(memory, table) as BaseModel[]);
  }
  if (isOrgTable(table)) return byOrg(table);

  switch (table) {
    case 'artifactcategory':
      return remoteRows(allRecords('artifactcategory')).filter(
        (row) =>
          related(row, 'organization') === org ||
          related(row, 'organization') === null
      );
    case 'comment':
      return filterByRelatedIds(
        allRecords('comment'),
        'discussion',
        idSet(discussions())
      );
    case 'discussion':
      return discussions();
    case 'group':
      return groups();
    case 'groupmembership':
      return filterByRelatedIds(
        allRecords('groupmembership'),
        'group',
        idSet(groups())
      );
    case 'mediafile':
      return mediafiles();
    case 'mediareplacement':
      return remoteRows(mediaReplacementsForPlans(memory, [plan.id]));
    case 'organization': {
      const record = org ? findRecord(memory, 'organization', org) : undefined;
      return record ? [record] : [];
    }
    case 'organizationschemestep':
      return filterByRelatedIds(
        allRecords('organizationschemestep'),
        'organizationscheme',
        idSet(byOrg('organizationscheme'))
      );
    case 'passage':
      return passages();
    case 'passagestatechange':
      return filterByRelatedIds(
        allRecords('passagestatechange'),
        'passage',
        idSet(passages())
      );
    case 'plan':
      return [plan];
    case 'project':
      return [project];
    case 'projectintegration':
      return relatedTo('projectintegration', 'project', 'project', project.id);
    case 'section':
      return sections();
    case 'sectionresource':
      return sectionResources();
    case 'sectionresourceuser':
      return filterByRelatedIds(
        allRecords('sectionresourceuser'),
        'sectionresource',
        idSet(sectionResources())
      );
    case 'sharedresource':
      return sharedResources();
    case 'sharedresourcereference':
      return filterByRelatedIds(
        allRecords('sharedresourcereference'),
        'sharedResource',
        idSet(sharedResources())
      );
    case 'user': {
      const userIds = new Set(
        byOrg('organizationmembership')
          .map((row) => related(row, 'user'))
          .filter((id): id is string => typeof id === 'string')
      );
      return allRecords('user').filter((row) => userIds.has(row.id ?? ''));
    }
    default: {
      // Exhaustive: a table added to fileOrder without a case here is a
      // compile error on this line.
      const unhandled: never = table;
      return unhandled;
    }
  }
}

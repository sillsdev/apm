import type Memory from '@orbit/memory';
import { DateTime } from 'luxon';
import { BaseModel } from '../model/baseModel';
import type { RecordByType } from '../model/recordByType';
import type { PlanD } from '../model/plan';
import type { ProjectD } from '../model/project';
import { findRecord, findRecords } from './tryFindRecord';
import { related, type RelKey } from './related';
import { mediaReplacementsForPlans } from './mediaReplacementsForPlans';

/** Server vwchecksum sums each row's date millis modulo this. */
export const CHECKSUM_MODULUS = 100_000_000;

/** Above this many local rows, the first repair pull is two weeks instead of four years. */
export const LARGE_TABLE_ROW_COUNT = 500;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RECENT_PULL_DAYS = 14;
const FULL_PULL_DAYS = 365 * 4;

const WHOLE_REMOTE_TABLES = new Set([
  'activitystate',
  'artifacttype',
  'bible',
  'integration',
  'passagetype',
  'plantype',
  'projecttype',
  'role',
  'workflowstep',
]);

const ORG_TABLES = new Set([
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
]);

export interface ChecksumRow {
  id: string;
  num: number;
}

/** Empty or unparseable timestamps contribute 0 so one bad row cannot NaN the checksum. */
export function isoToMillis(value: string): number {
  if (!value) return 0;
  const iso = value.endsWith('Z') ? value : `${value}Z`;
  const millis = DateTime.fromISO(iso).toMillis();
  return Number.isFinite(millis) ? millis : 0;
}

export function checksumOf(rows: ChecksumRow[]): number {
  return rows.reduce((sum, row) => sum + (row.num % CHECKSUM_MODULUS), 0);
}

/** One row per remote id. The first row wins; rows with no relationships are ignored. */
export function dedupedChecksumRows(rows: BaseModel[]): ChecksumRow[] {
  const byRemoteId = new Map<string, BaseModel>();
  for (const row of rows) {
    if (!row?.relationships) continue;
    const id = row.keys?.remoteId || '0';
    if (!byRemoteId.has(id)) byRemoteId.set(id, row);
  }
  return [...byRemoteId.entries()].map(([id, row]) => ({
    id,
    num: isoToMillis(row.attributes?.dateUpdated ?? ''),
  }));
}

export function pullSinceMillis(rowCount: number, now: number): number {
  const days =
    rowCount > LARGE_TABLE_ROW_COUNT ? RECENT_PULL_DAYS : FULL_PULL_DAYS;
  return now - days * MS_PER_DAY;
}

type RowQuery = Parameters<Memory['cache']['query']>[0];

/** Relation-filtered cache.query stays untyped; the table selects the model. */
function queryRecords<T extends BaseModel>(
  memory: Memory,
  build: RowQuery
): T[] {
  return (memory.cache.query(build) as T[] | undefined) ?? [];
}

export function rowsForSanityTable(props: {
  memory: Memory | undefined;
  project: ProjectD;
  plan: PlanD;
  table: string;
  /** Called when `table` has no filter. The caller still receives [] and may refresh it. */
  onUnknownTable?: (table: string) => void;
}): BaseModel[] {
  const { memory, project, plan, table, onUnknownTable } = props;
  if (!memory) return [];
  // related() returns the to-one id as any; a missing organization is null.
  const org = related(project, 'organization') as string;

  const all = <Table extends keyof RecordByType>(name: Table) =>
    findRecords(memory, name);

  const relatedTo = <T extends BaseModel>(
    name: string,
    relation: string,
    recordType: string,
    id: string
  ) =>
    queryRecords<T>(memory, (q) =>
      q.findRecords(name).filter({
        relation,
        record: { type: recordType, id },
      })
    );

  const remoteRows = <T extends BaseModel>(rows: T[]) =>
    rows.filter(
      (row) => Boolean(row?.keys?.remoteId) && Boolean(row.relationships)
    );

  const remoteIdRows = <T extends BaseModel>(rows: T[]) =>
    rows.filter((row) => Boolean(row?.keys?.remoteId));

  const idSet = (rows: { id?: string }[]) => new Set(rows.map((row) => row.id));

  const pointingAt = <T extends BaseModel>(
    rows: T[],
    relation: RelKey<T>,
    ids: Set<string | undefined>
  ) => rows.filter((row) => ids.has(related(row, relation)));

  const byOrg = <Table extends keyof RecordByType>(name: Table) =>
    // Org-scoped sync tables extend BaseModel; analytics tables do not use this path.
    relatedTo(
      name,
      'organization',
      'organization',
      org
    ) as RecordByType[Table][];

  const mediafiles = () =>
    remoteRows(relatedTo('mediafile', 'plan', 'plan', plan.id));

  const sections = () =>
    remoteIdRows(relatedTo('section', 'plan', 'plan', plan.id));

  const passages = () =>
    pointingAt(all('passage'), 'section', idSet(sections()));

  const sectionResources = () =>
    pointingAt(all('sectionresource'), 'section', idSet(sections()));

  const discussions = () => {
    const mediafileIds = idSet(mediafiles());
    return all('discussion').filter(
      (row) =>
        Boolean(row.relationships) &&
        mediafileIds.has(related(row, 'mediafile'))
    );
  };

  const sharedResources = () =>
    pointingAt(all('sharedresource'), 'passage', idSet(passages()));

  if (WHOLE_REMOTE_TABLES.has(table)) {
    // activitystate is in the schema but not RecordByType.
    return remoteRows(findRecords(memory, table) as BaseModel[]);
  }
  if (ORG_TABLES.has(table)) {
    return byOrg(table as keyof RecordByType) as BaseModel[];
  }

  switch (table) {
    case 'artifactcategory':
      return remoteRows(all('artifactcategory')).filter(
        (row) =>
          related(row, 'organization') === org ||
          related(row, 'organization') === null
      );
    case 'comment':
      return pointingAt(all('comment'), 'discussion', idSet(discussions()));
    case 'discussion':
      return discussions();
    case 'group':
      return remoteIdRows(relatedTo('group', 'owner', 'organization', org));
    case 'groupmembership':
      return pointingAt(
        all('groupmembership'),
        'group',
        idSet(remoteIdRows(relatedTo('group', 'owner', 'organization', org)))
      );
    case 'mediafile':
      return mediafiles();
    case 'mediareplacement':
      return remoteRows(mediaReplacementsForPlans(memory, [plan.id]));
    case 'organization': {
      const record = findRecord(memory, 'organization', org);
      return record ? [record] : [];
    }
    case 'organizationschemestep':
      return pointingAt(
        all('organizationschemestep'),
        'organizationscheme',
        idSet(byOrg('organizationscheme'))
      );
    case 'passage':
      return passages();
    case 'passagestatechange':
      return pointingAt(
        all('passagestatechange'),
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
      return pointingAt(
        all('sectionresourceuser'),
        'sectionresource',
        idSet(sectionResources())
      );
    case 'sharedresource':
      return sharedResources();
    case 'sharedresourcereference':
      return pointingAt(
        all('sharedresourcereference'),
        'sharedResource',
        idSet(sharedResources())
      );
    case 'user': {
      const userIds = new Set(
        byOrg('organizationmembership')
          .map((row) => related(row, 'user'))
          .filter((id): id is string => typeof id === 'string')
      );
      return all('user').filter((row) => userIds.has(row.id ?? ''));
    }
    default:
      onUnknownTable?.(table);
      return [];
  }
}

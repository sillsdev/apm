import { useContext } from 'react';
import { findRecord, staticFiles, updateableFiles, type SyncTable } from '.';
import Memory from '@orbit/memory';
import Coordinator from '@orbit/coordinator';
import { DateTime } from 'luxon';
import { JSONAPISource } from '@orbit/jsonapi';
import { logError, Severity } from '../utils';
import { toError } from '../utils/toError';
import { VwChecksum, PlanD } from '../model';
import * as actions from '../store';
import { TokenContext } from '../context/TokenProvider';
import type { GlobalState } from '../context/GlobalContext';
import { API_CONFIG } from '../../api-variable';
import {
  processDataChanges,
  DATA_CHANGES_NETWORK_ABORT,
} from '../hoc/processDataChanges';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import {
  checksumOf,
  type ChecksumRow,
  dedupedChecksumRows,
  fullPullSinceMillis,
  maxUpdatedMillis,
  recordsRelatedTo,
  rowsForSanityTable,
  type SanityScope,
} from './sanityCheck';

/** Stop paging when the server repeats the same cursor this many times. */
const SAME_PAGE_RETRIES = 2;

/** `aborted` means network retries were exhausted — retry on a later sync pass. */
export type SanityCheckResult = { aborted: boolean };

const NOT_ABORTED: SanityCheckResult = { aborted: false };
const ABORTED: SanityCheckResult = { aborted: true };

/** What every repair pull needs, whichever project or table it pulls. */
interface PullContext {
  token: string;
  coordinator: Coordinator;
  errorReporter: GlobalState['errorReporter'];
  setLanguage: typeof actions.setLanguage;
}

/** Parents before children: a stale mediafile list makes discussion wrong. */
const SYNC_TABLES: SyncTable[] = [...staticFiles, ...updateableFiles]
  .sort((a, b) => (a.sort <= b.sort ? -1 : 1))
  .map((file) => file.table);

const pullTableSince = async (props: {
  context: PullContext;
  remoteProjectId: string;
  table: SyncTable;
  since: string;
}): Promise<SanityCheckResult> => {
  const { context, remoteProjectId, table, since } = props;
  const api =
    API_CONFIG.host + `/api/datachanges/project/${remoteProjectId}/${table}/`;
  let start = 1;
  let retriesLeft = SAME_PAGE_RETRIES;
  let startNext = 0;
  while (startNext >= 0 && retriesLeft > 0) {
    // Sequential: each page's cursor comes from the previous response.
    startNext = await processDataChanges({
      token: context.token,
      api: `${api}${startNext}/since/${since}`,
      params: undefined,
      started: start,
      coordinator: context.coordinator,
      // Not the signed-in user: a repair pull must not reload that user's orgs.
      user: '',
      errorReporter: context.errorReporter,
      setLanguage: context.setLanguage,
      // A repair pull is not a sync tick the user is watching.
      setDataChangeCount: () => undefined,
      fetchUrl: undefined,
    });
    if (startNext === DATA_CHANGES_NETWORK_ABORT) return ABORTED;
    if (startNext === start) retriesLeft -= 1;
    else start = startNext;
  }
  return NOT_ABORTED;
};

/**
 * Returns `checkAllProjects`, which compares each project's local tables with
 * the server's vwchecksum rows and re-pulls the tables that differ.
 */
export const useSanityCheck = (setLanguage: typeof actions.setLanguage) => {
  const [coordinator] = useGlobal('coordinator');
  // getSource is untyped; the coordinator registers these sources by name.
  const memory = coordinator?.getSource('memory') as Memory | undefined;
  const remote = coordinator?.getSource('datachanges') as
    JSONAPISource | undefined;
  const token = useContext(TokenContext)?.state?.accessToken || '';
  const [errorReporter] = useGlobal('errorReporter');
  const getGlobal = useGetGlobal();

  const checkProject = async (
    projectId: string
  ): Promise<SanityCheckResult> => {
    // `offline` is an Electron local-mode session. `connected` is false when
    // an online session has lost its network. Either way there is no server pull.
    if (!token || getGlobal('offline') || !getGlobal('connected')) {
      return NOT_ABORTED;
    }
    if (!memory || !remote || !coordinator) return NOT_ABORTED;

    const project = findRecord(memory, 'project', projectId);
    const remoteProjectId = project?.keys?.remoteId ?? '';
    if (!project || !remoteProjectId) return NOT_ABORTED;

    const [plan] = recordsRelatedTo<PlanD>(memory, 'plan', 'project', {
      type: 'project',
      id: projectId,
    });
    // Plan-scoped tables (mediafile, section, passage) have no owner without one.
    if (!plan) return NOT_ABORTED;

    const scope: SanityScope = { memory, project, plan };
    const context: PullContext = {
      token,
      coordinator,
      errorReporter,
      setLanguage,
    };
    const checksumRows = (table: SyncTable) =>
      dedupedChecksumRows(rowsForSanityTable(scope, table));

    await remote.activated;
    let checksums: VwChecksum[];
    try {
      // query() is untyped; this filter reads vwchecksum rows for the project.
      checksums = (await remote.query((q) =>
        q
          .findRecords('vwchecksum')
          .filter({ attribute: 'project-id', value: remoteProjectId })
      )) as VwChecksum[];
    } catch (err: unknown) {
      // Skip this pass. The next sync interval can try again.
      logError(Severity.error, errorReporter, toError(err));
      return ABORTED;
    }

    const refreshTable = async (
      table: SyncTable,
      rows: ChecksumRow[],
      remoteChecksum: number
    ): Promise<SanityCheckResult> => {
      const pull = (sinceMillis: number) =>
        pullTableSince({
          context,
          remoteProjectId,
          table,
          since: DateTime.fromMillis(sinceMillis).toISO() || '',
        });
      try {
        const maxUpdated = maxUpdatedMillis(rows);
        const fullSince = fullPullSinceMillis();
        // Prefer the newest local stamp so we only page recent changes.
        // No local dates means the full window is the only pull.
        // `return await` keeps a rejected pull inside this try.
        if (maxUpdated <= 0) return await pull(fullSince);
        const recent = await pull(maxUpdated);
        // Network retries already failed; stop this pass entirely.
        if (recent.aborted) return recent;
        if (checksumOf(checksumRows(table)) === remoteChecksum) {
          return NOT_ABORTED;
        }
        // Max dateUpdated was not enough; fall back to the four-year window.
        return await pull(fullSince);
      } catch (err: unknown) {
        logError(Severity.error, errorReporter, toError(err));
        return NOT_ABORTED;
      }
    };

    const refreshIfStale = async (
      table: SyncTable
    ): Promise<SanityCheckResult> => {
      const rows = checksumRows(table);
      const remoteChecksum =
        checksums.find((row) => row.attributes.name === table)?.attributes
          .checksum ?? 0;
      if (checksumOf(rows) === remoteChecksum) return NOT_ABORTED;
      return refreshTable(table, rows, remoteChecksum);
    };

    // Sequential on purpose: SYNC_TABLES is ordered parents before children.
    for (const table of SYNC_TABLES) {
      const { aborted } = await refreshIfStale(table); // NOSONAR: ordered, see above
      // Same outage would hit every later table; wait for the next pass.
      if (aborted) return ABORTED;
    }
    return NOT_ABORTED;
  };

  /** Checks each project in turn and stops at the first network abort. */
  const checkAllProjects = async (
    projectIds: string[]
  ): Promise<SanityCheckResult> => {
    for (const projectId of projectIds) {
      // One project at a time: each check can pull whole tables.
      const result = await checkProject(projectId); // NOSONAR: see above
      if (result.aborted) return result;
    }
    return NOT_ABORTED;
  };

  return { checkAllProjects };
};

import { useContext } from 'react';
import { findRecord, staticFiles, updateableFiles } from '.';
import Memory from '@orbit/memory';
import Coordinator from '@orbit/coordinator';
import { DateTime } from 'luxon';
import { JSONAPISource } from '@orbit/jsonapi';
import { logError, Severity } from '../utils';
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
  rowsForSanityTable,
} from './sanityCheck';

type ErrorReporter = GlobalState['errorReporter'];

/** Stop paging when the server repeats the same cursor this many times. */
const SAME_PAGE_RETRIES = 2;

function reportedError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/** `aborted` means network retries were exhausted — retry on a later sync pass. */
export type SanityCheckResult = { aborted: boolean };

const pullTableSince = async (props: {
  token: string;
  coordinator: Coordinator;
  remoteProjectId: string;
  table: string;
  since: string;
  errorReporter: ErrorReporter;
  setLanguage: typeof actions.setLanguage;
}): Promise<SanityCheckResult> => {
  const api =
    API_CONFIG.host +
    `/api/datachanges/project/${props.remoteProjectId}/${props.table}/`;
  let start = 1;
  let retriesLeft = SAME_PAGE_RETRIES;
  let startNext = 0;
  while (startNext >= 0 && retriesLeft > 0) {
    startNext = await processDataChanges({
      token: props.token,
      api: `${api}${startNext}/since/${props.since}`,
      params: undefined,
      started: start,
      coordinator: props.coordinator,
      // Not the signed-in user: a repair pull must not reload that user's orgs.
      user: '',
      errorReporter: props.errorReporter,
      setLanguage: props.setLanguage,
      // A repair pull is not a sync tick the user is watching.
      setDataChangeCount: () => undefined,
      fetchUrl: undefined,
    });
    if (startNext === DATA_CHANGES_NETWORK_ABORT) return { aborted: true };
    if (startNext === start) retriesLeft -= 1;
    else start = startNext;
  }
  return { aborted: false };
};

export const useSanityCheck = (setLanguage: typeof actions.setLanguage) => {
  const [coordinator] = useGlobal('coordinator');
  // getSource is untyped; the coordinator registers these sources by name.
  const memory = coordinator?.getSource('memory') as Memory | undefined;
  const remote = coordinator?.getSource('datachanges') as
    JSONAPISource | undefined;
  const token = useContext(TokenContext)?.state?.accessToken || '';
  const [errorReporter] = useGlobal('errorReporter');
  const getGlobal = useGetGlobal();

  return async (projectId: string): Promise<SanityCheckResult> => {
    // `offline` is an Electron local-mode session. `connected` is false when
    // an online session has lost its network. Either way there is no server pull.
    if (!token || getGlobal('offline') || !getGlobal('connected')) {
      return { aborted: false };
    }
    if (!memory || !remote || !coordinator) return { aborted: false };

    const project = findRecord(memory, 'project', projectId);
    const remoteProjectId = project?.keys?.remoteId ?? '';
    if (!project || !remoteProjectId) return { aborted: false };

    // Relation filter stays on the query. The table selects the model.
    const plans =
      (memory.cache.query((q) =>
        q.findRecords('plan').filter({
          relation: 'project',
          record: { type: 'project', id: projectId },
        })
      ) as PlanD[] | undefined) ?? [];
    const plan = plans[0];
    // Plan-scoped tables (mediafile, section, passage) have no owner without one.
    if (!plan) return { aborted: false };

    const tables = [...staticFiles, ...updateableFiles]
      .sort((a, b) => (a.sort <= b.sort ? -1 : 1))
      .map((file) => file.table);

    const tableRows = (table: string) =>
      rowsForSanityTable({
        memory,
        project,
        plan,
        table,
        onUnknownTable: (unknown) => {
          const message = `sanity check has no row filter for ${unknown}`;
          // A missing filter is a programming error: add the table to
          // rowsForSanityTable. sanityCheck.test.ts fails for any fileOrder
          // table without one, so this only reports what slipped past CI.
          logError(Severity.error, errorReporter, message);
        },
      });

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
      logError(Severity.error, errorReporter, reportedError(err));
      return { aborted: true };
    }

    const refreshTable = async (
      table: string,
      rows: ChecksumRow[],
      remoteChecksum: number
    ): Promise<SanityCheckResult> => {
      const pull = async (sinceMillis: number): Promise<SanityCheckResult> => {
        const since = DateTime.fromMillis(sinceMillis).toISO() || '';
        return pullTableSince({
          token,
          coordinator,
          remoteProjectId,
          table,
          since,
          errorReporter,
          setLanguage,
        });
      };
      try {
        const maxUpdated = maxUpdatedMillis(rows);
        const fullSince = fullPullSinceMillis();
        // Prefer the newest local stamp so we only page recent changes.
        // No local dates means the full window is the only pull.
        if (maxUpdated <= 0) return pull(fullSince);
        const recent = await pull(maxUpdated);
        // Network retries already failed; stop this pass entirely.
        if (recent.aborted) return recent;
        const after = dedupedChecksumRows(tableRows(table));
        if (checksumOf(after) === remoteChecksum) return { aborted: false };
        // Max dateUpdated was not enough; fall back to the four-year window.
        return pull(fullSince);
      } catch (err: unknown) {
        logError(Severity.error, errorReporter, reportedError(err));
        return { aborted: false };
      }
    };

    const refreshIfStale = async (
      table: string
    ): Promise<SanityCheckResult> => {
      const rows = dedupedChecksumRows(tableRows(table));
      const local = checksumOf(rows);
      const remoteChecksum =
        checksums.find((row) => row.attributes.name === table)?.attributes
          .checksum ?? 0;
      if (local === remoteChecksum) return { aborted: false };
      return refreshTable(table, rows, remoteChecksum);
    };
    // Sequential on purpose: parents before children, because a stale
    // mediafile list makes the discussion checksum wrong.
    for (const table of tables) {
      // NOSONAR: sequential by design, see above
      const { aborted } = await refreshIfStale(table);
      // Same outage would hit every later table; wait for the next pass.
      if (aborted) return { aborted: true };
    }
    return { aborted: false };
  };
};

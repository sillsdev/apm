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
  dedupedChecksumRows,
  LARGE_TABLE_ROW_COUNT,
  pullSinceMillis,
  rowsForSanityTable,
} from './sanityCheck';

type ErrorReporter = GlobalState['errorReporter'];

/** Stop paging when the server repeats the same cursor this many times. */
const SAME_PAGE_RETRIES = 2;

function reportedError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

const pullTableSince = async (props: {
  token: string;
  coordinator: Coordinator;
  remoteProjectId: string;
  table: string;
  since: string;
  errorReporter: ErrorReporter;
  setLanguage: typeof actions.setLanguage;
}) => {
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
    if (startNext === DATA_CHANGES_NETWORK_ABORT) break;
    if (startNext === start) retriesLeft -= 1;
    else start = startNext;
  }
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

  return async (projectId: string) => {
    // `offline` is an Electron local-mode session. `connected` is false when
    // an online session has lost its network. Either way there is no server pull.
    if (!token || getGlobal('offline') || !getGlobal('connected')) return;
    if (!memory || !remote || !coordinator) return;

    const project = findRecord(memory, 'project', projectId);
    const remoteProjectId = project?.keys?.remoteId ?? '';
    if (!project || !remoteProjectId) return;

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
    if (!plan) return;

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
          // A missing filter is a programming error. Developers should see it
          // immediately; everyone else reports it and continues the check.
          if (getGlobal('developer')) throw new Error(message);
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
          .filter({ attribute: 'project-id', value: project.keys?.remoteId })
      )) as VwChecksum[];
    } catch (err: unknown) {
      // Skip this pass. The next sync interval can try again.
      logError(Severity.error, errorReporter, reportedError(err));
      return;
    }

    const refreshTable = async (
      table: string,
      rowCount: number,
      remoteChecksum: number
    ) => {
      const pull = async (count: number) => {
        const since =
          DateTime.fromMillis(
            pullSinceMillis(count, DateTime.now().toMillis())
          ).toISO() || '';
        await pullTableSince({
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
        await pull(rowCount);
        if (rowCount <= LARGE_TABLE_ROW_COUNT) return;
        const after = dedupedChecksumRows(tableRows(table));
        if (checksumOf(after) === remoteChecksum) return;
        // Two weeks was not enough to match; pull the four-year window.
        await pull(0);
      } catch (err: unknown) {
        logError(Severity.error, errorReporter, reportedError(err));
      }
    };

    const refreshIfStale = (table: string) => {
      const rows = dedupedChecksumRows(tableRows(table));
      const local = checksumOf(rows);
      const remoteChecksum =
        checksums.find((row) => row.attributes.name === table)?.attributes
          .checksum ?? 0;
      if (local === remoteChecksum) return Promise.resolve();
      return refreshTable(table, rows.length, remoteChecksum);
    };
    // Parents before children: a stale mediafile list makes discussion wrong.
    await tables.reduce(
      (pending, table) => pending.then(() => refreshIfStale(table)),
      Promise.resolve()
    );
  };
};

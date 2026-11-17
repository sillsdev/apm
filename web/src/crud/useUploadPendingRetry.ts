import { useContext, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import Memory from '@orbit/memory';
import JSONAPISource from '@orbit/jsonapi';
import { IndexedDBSource } from '@orbit/indexeddb';
import { isElectron } from '../../api-variable';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { TokenContext } from '../context/TokenProvider';
import { MediaFileAttributes } from '../model';
import * as actions from '../store';
import { completePendingUploadRetry } from '../store/upload/completePendingUploadRetry';
import { drainUploadPending } from '../store/upload/drainUploadPending';
import {
  listUploadPendingEntries,
  type UploadPendingEntry,
} from '../store/upload/uploadPendingBlobs';
import { infoMsg } from '../utils/infoMsg';
import { logError, Severity } from '../utils/logErrorService';

/**
 * Web: retries the current project's Upload Pending recordings when the
 * browser comes back online, and once when a project opens (a reload may
 * have interrupted an upload). Desktop retries from its Pending Uploads
 * dialog instead. Background drain through DataChanges is PR4's.
 */
export function useUploadPendingRetry(): void {
  const dispatch = useDispatch();
  const getGlobal = useGetGlobal();
  const [project] = useGlobal('project');
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? '';
  const drainingRef = useRef(false);

  useEffect(() => {
    if (isElectron || !project || !accessToken) return;

    const uploadOne = (entry: UploadPendingEntry): Promise<boolean> =>
      new Promise((resolve) => {
        const coordinator = getGlobal('coordinator');
        const memory = coordinator?.getSource('memory') as Memory | undefined;
        const remote = coordinator?.getSource('remote') as
          JSONAPISource | undefined;
        const backup = coordinator?.getSource('backup') as
          IndexedDBSource | undefined;
        const reporter = getGlobal('errorReporter');
        dispatch(
          actions.nextUpload({
            // The snapshot was taken from a MediaFileAttributes record at
            // upload time and validated when read back from IndexedDB.
            record: entry.request.record as unknown as MediaFileAttributes,
            files: [entry.file],
            n: 0,
            token: accessToken,
            offline: false,
            errorReporter: reporter,
            uploadType: entry.request.uploadType,
            projectId: entry.projectId,
            pendingUploadIdToClearOnSuccess: entry.key,
            pendingRestore: entry.request.restore,
            getImportExportBusy: () => Boolean(getGlobal('importexportBusy')),
            // nextUpload calls cb on every path, so the promise settles.
            cb: async (_n, success, data) => {
              try {
                const stringId = (data as { stringId?: string } | undefined)
                  ?.stringId;
                if (success && stringId && memory && remote && backup) {
                  await completePendingUploadRetry({
                    stringId,
                    restore: entry.request.restore,
                    memory,
                    remote,
                    backup,
                    reporter,
                    user: getGlobal('user'),
                  });
                }
              } finally {
                resolve(success);
              }
            },
          }) as never
        );
      });

    const drain = async () => {
      if (drainingRef.current || !navigator.onLine) return;
      drainingRef.current = true;
      try {
        await drainUploadPending(
          await listUploadPendingEntries(project),
          uploadOne
        );
      } catch (err: unknown) {
        // The blobs stay Upload Pending; the next online event tries again.
        logError(
          Severity.error,
          getGlobal('errorReporter'),
          infoMsg(err as Error, 'Upload Pending retry failed')
        );
      } finally {
        drainingRef.current = false;
      }
    };
    const handleOnline = () => {
      void drain(); // drain reports its own errors
    };

    handleOnline();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
    // getGlobal is left out: useGetGlobal returns a new function every render,
    // which would re-run this effect (and a drain) on each DataChanges render.
    // It reads live global state, so the closure never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, accessToken, dispatch]);
}

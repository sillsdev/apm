import { useCallback, useContext, useEffect, useRef } from 'react';
import { isElectron } from '../../api-variable';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { TokenContext } from '../context/TokenProvider';
import { drainUploadPending } from '../store/upload/drainUploadPending';
import { listUploadPendingEntries } from '../store/upload/uploadPendingBlobs';
import { infoMsg } from '../utils/infoMsg';
import { logError, Severity } from '../utils/logErrorService';
import { useUploadPendingBlobUpload } from './useUploadPendingBlobUpload';

export type UploadPendingRetryApi = {
  /**
   * Starts a drain without awaiting it. DataChanges calls this after a
   * successful sync so Upload Pending uploads resume in the background. A
   * request made while a drain is running queues one more pass, so it is
   * never lost.
   */
  requestDrain: () => void;
};

/**
 * Web: retries the current project's Upload Pending recordings when the
 * browser comes back online, when a project opens (a reload may have
 * interrupted an upload), and whenever DataChanges requests a drain after
 * a successful sync. Desktop retries from its Pending Uploads dialog instead.
 */
export function useUploadPendingRetry(): UploadPendingRetryApi {
  const getGlobal = useGetGlobal();
  const [project] = useGlobal('project');
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? '';
  const uploadOne = useUploadPendingBlobUpload();
  const drainingRef = useRef(false);
  const rerunRef = useRef(false);
  // requestDrain is called from an event listener and from DataChanges'
  // interval, so it reads these through refs to stay stable. useGetGlobal
  // returns a new function every render, which is why it is in a ref too.
  const projectRef = useRef(project);
  const tokenRef = useRef(accessToken);
  const getGlobalRef = useRef(getGlobal);
  const uploadOneRef = useRef(uploadOne);
  // Declared before the drain effect below, so the refs are current when
  // that effect requests the open-project drain in the same commit.
  useEffect(() => {
    projectRef.current = project;
    tokenRef.current = accessToken;
    getGlobalRef.current = getGlobal;
    uploadOneRef.current = uploadOne;
  });

  const requestDrain = useCallback(() => {
    if (isElectron) return;
    if (drainingRef.current) {
      rerunRef.current = true;
      return;
    }

    /** One pass over the current project; rerun if asked during the pass. */
    const drain = async () => {
      drainingRef.current = true;
      try {
        do {
          rerunRef.current = false;
          // Read on every pass: the project may have changed mid-drain.
          const projectId = projectRef.current;
          const token = tokenRef.current;
          if (!projectId || !token || !navigator.onLine) break;
          try {
            await drainUploadPending(
              await listUploadPendingEntries(projectId),
              (entry) => uploadOneRef.current(entry)
            );
          } catch (err: unknown) {
            // The blobs stay Upload Pending; the next online event or sync
            // tries again.
            logError(
              Severity.error,
              getGlobalRef.current('errorReporter'),
              infoMsg(err as Error, 'Upload Pending retry failed')
            );
          }
        } while (rerunRef.current);
      } finally {
        drainingRef.current = false;
      }
    };

    void drain(); // drain reports its own errors
  }, []);

  useEffect(() => {
    if (isElectron || !project || !accessToken) return;

    requestDrain();
    window.addEventListener('online', requestDrain);
    return () => window.removeEventListener('online', requestDrain);
  }, [project, accessToken, requestDrain]);

  return { requestDrain };
}

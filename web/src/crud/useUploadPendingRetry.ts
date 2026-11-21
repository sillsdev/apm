import { useCallback, useContext, useEffect, useRef } from 'react';
import { isElectron } from '../../api-variable';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { TokenContext } from '../context/TokenProvider';
import {
  drainUploadPending,
  withProjectDrainLock,
} from '../store/upload/drainUploadPending';
import { listUploadPendingEntries } from '../store/upload/uploadPendingBlobs';
import {
  isUploadPendingDrainMessage,
  requestUploadPendingBackgroundSync,
  type UploadPendingDrainReply,
  type UploadPendingDrainResult,
} from '../store/upload/uploadPendingBackgroundSync';
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
 * interrupted an upload), whenever DataChanges requests a drain after a
 * successful sync, and when the service worker's Background Sync asks this
 * tab to drain (it replies with the result). Desktop retries from its
 * Pending Uploads dialog instead.
 */
export function useUploadPendingRetry(): UploadPendingRetryApi {
  const getGlobal = useGetGlobal();
  const [project] = useGlobal('project');
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? '';
  const uploadOne = useUploadPendingBlobUpload();
  // The running drain, so later requests join it instead of starting another.
  const drainRef = useRef<Promise<UploadPendingDrainResult> | undefined>(
    undefined
  );
  const rerunRef = useRef(false);
  // runDrain is called from event listeners and from DataChanges' interval,
  // so it reads these through refs to stay stable. useGetGlobal returns a new
  // function every render, which is why it is in a ref too.
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

  /**
   * Starts a drain, or joins the running one and asks it for one more pass.
   * Resolves with the last pass's result; never rejects.
   */
  const runDrain = useCallback((): Promise<UploadPendingDrainResult> => {
    if (isElectron) return Promise.resolve('skipped');
    if (drainRef.current) {
      rerunRef.current = true;
      return drainRef.current;
    }

    /** One pass over the current project. */
    const drainPass = async (): Promise<UploadPendingDrainResult> => {
      // Read on every pass: the project may have changed mid-drain.
      const projectId = projectRef.current;
      if (!projectId || !tokenRef.current) return 'skipped';
      if (!navigator.onLine) {
        // The tab may close before connectivity returns; the browser fires
        // the sync then. Never rejects (catches inside).
        void requestUploadPendingBackgroundSync();
        return 'pending';
      }
      try {
        return await withProjectDrainLock<UploadPendingDrainResult>(
          projectId,
          async () => {
            await drainUploadPending(
              await listUploadPendingEntries(projectId),
              (entry) => uploadOneRef.current(entry)
            );
            // In-flight and failed uploads are still listed.
            const left = await listUploadPendingEntries(projectId);
            return left.length > 0 ? 'pending' : 'drained';
          },
          'skipped'
        );
      } catch (err: unknown) {
        // The blobs stay Upload Pending; the next online event, DataChanges
        // drain, or sync retry tries again.
        logError(
          Severity.error,
          getGlobalRef.current('errorReporter'),
          infoMsg(err as Error, 'Upload Pending retry failed')
        );
        return 'pending';
      }
    };

    const drain = async (): Promise<UploadPendingDrainResult> => {
      let result: UploadPendingDrainResult = 'skipped';
      try {
        do {
          rerunRef.current = false;
          result = await drainPass();
        } while (rerunRef.current);
      } finally {
        drainRef.current = undefined;
      }
      return result;
    };

    drainRef.current = drain();
    return drainRef.current;
  }, []);

  const requestDrain = useCallback(() => {
    void runDrain(); // never rejects; each pass reports its own errors
  }, [runDrain]);

  useEffect(() => {
    if (isElectron || !project || !accessToken) return;

    requestDrain();
    window.addEventListener('online', requestDrain);
    return () => window.removeEventListener('online', requestDrain);
  }, [project, accessToken, requestDrain]);

  // Listen even without a project, so this tab answers 'skipped' at once
  // instead of making the service worker wait for a reply that never comes.
  useEffect(() => {
    if (isElectron) return;
    const handleSwMessage = (event: MessageEvent) => {
      if (!isUploadPendingDrainMessage(event.data)) return;
      const port = event.ports[0];
      // runDrain never rejects. A .then keeps this handler synchronous.
      void runDrain().then((result) =>
        port?.postMessage({ result } satisfies UploadPendingDrainReply)
      );
    };
    navigator.serviceWorker?.addEventListener('message', handleSwMessage);
    return () =>
      navigator.serviceWorker?.removeEventListener('message', handleSwMessage);
  }, [runDrain]);

  return { requestDrain };
}

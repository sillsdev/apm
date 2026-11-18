import { useContext, useEffect, useRef } from 'react';
import { isElectron } from '../../api-variable';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { TokenContext } from '../context/TokenProvider';
import { drainUploadPending } from '../store/upload/drainUploadPending';
import { listUploadPendingEntries } from '../store/upload/uploadPendingBlobs';
import { infoMsg } from '../utils/infoMsg';
import { logError, Severity } from '../utils/logErrorService';
import { useUploadPendingBlobUpload } from './useUploadPendingBlobUpload';

/**
 * Web: retries the current project's Upload Pending recordings when the
 * browser comes back online, and once when a project opens (a reload may
 * have interrupted an upload). Desktop retries from its Pending Uploads
 * dialog instead. Background drain through DataChanges is PR4's.
 */
export function useUploadPendingRetry(): void {
  const getGlobal = useGetGlobal();
  const [project] = useGlobal('project');
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? '';
  const uploadOne = useUploadPendingBlobUpload();
  const drainingRef = useRef(false);

  useEffect(() => {
    if (isElectron || !project || !accessToken) return;

    const drain = async () => {
      if (drainingRef.current || !navigator.onLine) return;
      drainingRef.current = true;
      try {
        await drainUploadPending(
          await listUploadPendingEntries(project),
          (entry) => uploadOne(entry)
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
  }, [project, accessToken, uploadOne]);
}

import { useEffect, useState } from 'react';
import { useGlobal } from '../../context/useGlobal';
import {
  subscribeUploadPendingBlobs,
  uploadPendingBlobCountForProjects,
} from '../../store/upload/uploadPendingBlobs';
import { infoMsg } from '../../utils/infoMsg';
import { logError, Severity } from '../../utils/logErrorService';
import { useUserProjectIds } from './useUserProjectIds';

/**
 * Live count of the signed-in user's Upload Pending Local Media Blobs on this
 * device (web Team badge). Refreshes when the blob helpers notify a change.
 */
export function useUploadPendingBlobCount(): number {
  const [count, setCount] = useState(0);
  const [reporter] = useGlobal('errorReporter');
  const projectIds = useUserProjectIds();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      uploadPendingBlobCountForProjects(projectIds)
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        .catch((err: unknown) => {
          // The badge keeps its last count; the dialog lists what is there.
          logError(
            Severity.error,
            reporter,
            infoMsg(err as Error, 'Upload Pending count failed')
          );
        });
    };
    refresh();
    const unsubscribe = subscribeUploadPendingBlobs(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [projectIds, reporter]);

  return count;
}

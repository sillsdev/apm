import { useCallback, useContext } from 'react';
import { useDispatch } from 'react-redux';
import Memory from '@orbit/memory';
import JSONAPISource from '@orbit/jsonapi';
import { IndexedDBSource } from '@orbit/indexeddb';
import { useGetGlobal } from '../context/useGlobal';
import { TokenContext } from '../context/TokenProvider';
import { MediaFileAttributes } from '../model';
import * as actions from '../store';
import { completePendingUploadRetry } from '../store/upload/completePendingUploadRetry';
import type { UploadTerminalFailureInfo } from '../store/upload/actions';
import type { UploadPendingEntry } from '../store/upload/uploadPendingBlobs';
import {
  isLocalOnlyMediafile,
  linkLocalOnlyMediafile,
  resolveMediafileIdForServer,
} from './localOnlyMedia';

export interface UploadPendingBlobOptions {
  onTerminalFailure?: (info: UploadTerminalFailureInfo) => void;
}

/**
 * Web: returns a function that uploads one Upload Pending Local Media Blob
 * through `nextUpload`, finishing the Orbit restore on success. The promise
 * resolves with whether the upload succeeded and never rejects, because
 * `nextUpload` calls `cb` on every path.
 */
export function useUploadPendingBlobUpload(): (
  entry: UploadPendingEntry,
  options?: UploadPendingBlobOptions
) => Promise<boolean> {
  const dispatch = useDispatch();
  const getGlobal = useGetGlobal();
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? '';

  return useCallback(
    (entry, options) =>
      new Promise<boolean>((resolve) => {
        const coordinator = getGlobal('coordinator');
        // The coordinator registers these sources under these names at startup.
        const memory = coordinator?.getSource('memory') as Memory | undefined;
        const remote = coordinator?.getSource('remote') as
          JSONAPISource | undefined;
        const backup = coordinator?.getSource('backup') as
          IndexedDBSource | undefined;
        const reporter = getGlobal('errorReporter');
        // A take recorded offline against another offline take (e.g. LWC
        // translation of a Careful Speech take) names it by local id. The
        // drain runs oldest first, so that take is normally on the server by
        // now; if not, wait for a later pass.
        const record = { ...entry.request.record };
        if (memory && record.sourceMediaId) {
          const sourceMediaId = resolveMediafileIdForServer(
            memory,
            String(record.sourceMediaId)
          );
          if (sourceMediaId === undefined) {
            resolve(false);
            return;
          }
          record.sourceMediaId = sourceMediaId;
        }
        // The Orbit record of a take saved offline has the blob key as id.
        const localOnly =
          memory !== undefined && isLocalOnlyMediafile(memory, entry.key);
        dispatch(
          actions.nextUpload({
            // The snapshot was taken from a MediaFileAttributes record at
            // upload time and validated when read back from IndexedDB.
            record: record as unknown as MediaFileAttributes,
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
            onTerminalFailure: options?.onTerminalFailure,
            cb: async (_n, success, data) => {
              try {
                const stringId = (data as { stringId?: string } | undefined)
                  ?.stringId;
                if (success && stringId && memory && remote && backup) {
                  // Link before the pull so it updates the local record
                  // instead of adding a second one.
                  if (localOnly) {
                    await linkLocalOnlyMediafile(memory, entry.key, stringId);
                  }
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
            // nextUpload is a thunk; the store's dispatch type doesn't model it.
          }) as never
        );
      }),
    // getGlobal is left out: useGetGlobal returns a new function every render,
    // and it reads live global state, so the closure never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, dispatch]
  );
}

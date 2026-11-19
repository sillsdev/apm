import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import * as actions from '../../store';
import { TokenContext } from '../../context/TokenProvider';
import { useGetGlobal, useGlobal } from '../../context/useGlobal';
import { mediaTabSelector, sharedSelector } from '../../selector';
import { isElectron } from '../../../api-variable';
import { MainAPI } from '../../model/main-api';
import {
  loadPendingMediaUploads,
  removePendingMediaUpload,
  subscribePendingMediaUploads,
  type PendingUploadRecord,
} from '../../store/upload/pendingMediaUploads';
import {
  discardUploadPendingBlob,
  listUploadPendingEntriesForProjects,
  subscribeUploadPendingBlobs,
  type UploadPendingEntry,
} from '../../store/upload/uploadPendingBlobs';
import { formatUploadTerminalFailureMessage } from '../../store/upload/uploadTerminalMessages';
import { AlertSeverity, useSnackBar } from '../../hoc/SnackBar';
import JSONAPISource from '@orbit/jsonapi';
import { IndexedDBSource } from '@orbit/indexeddb';
import Memory from '@orbit/memory';
import { MediaFileAttributes } from '../../model';
import { useCheckOnline } from '../../utils/useCheckOnline';
import { Button } from '../../control/Button';
import { useUploadPendingBlobUpload } from '../../crud/useUploadPendingBlobUpload';
import { completePendingUploadRetry } from '../../store/upload/completePendingUploadRetry';
import { withPendingRetryBusyRelease } from '../../store/upload/withPendingRetryBusyRelease';
import { infoMsg } from '../../utils/infoMsg';
import { logError, Severity } from '../../utils/logErrorService';
import Confirm from '../AlertDialog';
import { useUserProjectIds } from './useUserProjectIds';

const ipc = window?.api as MainAPI;

interface IProps {
  open: boolean;
  onClose: () => void;
}

type DialogRow = {
  id: string;
  originalFile: string;
  secondary: string;
  desktop?: PendingUploadRecord;
  web?: UploadPendingEntry;
};

export function PendingUploadsDialog(props: IProps) {
  const { open, onClose } = props;
  const t = useSelector(mediaTabSelector, shallowEqual);
  const ts = useSelector(sharedSelector, shallowEqual);
  const dispatch = useDispatch();
  const { showMessage, messageReset } = useSnackBar();
  const [reporter] = useGlobal('errorReporter');
  const [coordinator] = useGlobal('coordinator');
  const [connected] = useGlobal('connected');
  const [offline] = useGlobal('offline');
  const [user] = useGlobal('user');
  const [, setSaveResult] = useGlobal('saveResult');
  const memory = coordinator?.getSource('memory') as Memory;
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
  const getGlobal = useGetGlobal();
  const checkOnline = useCheckOnline('PendingUploads');
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? '';
  const uploadPendingBlob = useUploadPendingBlobUpload();
  const projectIds = useUserProjectIds();
  const [items, setItems] = useState<DialogRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [discardId, setDiscardId] = useState<string | undefined>();
  const retryQueueRef = useRef<DialogRow[]>([]);
  /** Synchronous guard while waiting for Online() (before React flushes busy). */
  const retryClaimedRef = useRef(false);
  /** Bumped per refresh and on close, so a slower earlier read is dropped. */
  const refreshSeqRef = useRef(0);

  const retryDisabled = busy || !connected || offline;

  const clearStaleOfflineSaveSnack = useCallback(() => {
    // TT-7720: drop leftover offline-queue saveResult / snack before Record remount.
    setSaveResult('');
    messageReset();
  }, [messageReset, setSaveResult]);

  const refresh = useCallback(() => {
    if (isElectron) {
      setItems(
        loadPendingMediaUploads().map((row) => ({
          id: row.id,
          originalFile: row.record.originalFile,
          secondary: row.localAbsolutePath || '—',
          desktop: row,
        }))
      );
      return;
    }
    const seq = ++refreshSeqRef.current;
    listUploadPendingEntriesForProjects(projectIds)
      .then((entries) => {
        if (seq !== refreshSeqRef.current) return;
        setItems(
          entries.map((entry) => ({
            id: entry.key,
            originalFile: entry.request.record.originalFile,
            secondary: t.pendingUploadOnDeviceOnly,
            web: entry,
          }))
        );
      })
      .catch((err: unknown) => {
        // The list keeps its last rows; the next change notification retries.
        logError(
          Severity.error,
          reporter,
          infoMsg(err as Error, 'Upload Pending list failed')
        );
      });
  }, [projectIds, reporter, t.pendingUploadOnDeviceOnly]);

  // `nextUpload` drops the pending row *after* awaiting its success callback,
  // and that callback is what runs `finishOrContinue` -> `refresh()`. Reading
  // the list on that signal alone therefore always reads it one step stale, and
  // the retried row stays on screen for the user to click Retry again
  // (TT-7363). Subscribe instead, so the removal itself refreshes the list.
  useEffect(() => {
    if (!open) return;
    refresh();
    const unsubscribe = isElectron
      ? subscribePendingMediaUploads(refresh)
      : subscribeUploadPendingBlobs(refresh);
    return () => {
      refreshSeqRef.current += 1;
      unsubscribe();
    };
  }, [open, refresh]);

  const showNoConnectionMessage = useCallback(() => {
    showMessage(
      offline ? t.pendingUploadRetryLater : ts.mustBeOnline,
      AlertSeverity.Warning
    );
  }, [offline, showMessage, t.pendingUploadRetryLater, ts.mustBeOnline]);

  const releaseRetryClaim = useCallback(() => {
    retryClaimedRef.current = false;
    setBusy(false);
    retryQueueRef.current = [];
  }, []);

  const assertCanRetry = useCallback(
    (cb: () => void, onRejected: () => void) => {
      // forceCheck so Retry clears stale orbit network error while already
      // connected (TT-7720) via useCheckOnline's errorReset.
      checkOnline((isConnected) => {
        if (!isConnected) {
          showMessage(t.pendingUploadRetryLater, AlertSeverity.Warning);
          onRejected();
          return;
        }
        cb();
      }, true);
    },
    [checkOnline, showMessage, t]
  );

  /** Refreshes the list, then retries the next queued row or releases busy. */
  function finishOrContinue() {
    refresh();
    const next = retryQueueRef.current.shift();
    if (next) {
      dispatchRow(next);
    } else {
      retryClaimedRef.current = false;
      setBusy(false);
      clearStaleOfflineSaveSnack();
    }
  }

  async function dispatchDesktop(entry: PendingUploadRecord): Promise<void> {
    if (
      !entry.localAbsolutePath ||
      !ipc?.exists ||
      !(await ipc.exists(entry.localAbsolutePath))
    ) {
      removePendingMediaUpload(entry.id);
      finishOrContinue();
      return;
    }
    const buf = await ipc.read(entry.localAbsolutePath);
    if (!(buf instanceof Uint8Array)) {
      finishOrContinue();
      return;
    }
    const bytes = Uint8Array.from(buf);
    const file = new File([bytes], entry.record.originalFile, {
      type: entry.record.contentType,
    });
    dispatch(
      actions.nextUpload({
        record: entry.record as unknown as MediaFileAttributes,
        files: [file],
        n: 0,
        token: accessToken || '',
        offline: getGlobal('offline'),
        errorReporter: reporter,
        uploadType: entry.uploadType,
        pendingUploadIdToClearOnSuccess: entry.id,
        getImportExportBusy: () => Boolean(getGlobal('importexportBusy')),
        onTerminalFailure: (info) => {
          showMessage(
            formatUploadTerminalFailureMessage(t, info),
            AlertSeverity.Warning
          );
        },
        cb: async (_n, success, data) =>
          withPendingRetryBusyRelease(async () => {
            const sid = (data as { stringId?: string } | undefined)?.stringId;
            if (success && sid && memory && remote && backup) {
              await completePendingUploadRetry({
                stringId: sid,
                restore: entry.restore,
                memory,
                remote,
                backup,
                reporter,
                user,
              });
            }
          }, finishOrContinue),
      }) as never
    );
  }

  async function dispatchWeb(entry: UploadPendingEntry): Promise<void> {
    await uploadPendingBlob(entry, {
      onTerminalFailure: (info) => {
        showMessage(
          formatUploadTerminalFailureMessage(t, info),
          AlertSeverity.Warning
        );
      },
    });
    finishOrContinue();
  }

  function dispatchRow(row: DialogRow) {
    let upload: Promise<void>;
    if (row.desktop) upload = dispatchDesktop(row.desktop);
    else if (row.web) upload = dispatchWeb(row.web);
    else {
      finishOrContinue();
      return;
    }
    upload.catch((err: unknown) => {
      // Reading the desktop file failed before nextUpload ran: move on.
      logError(
        Severity.error,
        reporter,
        infoMsg(err as Error, 'Pending upload retry failed')
      );
      finishOrContinue();
    });
  }

  const handleRetryOne = (row: DialogRow) => {
    if (busy || retryClaimedRef.current) return;
    if (offline || !connected) {
      showNoConnectionMessage();
      return;
    }
    retryClaimedRef.current = true;
    setBusy(true);
    retryQueueRef.current = [];
    assertCanRetry(() => dispatchRow(row), releaseRetryClaim);
  };

  const handleRetryAll = () => {
    if (busy || retryClaimedRef.current) return;
    if (offline || !connected) {
      showNoConnectionMessage();
      return;
    }
    if (items.length === 0) return;
    retryClaimedRef.current = true;
    setBusy(true);
    retryQueueRef.current = items.slice(1);
    assertCanRetry(() => dispatchRow(items[0]), releaseRetryClaim);
  };

  const handleDismiss = (row: DialogRow) => {
    if (busy || retryClaimedRef.current) return;
    if (row.desktop) {
      removePendingMediaUpload(row.id);
      refresh();
      return;
    }
    // Web dismiss deletes the only copy — confirm first (ADR 0017).
    setDiscardId(row.id);
  };

  const handleConfirmDiscard = () => {
    const id = discardId;
    setDiscardId(undefined);
    if (!id) return;
    // A successful discard notifies the subscription, which refreshes the list.
    discardUploadPendingBlob(id).catch((err: unknown) => {
      logError(
        Severity.error,
        reporter,
        infoMsg(err as Error, 'Upload Pending discard failed')
      );
      showMessage(t.pendingUploadDiscardFailed, AlertSeverity.Error);
    });
  };

  const handleClose = () => {
    clearStaleOfflineSaveSnack();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{t.pendingUploadTitle}</DialogTitle>
        <DialogContent>
          {!isElectron && (
            <Typography variant="body2" sx={{ mb: 1 }}>
              {t.pendingUploadRiskHint}
            </Typography>
          )}
          {items.length === 0 ? (
            <Typography>{t.pendingUploadEmpty}</Typography>
          ) : (
            <List dense>
              {items.map((row) => (
                <ListItem
                  key={row.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    pr: 1,
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <ListItemText
                      primary={row.originalFile}
                      secondary={row.secondary}
                      slotProps={{
                        primary: {
                          noWrap: true,
                          title: row.originalFile,
                        },
                        secondary: {
                          noWrap: true,
                          title: row.secondary,
                        },
                      }}
                    />
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={retryDisabled}
                      onClick={() => handleRetryOne(row)}
                    >
                      {t.pendingUploadRetryOne}
                    </Button>
                    <Button
                      size="small"
                      disabled={busy}
                      onClick={() => handleDismiss(row)}
                    >
                      {t.pendingUploadDismiss}
                    </Button>
                  </Stack>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{ts.close}</Button>
          <Button
            variant="contained"
            disabled={retryDisabled || items.length === 0}
            onClick={handleRetryAll}
          >
            {t.pendingUploadBatchRetry}
          </Button>
        </DialogActions>
      </Dialog>
      {discardId && (
        <Confirm
          text={t.pendingUploadDismissWarn}
          yes={ts.yes}
          no={ts.cancel}
          isDelete
          primaryButton="no"
          yesResponse={handleConfirmDiscard}
          noResponse={() => setDiscardId(undefined)}
        />
      )}
    </>
  );
}

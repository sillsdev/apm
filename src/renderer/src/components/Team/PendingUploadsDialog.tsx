import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
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
  type PendingUploadRecord,
} from '../../store/upload/pendingMediaUploads';
import { formatUploadTerminalFailureMessage } from '../../store/upload/uploadTerminalMessages';
import { AlertSeverity, useSnackBar } from '../../hoc/SnackBar';
import { pullTableList } from '../../crud';
import JSONAPISource from '@orbit/jsonapi';
import { IndexedDBSource } from '@orbit/indexeddb';
import Memory from '@orbit/memory';
import { MediaFileAttributes } from '../../model';
import { Online } from '../../utils';

const ipc = window?.api as MainAPI;

interface IProps {
  open: boolean;
  onClose: () => void;
}

export function PendingUploadsDialog(props: IProps) {
  const { open, onClose } = props;
  const t = useSelector(mediaTabSelector, shallowEqual);
  const ts = useSelector(sharedSelector, shallowEqual);
  const dispatch = useDispatch();
  const { showMessage } = useSnackBar();
  const [reporter] = useGlobal('errorReporter');
  const [coordinator] = useGlobal('coordinator');
  const [connected] = useGlobal('connected');
  const [offline] = useGlobal('offline');
  const memory = coordinator?.getSource('memory') as Memory;
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
  const getGlobal = useGetGlobal();
  const accessToken = useContext(TokenContext)?.state?.accessToken ?? '';
  const [items, setItems] = useState<PendingUploadRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const retryQueueRef = useRef<PendingUploadRecord[]>([]);
  /** Synchronous guard while waiting for Online() (before React flushes busy). */
  const retryClaimedRef = useRef(false);

  const retryDisabled = busy || !connected || offline;

  const refresh = useCallback(() => {
    setItems(loadPendingMediaUploads());
  }, []);

  useEffect(() => {
    if (open) refresh();
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
      Online(true, (isConnected) => {
        if (!isConnected) {
          showMessage(t.pendingUploadRetryLater, AlertSeverity.Warning);
          onRejected();
          return;
        }
        cb();
      });
    },
    [showMessage, t.pendingUploadRetryLater]
  );

  async function dispatchOne(entry: PendingUploadRecord): Promise<void> {
    const finishOrContinue = () => {
      refresh();
      const next = retryQueueRef.current.shift();
      if (next) {
        void dispatchOne(next);
      } else {
        retryClaimedRef.current = false;
        setBusy(false);
      }
    };

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
        cb: async (_n, success, data) => {
          const sid = (data as { stringId?: string } | undefined)?.stringId;
          if (success && sid && memory && remote && backup) {
            await pullTableList(
              'mediafile',
              [sid],
              memory,
              remote,
              backup,
              reporter
            );
          }
          finishOrContinue();
        },
      }) as never
    );
  }

  const handleRetryOne = (entry: PendingUploadRecord) => {
    if (busy || retryClaimedRef.current) return;
    if (offline || !connected) {
      showNoConnectionMessage();
      return;
    }
    retryClaimedRef.current = true;
    setBusy(true);
    retryQueueRef.current = [];
    assertCanRetry(() => void dispatchOne(entry), releaseRetryClaim);
  };

  const handleRetryAll = () => {
    if (busy || retryClaimedRef.current) return;
    if (offline || !connected) {
      showNoConnectionMessage();
      return;
    }
    const all = loadPendingMediaUploads();
    if (all.length === 0) return;
    retryClaimedRef.current = true;
    setBusy(true);
    retryQueueRef.current = all.slice(1);
    assertCanRetry(() => void dispatchOne(all[0]), releaseRetryClaim);
  };

  const handleDismiss = (id: string) => {
    if (busy || retryClaimedRef.current) return;
    removePendingMediaUpload(id);
    refresh();
  };

  if (!isElectron) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t.pendingUploadTitle}</DialogTitle>
      <DialogContent>
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
                    primary={row.record.originalFile}
                    secondary={row.localAbsolutePath || '—'}
                    slotProps={{
                      primary: {
                        noWrap: true,
                        title: row.record.originalFile,
                      },
                      secondary: {
                        noWrap: true,
                        title: row.localAbsolutePath || undefined,
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
                    onClick={() => handleDismiss(row.id)}
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
        <Button onClick={onClose}>{ts.close}</Button>
        <Button
          variant="contained"
          disabled={retryDisabled || items.length <= 1}
          onClick={handleRetryAll}
        >
          {t.pendingUploadBatchRetry}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

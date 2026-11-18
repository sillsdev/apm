import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { isElectron } from '../../api-variable';
import {
  UploadPendingLeaveDialog,
  type UploadPendingLeavePhase,
  type UploadPendingLeaveReason,
} from '../components/Team/UploadPendingLeaveDialog';
import { useUploadPendingBlobUpload } from '../crud/useUploadPendingBlobUpload';
import { AlertSeverity, useSnackBar } from '../hoc/SnackBar';
import { mediaTabSelector } from '../selector';
import { drainUploadPending } from '../store/upload/drainUploadPending';
import { needsUploadPendingLeaveGate } from '../store/upload/uploadPendingLeaveGate';
import {
  discardUploadPendingForProject,
  listUploadPendingEntries,
} from '../store/upload/uploadPendingBlobs';
import { infoMsg } from '../utils/infoMsg';
import { LocalKey, localUserKey } from '../utils/localUserKey';
import { logError, Severity } from '../utils/logErrorService';
import { useGlobal } from './useGlobal';

export interface GuardLeaveArgs {
  /** The project being opened; omit when logging out. */
  enteringProjectId?: string;
  reason: Exclude<UploadPendingLeaveReason, 'afterSwitch'>;
  /** Runs once the user has uploaded, discarded, or had nothing pending. */
  proceed: () => void;
}

type LeaveRequest = {
  leavingProjectId: string;
  reason: UploadPendingLeaveReason;
  proceed: () => void;
};

type GateState =
  | { phase: 'closed' }
  | {
      phase: UploadPendingLeavePhase;
      request: LeaveRequest;
      busy: boolean;
      uploadFailed: boolean;
    };

const CLOSED: GateState = { phase: 'closed' };

const openGate = (request: LeaveRequest): GateState => ({
  phase: 'prompt',
  request,
  busy: false,
  uploadFailed: false,
});

/** Without a provider (tests, desktop shells) leaving is never gated. */
const UploadPendingLeaveContext = createContext<(args: GuardLeaveArgs) => void>(
  (args) => args.proceed()
);

/** Runs `proceed` now, or after the web Upload Pending leave gate settles. */
export const useUploadPendingLeave = () =>
  useContext(UploadPendingLeaveContext);

const lastProjectKey = () => localUserKey(LocalKey.uploadPendingProject);

/**
 * Web: one Upload Pending leave gate for the whole app (ADR 0017). Before
 * switching projects or logging out it prompts to upload the leaving
 * project's Upload Pending, then warns and discards on confirm. It is mounted
 * above the routes so it outlives them, and it remembers the last opened
 * project per user, because Team home clears `project` before the next
 * project card is clicked. When a project opens without passing the gate (a
 * deep link or a reload into another project) it prompts about the previous
 * project instead. Desktop is a no-op.
 */
export function UploadPendingLeaveProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const t = useSelector(mediaTabSelector, shallowEqual);
  const { showMessage } = useSnackBar();
  const [reporter] = useGlobal('errorReporter');
  const [project] = useGlobal('project');
  const [connected] = useGlobal('connected');
  const [offline] = useGlobal('offline');
  const uploadOne = useUploadPendingBlobUpload();
  const [gate, setGate] = useState<GateState>(CLOSED);

  const logGateError = useCallback(
    (err: unknown, what: string) =>
      logError(Severity.error, reporter, infoMsg(err as Error, what)),
    [reporter]
  );

  /** Never rejects: a failed read counts as nothing pending, so the user can go. */
  const countPending = useCallback(
    async (projectId: string): Promise<number> => {
      if (!projectId) return 0;
      try {
        return (await listUploadPendingEntries(projectId)).length;
      } catch (err: unknown) {
        // Nothing is discarded; the blobs upload when the project is opened again.
        logGateError(err, 'Upload Pending leave gate read failed');
        return 0;
      }
    },
    [logGateError]
  );

  // Remember the open project, and catch projects opened around the gate.
  useEffect(() => {
    if (isElectron || !project) return;
    const previous = localStorage.getItem(lastProjectKey()) ?? '';
    localStorage.setItem(lastProjectKey(), project);
    if (!previous || previous === project) return;
    countPending(previous)
      .then((pendingCount) => {
        if (pendingCount === 0) return;
        setGate((current) =>
          current.phase === 'closed'
            ? openGate({
                leavingProjectId: previous,
                reason: 'afterSwitch',
                // Already in the new project; closing the dialog is all.
                proceed: () => undefined,
              })
            : current
        );
      })
      .catch((err: unknown) =>
        logGateError(err, 'Upload Pending after-switch check failed')
      );
  }, [project, countPending, logGateError]);

  const guardLeave = useCallback(
    (args: GuardLeaveArgs) => {
      if (isElectron) {
        args.proceed();
        return;
      }
      const leavingProjectId =
        project || localStorage.getItem(lastProjectKey()) || '';
      countPending(leavingProjectId)
        .then((pendingCount) => {
          if (
            !needsUploadPendingLeaveGate({
              leavingProjectId,
              enteringProjectId: args.enteringProjectId,
              pendingCount,
            })
          ) {
            args.proceed();
            return;
          }
          setGate(
            openGate({
              leavingProjectId,
              reason: args.reason,
              proceed: args.proceed,
            })
          );
        })
        .catch((err: unknown) =>
          logGateError(err, 'Upload Pending leave gate failed')
        );
    },
    [project, countPending, logGateError]
  );

  /** Settles the request: closes the dialog, then lets the user leave. */
  const finish = (request: LeaveRequest) => {
    setGate(CLOSED);
    request.proceed();
  };

  const showUploadFailed = () =>
    setGate((current) =>
      current.phase === 'prompt'
        ? { ...current, busy: false, uploadFailed: true }
        : current
    );

  const handleUploadAll = () => {
    if (gate.phase !== 'prompt' || gate.busy) return;
    const { request } = gate;
    setGate({ ...gate, busy: true, uploadFailed: false });
    const leaving = request.leavingProjectId;
    listUploadPendingEntries(leaving)
      .then((entries) => drainUploadPending(entries, (e) => uploadOne(e)))
      .then(() => countPending(leaving))
      .then((left) => (left === 0 ? finish(request) : showUploadFailed()))
      .catch((err: unknown) => {
        logGateError(err, 'Upload Pending leave drain failed');
        showUploadFailed();
      });
  };

  const handleContinueWithoutUpload = () => {
    if (gate.phase !== 'prompt' || gate.busy) return;
    setGate({ ...gate, phase: 'warn' });
  };

  const handleConfirmDiscard = () => {
    if (gate.phase !== 'warn' || gate.busy) return;
    const { request } = gate;
    setGate({ ...gate, busy: true });
    discardUploadPendingForProject(request.leavingProjectId)
      .then(() => finish(request))
      .catch((err: unknown) => {
        logGateError(err, 'Upload Pending discard failed');
        showMessage(t.pendingUploadDiscardFailed, AlertSeverity.Error);
        setGate((current) =>
          current.phase === 'warn' ? { ...current, busy: false } : current
        );
      });
  };

  const handleCancel = () => setGate(CLOSED);

  return (
    <UploadPendingLeaveContext.Provider value={guardLeave}>
      {children}
      {gate.phase !== 'closed' && (
        <UploadPendingLeaveDialog
          phase={gate.phase}
          reason={gate.request.reason}
          busy={gate.busy}
          canUpload={connected && !offline}
          uploadFailed={gate.uploadFailed}
          onUploadAll={handleUploadAll}
          onContinueWithoutUpload={handleContinueWithoutUpload}
          onConfirmDiscard={handleConfirmDiscard}
          onCancel={handleCancel}
        />
      )}
    </UploadPendingLeaveContext.Provider>
  );
}

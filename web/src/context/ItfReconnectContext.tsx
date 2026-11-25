import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type IndexedDBSource from '@orbit/indexeddb';
import type JSONAPISource from '@orbit/jsonapi';
import type Memory from '@orbit/memory';
import { isElectron } from '../../api-variable';
import { ItfReconnectLeaveDialog } from '../components/ItfReconnect/ItfReconnectLeaveDialog';
import { ItfReconnectStatus } from '../components/ItfReconnect/ItfReconnectStatus';
import { orbitReset } from '../crud/orbitReset';
import { useOfflnProjRead } from '../crud/useOfflnProjRead';
import { exportItfSync } from '../store/importexport/itfSyncExport';
import { uploadItfSync } from '../store/importexport/uploadItfSync';
import { infoMsg } from '../utils/infoMsg';
import {
  canCancelItf,
  cancelItfReconnect,
  dismissItfReconnect,
  getItfReconnectStatus,
  isItfRunning,
  runItfReconnect,
  setItfReconnectRunner,
  subscribeItfReconnect,
  whenItfReconnectSettled,
  type ItfReconnectRunner,
} from '../utils/itfReconnect';
import { logError, Severity } from '../utils/logErrorService';
import { useDataChanges } from '../utils/useDataChanges';
import { TokenContext } from './TokenProvider';
import {
  ItfReconnectLeaveContext,
  type GuardItfLeave,
} from './itfReconnectLeave';
import { useGetGlobal, useGlobal } from './useGlobal';

/**
 * TT-7911: owns the ITF sent when a running desktop session gets its
 * connection back (started by useCheckOnline). Registers the export/upload
 * the run needs, shows its progress with a cancel, and holds a project switch
 * or logout until it finishes, like the Upload Pending leave gate.
 * Web registers nothing yet (TT-7912), so reconnect keeps replaying the queue.
 */
export function ItfReconnectProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [coordinator] = useGlobal('coordinator');
  const [errorReporter] = useGlobal('errorReporter');
  const [, setBusy] = useGlobal('importexportBusy');
  const [, setOrbitRetries] = useGlobal('orbitRetries');
  const getGlobal = useGetGlobal();
  const token = useContext(TokenContext)?.state?.accessToken ?? null;
  const getOfflineProject = useOfflnProjRead();
  const forceDataChanges = useDataChanges();
  const status = useSyncExternalStore(
    subscribeItfReconnect,
    getItfReconnectStatus
  );
  const [leaveWaiting, setLeaveWaiting] = useState(false);
  /** The leave waiting for the ITF; cleared when the user stays. */
  const pendingLeave = useRef<(() => void) | undefined>(undefined);

  // The runner is registered once; its methods read the latest token and
  // hooks. useGlobal setters, useGetGlobal, useDataChanges and
  // useOfflnProjRead return new functions on every render, so depending on
  // them would re-register the runner on every render.
  const current = {
    coordinator,
    errorReporter,
    token,
    getOfflineProject,
    forceDataChanges,
    getGlobal,
    setBusy,
    setOrbitRetries,
  };
  const latest = useRef(current);
  useEffect(() => {
    latest.current = current;
  });

  useEffect(() => {
    if (!isElectron) return;
    const runner: ItfReconnectRunner = {
      // The startup sync (ImportTab) and other imports set importexportBusy.
      canStart: () => {
        const { getGlobal } = latest.current;
        return (
          Boolean(getGlobal('loadComplete')) && !getGlobal('importexportBusy')
        );
      },
      getRemote: () => {
        const { coordinator } = latest.current;
        return coordinator?.sourceNames.includes('remote')
          ? (coordinator.getSource('remote') as JSONAPISource)
          : undefined;
      },
      exportItf: () => {
        const { coordinator, getOfflineProject, errorReporter } =
          latest.current;
        return exportItfSync({
          memory: coordinator.getSource('memory') as Memory,
          backup: coordinator.getSource('backup') as IndexedDBSource,
          getOfflineProject,
          errorReporter,
        });
      },
      uploadItf: (file, { signal, onApplying }) => {
        const { token, errorReporter } = latest.current;
        return uploadItfSync({
          file,
          token,
          errorReporter,
          signal,
          onApplying,
        });
      },
      replay: async (remote) => {
        if (remote) await orbitReset(remote, latest.current.setOrbitRetries);
      },
      afterSent: () => latest.current.forceDataChanges(),
      setBusy: (busy) => latest.current.setBusy(busy),
      reportError: (err: unknown) =>
        logError(
          Severity.error,
          latest.current.errorReporter,
          infoMsg(
            err instanceof Error ? err : new Error(String(err)),
            'ITF on reconnect failed: '
          )
        ),
    };
    setItfReconnectRunner(runner);
    return () => setItfReconnectRunner(undefined);
  }, []);

  const guardLeave = useCallback<GuardItfLeave>((proceed) => {
    if (!isItfRunning(getItfReconnectStatus())) {
      proceed();
      return;
    }
    pendingLeave.current = proceed;
    setLeaveWaiting(true);
    // Never rejects: a failed or cancelled ITF still lets the user go, and
    // needItfSync stays set so it is sent later.
    void whenItfReconnectSettled().then(() => {
      const leave = pendingLeave.current;
      pendingLeave.current = undefined;
      setLeaveWaiting(false);
      leave?.();
    });
  }, []);

  const handleStay = () => {
    pendingLeave.current = undefined;
    setLeaveWaiting(false);
  };

  const handleRetry = () => {
    // runItfReconnect reports its own failures and never rejects.
    void runItfReconnect();
  };

  return (
    <ItfReconnectLeaveContext.Provider value={guardLeave}>
      {children}
      {status !== 'idle' && (
        <ItfReconnectStatus
          status={status}
          onCancel={cancelItfReconnect}
          onRetry={handleRetry}
          onClose={dismissItfReconnect}
        />
      )}
      {leaveWaiting && (
        <ItfReconnectLeaveDialog
          canStop={canCancelItf(status)}
          onStay={handleStay}
          onStopAndLeave={cancelItfReconnect}
        />
      )}
    </ItfReconnectLeaveContext.Provider>
  );
}

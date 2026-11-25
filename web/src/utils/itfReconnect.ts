import type JSONAPISource from '@orbit/jsonapi';
import { isElectron } from '../../api-variable';
import type { ItfSyncFile } from '../store/importexport/itfSyncExport';
import { clearNeedItfSync, needItfSync, shouldRunItfSync } from './needItfSync';
import {
  dropQueuedEditsCarriedByItf,
  holdRemoteQueue,
  releaseRemoteQueueOnReconnect,
} from './itfQueue';

/**
 * TT-7911: an ITF built and sent when a running session gets its connection
 * back, instead of replaying the queued offline edits it carries.
 *
 * One run at a time for the whole app: several useCheckOnline instances can
 * see the same reconnect. The React side (ItfReconnectProvider) registers a
 * runner with the export/upload it needs and renders the status; useCheckOnline
 * starts a run. Desktop registers a runner today; the web ITF (TT-7912) can
 * register its own and widen shouldRunItfSync.
 */
export type ItfReconnectStatus =
  | 'idle'
  | 'exporting'
  | 'uploading'
  | 'applying'
  | 'sent'
  | 'cancelled'
  | 'failed';

export interface ItfReconnectRunner {
  /** False while something else owns import/export (e.g. the startup sync). */
  canStart: () => boolean;
  getRemote: () => JSONAPISource | undefined;
  exportItf: () => Promise<ItfSyncFile | undefined>;
  uploadItf: (
    file: ItfSyncFile,
    opts: { signal: AbortSignal; onApplying: () => void }
  ) => Promise<void>;
  /** Sends what is left in the queue (orbitReset). */
  replay: (remote: JSONAPISource | undefined) => Promise<void>;
  /** Pulls the server's view of the import (data changes). */
  afterSent: () => Promise<void>;
  /** Pauses data-change polling while the ITF runs. */
  setBusy: (busy: boolean) => void;
  reportError: (err: unknown) => void;
}

/** The ITF is still running, so leaving a project waits for it. */
export const isItfRunning = (status: ItfReconnectStatus) =>
  status === 'exporting' || status === 'uploading' || status === 'applying';

/** Once the server is applying the ITF, stopping would leave it half done. */
export const canCancelItf = (status: ItfReconnectStatus) =>
  status === 'exporting' || status === 'uploading';

let runner: ItfReconnectRunner | undefined;
let status: ItfReconnectStatus = 'idle';
let running: Promise<void> | undefined;
let abort: AbortController | undefined;
const listeners = new Set<() => void>();

const setStatus = (next: ItfReconnectStatus) => {
  if (status === next) return;
  status = next;
  listeners.forEach((l) => l());
};

export const getItfReconnectStatus = () => status;

/** For useSyncExternalStore. */
export const subscribeItfReconnect = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setItfReconnectRunner = (next: ItfReconnectRunner | undefined) => {
  runner = next;
};

/** Resolves when no ITF is running; never rejects. */
export const whenItfReconnectSettled = () => running ?? Promise.resolve();

class ItfCancelled extends Error {
  constructor() {
    super('ITF sync cancelled');
    this.name = 'AbortError';
  }
}

/** Rejects as soon as the signal aborts, even if `work` keeps going. */
const unlessCancelled = <T>(work: Promise<T>, signal: AbortSignal) =>
  new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new ItfCancelled());
    if (signal.aborted) onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort);
    });
  });

/** Follow-up work once the ITF outcome is final: a failure here is reported
 *  but does not change that outcome. */
const settleAfter = async (
  current: ItfReconnectRunner,
  work: () => Promise<void>
) => {
  try {
    await work();
  } catch (err: unknown) {
    current.reportError(err);
  }
};

const runOnce = async (current: ItfReconnectRunner) => {
  const remote = current.getRemote();
  // Hold first, before any await, so no replay can start ahead of the export.
  const release = holdRemoteQueue(remote);
  const controller = new AbortController();
  abort = controller;
  current.setBusy(true);
  try {
    setStatus('exporting');
    const file = await unlessCancelled(current.exportItf(), controller.signal);
    if (!file) {
      // exportItf cleared the flag: nothing changed offline, so replay as
      // before (the queue holds only edits the ITF would not carry).
      release();
      setStatus('idle');
      await settleAfter(current, () => current.replay(remote));
      return;
    }
    setStatus('uploading');
    await unlessCancelled(
      current.uploadItf(file, {
        signal: controller.signal,
        onApplying: () => {
          // From here a cancel is ignored (see canCancelItf).
          if (!controller.signal.aborted) setStatus('applying');
        },
      }),
      controller.signal
    );
    // Confirmed sent: drop what it carried, keep and replay the rest.
    await dropQueuedEditsCarriedByItf(remote, file.records);
    clearNeedItfSync();
    release();
    setStatus('sent');
    await settleAfter(current, async () => {
      await current.replay(remote);
      await current.afterSent();
    });
  } catch (err: unknown) {
    // Cancelled or failed: needItfSync stays set so the next reconnect or
    // start tries the ITF again, but the queue is released and replayed now
    // rather than left parked, so later edits are not stuck behind it. An
    // edit replayed here may also be in that next ITF (accepted trade-off).
    if (controller.signal.aborted) {
      setStatus('cancelled');
    } else {
      current.reportError(err);
      setStatus('failed');
    }
    release();
    await settleAfter(current, () => current.replay(remote));
  } finally {
    release();
    current.setBusy(false);
    abort = undefined;
  }
};

/** Starts an ITF now (also the Retry button); joins one already running. */
export const runItfReconnect = (): Promise<void> => {
  if (running !== undefined) return running;
  const current = runner;
  if (!current) return Promise.resolve();
  running = runOnce(current).finally(() => {
    running = undefined;
  });
  return running;
};

const startIfDue = (offline: boolean) => {
  if (running !== undefined) return true;
  if (
    !runner ||
    !shouldRunItfSync({ isElectron, offline, needItf: needItfSync() })
  )
    return false;
  if (!runner.canStart()) return false;
  // runOnce reports its own failures; the promise never rejects.
  void runItfReconnect();
  return true;
};

/**
 * Called on useCheckOnline's offline→online edge. True when an ITF is
 * running or was started, in which case the caller must not replay the queue.
 * Always ends the hold taken at the disconnect: a run started here took its
 * own hold synchronously (before its first await) and releases it when it
 * settles; otherwise the caller replays the queue as before.
 */
export const startItfOnReconnect = ({ offline }: { offline: boolean }) => {
  const started = startIfDue(offline);
  releaseRemoteQueueOnReconnect();
  return started;
};

/** Stops the ITF if the server has not started applying it. */
export const cancelItfReconnect = () => {
  if (canCancelItf(status)) abort?.abort();
};

/** Hides a finished run's result. */
export const dismissItfReconnect = () => {
  if (!isItfRunning(status)) setStatus('idle');
};

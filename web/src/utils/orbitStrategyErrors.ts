import type Coordinator from '@orbit/coordinator';
import type JSONAPISource from '@orbit/jsonapi';
import type Memory from '@orbit/memory';
import type { RecordOperation, RecordTransform } from '@orbit/records';
import type { IApiError, IMainStrings } from '../model';
import type { ITokenContext } from '../context/TokenProvider';
import type { AlertSeverity } from '../hoc/SnackBar';
import type Bugsnag from '@bugsnag/js';
import { OrbitNetworkErrorRetries } from '../../api-variable';
import { orbitErr, orbitRetry } from './infoMsg';
import { handleUnauthorized } from './handleUnauthorized';
import { isUnauthorized, isFetchNetworkError } from './httpError';
import { getRemoteQueueHoldGeneration, isRemoteQueueHeld } from './itfQueue';

export interface PullStratErrProps {
  tokenCtx: ITokenContext;
  orbitError: (ex: IApiError) => void;
  setOrbitRetries: (r: number) => void;
  showMessage: (msg: string | React.JSX.Element, alert?: AlertSeverity) => void;
  memory: Memory;
  coordinator: Coordinator;
  fingerprint: string;
  errorReporter: typeof Bugsnag | undefined;
  /**
   * Read at call time, never snapshotted, so the message still follows the
   * language the user switched to after login (see docs/ai/localization.md).
   */
  getStrings?: () => IMainStrings;
}

/** Used when the caller has no localized strings to offer (tests, early boot). */
const fallbackStrings = {
  networkRetrySoon: 'Network problem - will try again soon.',
  updateFailedNetwork:
    'Could not reach the server to save your last change. It was undone - ' +
    'please check your connection and try again.',
};

/** Back off rather than hammering a server that is already refusing us. */
const retryDelayMs = (attempt: number) =>
  Math.min(3000 * 2 ** (attempt - 1), 30000);

/** Keep the per-transform bookkeeping from growing without bound. */
const MAX_TRACKED_TRANSFORMS = 100;

interface TransformAttempts {
  count: number;
  gaveUp: boolean;
  /** The "waiting to send" message was shown for this offline hold. */
  heldNotified: boolean;
}

/**
 * The browser says it has no network (also true under DevTools "Offline").
 * A captive portal or dead Wi-Fi can still report online; those fall through
 * to the bounded retry below.
 */
const isBrowserOffline = () =>
  typeof navigator !== 'undefined' && navigator.onLine === false;

export interface QueryStratErrProps {
  tokenCtx: ITokenContext;
  orbitError: (ex: IApiError) => void;
  coordinator: Coordinator;
  fingerprint: string;
  setOrbitRetries: (r: number) => void;
}

export const queryError =
  ({
    tokenCtx,
    orbitError,
    coordinator,
    fingerprint,
    setOrbitRetries,
  }: QueryStratErrProps) =>
  (transform: RecordTransform, ex: unknown) => {
    const remote = coordinator?.getSource('remote') as JSONAPISource;
    console.log('***** api query fail', transform, ex);
    if (isUnauthorized(ex)) {
      return handleUnauthorized(
        tokenCtx,
        coordinator,
        fingerprint,
        setOrbitRetries
      );
    } else if (isFetchNetworkError(ex)) {
      orbitError(ex as IApiError);
      //signal to datachanges that we've had a network error
      setOrbitRetries(OrbitNetworkErrorRetries - 1);
    }
    // TT-7911: retry() resends the head of the shared queue, which may be an
    // offline edit a reconnect ITF will send; whoever holds it replays it.
    if (isRemoteQueueHeld()) return;
    return remote.requestQueue.retry();
  };

export const datachangesQueryError =
  ({
    tokenCtx,
    coordinator,
    fingerprint,
    setOrbitRetries,
  }: QueryStratErrProps) =>
  (transform: RecordTransform, ex: unknown) => {
    const datachangeremote = coordinator?.getSource(
      'datachanges'
    ) as JSONAPISource;
    console.log('***** datachanges query fail', transform, ex);
    if (isUnauthorized(ex)) {
      return handleUnauthorized(
        tokenCtx,
        coordinator,
        fingerprint,
        setOrbitRetries,
        'datachanges'
      );
    } else if (isFetchNetworkError(ex)) {
      //signal to datachanges that we've had a network error
      setOrbitRetries(OrbitNetworkErrorRetries - 1);
    }
    return datachangeremote.requestQueue.skip();
  };

export const updateError = ({
  tokenCtx,
  orbitError,
  setOrbitRetries,
  showMessage,
  memory,
  coordinator,
  fingerprint,
  getStrings,
}: PullStratErrProps) => {
  // Attempts are counted PER TRANSFORM, in a map that lives as long as the
  // strategy. The old code tested a captured `orbitRetries` number that
  // setOrbitRetries never wrote back to, so the guard was permanently true and
  // a transform the server would never accept was retried every 3s forever
  // (TT-6952).
  const attempts = new Map<string, TransformAttempts>();
  const trackAttempts = (id: string): TransformAttempts => {
    const found = attempts.get(id);
    if (found) return found;
    if (attempts.size >= MAX_TRACKED_TRANSFORMS) {
      const oldest = attempts.keys().next();
      if (!oldest.done) attempts.delete(oldest.value);
    }
    const fresh = { count: 0, gaveUp: false, heldNotified: false };
    attempts.set(id, fresh);
    return fresh;
  };
  const strings = () => getStrings?.() ?? fallbackStrings;

  /**
   * Offline, or the queue held for a reconnect ITF (TT-7911): leave the task
   * failed at the head of the queue, so it and every later edit wait in
   * order, and keep the change in memory. Waiting is not failing, so the
   * attempt never counts toward giving up. Each edit pushed meanwhile
   * re-attempts the head and lands here again. useCheckOnline's
   * offline→online edge (or the ITF's release) replays the queue in order.
   * No timer here: a second retry() would reset an in-flight request and
   * could send it twice. Afterwards the retry budget starts fresh.
   */
  const waitForReconnect = (attempt: TransformAttempts): boolean => {
    if (!isBrowserOffline() && !isRemoteQueueHeld()) return false;
    attempt.count = 0;
    setOrbitRetries(OrbitNetworkErrorRetries - 1);
    if (!attempt.heldNotified) {
      attempt.heldNotified = true;
      orbitError(orbitRetry(null, strings().networkRetrySoon));
    }
    return true;
  };

  return (transform: RecordTransform, ex: unknown) => {
    const remote = coordinator?.getSource('remote') as JSONAPISource;
    console.log('***** api update fail', transform, ex);
    if (isUnauthorized(ex)) {
      return handleUnauthorized(
        tokenCtx,
        coordinator,
        fingerprint,
        setOrbitRetries
      );
    } else if (isFetchNetworkError(ex)) {
      const attempt = trackAttempts(transform.id);
      // Already skipped: the task is gone from the queue, nothing to retry.
      if (attempt.gaveUp || waitForReconnect(attempt)) return;
      attempt.count += 1;
      if (attempt.count <= OrbitNetworkErrorRetries) {
        //signal to datachanges that we've had a network error
        setOrbitRetries(Math.max(0, OrbitNetworkErrorRetries - attempt.count));
        // Every attempt is the same problem -- say so once, not every 3s.
        if (attempt.count === 1)
          orbitError(orbitRetry(null, strings().networkRetrySoon));
        const generation = getRemoteQueueHoldGeneration();
        setTimeout(() => {
          // TT-7911: a hold that began meanwhile (disconnect or reconnect
          // ITF) owns the queue, and its release replays it. This attempt
          // was cut short by the hold, so it does not count.
          if (
            isRemoteQueueHeld() ||
            generation !== getRemoteQueueHoldGeneration()
          ) {
            attempt.count = 0;
            return;
          }
          remote.requestQueue.retry();
        }, retryDelayMs(attempt.count));
        return;
      }
      // Out of retries. JSONAPISource shares ONE requestQueue between queries
      // and updates, so a failed task left at the head is re-attempted ahead of
      // every later request -- including the remote.query LoadProjectData runs
      // when the user opens another project, which is how a failed team/project
      // delete used to break navigation. Drop it, put memory back where it was,
      // and tell the user once.
      attempt.gaveUp = true;
      orbitError(
        orbitErr(ex as IApiError | Error | null, strings().updateFailedNetwork)
      );
      if (memory.transformLog.contains(transform.id)) {
        memory.rollback(transform.id, -1);
      }
      return remote.requestQueue.skip(ex as Error);
    } else {
      // When non-network errors occur, notify the user and
      // reset state.
      const data = (
        ex as { data: { errors: Array<{ meta: { stackTrace: string[] } }> } }
      ).data;
      const detail =
        data?.errors && Array.isArray(data.errors) && data.errors.length > 0
          ? data.errors[0]?.meta && data.errors[0]?.meta?.stackTrace?.[0]
          : undefined;

      if (detail?.includes('Entity has been deleted')) {
        console.log('***attempt to update deleted record');
        showMessage(detail);
      } else {
        const response = (ex as { response: { url: string } }).response;
        const url: string = response?.url ?? '';
        const myOp = transform.operations;
        const firstOp = Array.isArray(myOp)
          ? (myOp[0] as RecordOperation)
          : myOp;
        const label =
          (transform?.options?.label ||
            firstOp.op + (url ? ` in ` + url.split('/').pop() + `: ` : '')) +
          (detail ?? '');
        orbitError(
          orbitErr(
            ex as IApiError | Error | null,
            `Unable to complete "${label}"`
          )
        );
      }

      // Roll back memory to position before transform
      if (memory.transformLog.contains(transform.id)) {
        //don't do this -- resets error to 0 and takes user away from continue/logout screen
        //orbitError(
        //  orbitInfo(null, 'Rolling back - transform:' + transform.id)
        //);
        memory.rollback(transform.id, -1);
      }

      return remote.requestQueue.skip();
    }
  };
};

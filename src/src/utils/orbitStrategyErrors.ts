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
}

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
    const fresh = { count: 0, gaveUp: false };
    attempts.set(id, fresh);
    return fresh;
  };
  const strings = () => getStrings?.() ?? fallbackStrings;

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
      if (attempt.gaveUp) return;
      attempt.count += 1;
      if (attempt.count <= OrbitNetworkErrorRetries) {
        //signal to datachanges that we've had a network error
        setOrbitRetries(Math.max(0, OrbitNetworkErrorRetries - attempt.count));
        // Every attempt is the same problem -- say so once, not every 3s.
        if (attempt.count === 1)
          orbitError(orbitRetry(null, strings().networkRetrySoon));
        setTimeout(() => {
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

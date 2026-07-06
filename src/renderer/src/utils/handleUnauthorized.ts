import Coordinator from '@orbit/coordinator';
import JSONAPISource from '@orbit/jsonapi';
import { ITokenContext } from '../context/TokenProvider';
import { OrbitNetworkErrorRetries } from '../../api-variable';
import { LocalKey } from './localUserKey';
import { syncRemoteAuthHeaders } from './syncRemoteAuthHeaders';

let unauthorizedRetryAttempted = false;

export const skipRemoteQueue = async (remote: JSONAPISource | undefined) => {
  if (!remote?.requestQueue?.length) return;
  try {
    await remote.requestQueue.skip();
  } catch {
    // queue may already be settling
  }
};

export const skipAllRemoteQueues = async (
  coordinator: Coordinator | undefined
): Promise<void> => {
  if (!coordinator) return;
  const remote = coordinator.getSource('remote') as JSONAPISource;
  const datachanges = coordinator.getSource('datachanges') as JSONAPISource;
  await skipRemoteQueue(remote);
  await skipRemoteQueue(datachanges);
};

const LOGOUT_QUEUE_WAIT_MS = 10_000;

/** Best-effort drain before logout; always skips stuck queues so logout can proceed. */
export const drainQueuesForLogout = async (
  waitForRemote: (label: string) => Promise<void>,
  waitForDataChanges: (label: string) => Promise<void>,
  coordinator: Coordinator | undefined,
  label: string
): Promise<void> => {
  const drain = Promise.all([
    waitForRemote(label).catch(() => {}),
    waitForDataChanges(label).catch(() => {}),
  ]);
  const timeout = new Promise<void>((resolve) =>
    setTimeout(resolve, LOGOUT_QUEUE_WAIT_MS)
  );
  await Promise.race([drain, timeout]);
  await skipAllRemoteQueues(coordinator);
};

export const resetUnauthorizedRetry = () => {
  unauthorizedRetryAttempted = false;
};

// Shared 401 recovery: retry once with freshly re-synced auth headers (in
// case this was just a race against a not-yet-applied token), and if a 401
// happens again, tear the session down. Reused by the query/update failure
// strategies in Sources.tsx and by fetchOrbitData (store/orbit/actions.tsx)
// as a safety net for the same failure — see the comment at that call site
// for why it isn't a guaranteed no-op if the strategies already handled it.
export const handleUnauthorized = (
  tokenCtx: ITokenContext,
  coordinator: Coordinator,
  fingerprint: string,
  setOrbitRetries: (r: number) => void
) => {
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const datachangeremote = coordinator?.getSource(
    'datachanges'
  ) as JSONAPISource;
  const token = tokenCtx?.state?.accessToken;
  if (token && remote && !unauthorizedRetryAttempted) {
    unauthorizedRetryAttempted = true;
    syncRemoteAuthHeaders(remote, token, fingerprint);
    syncRemoteAuthHeaders(datachangeremote, token, fingerprint);
    return remote.requestQueue.retry();
  }
  unauthorizedRetryAttempted = false;
  setOrbitRetries(OrbitNetworkErrorRetries);
  tokenCtx?.state?.invalidateOnlineSession();
  localStorage.setItem(LocalKey.offlineAdmin, 'false');
  void skipRemoteQueue(remote);
  void skipRemoteQueue(datachangeremote);
  return remote.requestQueue.skip();
};

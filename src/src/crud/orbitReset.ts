import { OrbitNetworkErrorRetries } from '../../api-variable';
import JSONAPISource from '@orbit/jsonapi';
import logError, { Severity } from '../utils/logErrorService';
import bugsnagClient from '../auth/bugsnagClient';
export const orbitReset = async (
  remote: JSONAPISource,
  setOrbitRetries: (retries: number) => void
) => {
  setOrbitRetries(OrbitNetworkErrorRetries);
  try {
    const queue = remote?.requestQueue;
    // retry() throws on an empty queue (currentProcessor is undefined)
    if (queue && !queue.empty) await queue.retry();
  } catch (error) {
    // This used to be swallowed silently, which hid the root cause behind
    // whatever failed downstream (e.g. the "Go Offline" crash).
    logError(
      Severity.error,
      bugsnagClient,
      error instanceof Error ? error : new Error(String(error))
    );
  }
};

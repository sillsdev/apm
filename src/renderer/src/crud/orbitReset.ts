import { OrbitNetworkErrorRetries } from '../../api-variable';
import JSONAPISource from '@orbit/jsonapi';
export const orbitReset = async (
  remote: JSONAPISource,
  setOrbitRetries: (retries: number) => void
) => {
  setOrbitRetries(OrbitNetworkErrorRetries);
  try {
    if (remote?.requestQueue) await remote.requestQueue.retry();
  } catch {
    // console.error('orbitReset error', error);
    // do nothing
  }
};

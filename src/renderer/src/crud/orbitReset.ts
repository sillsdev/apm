import { OrbitNetworkErrorRetries } from '../../api-variable';
import JSONAPISource from '@orbit/jsonapi';
export const orbitReset = async (
  remote: JSONAPISource,
  setOrbitRetries: (retries: number) => void
) => {
  setOrbitRetries(OrbitNetworkErrorRetries);
  if (remote?.requestQueue?.retry) await remote.requestQueue.retry();
};

/* eslint-disable react-hooks/immutability */
import { useGlobal } from '../context/useGlobal';
import JSONAPISource from '@orbit/jsonapi';
import { syncRemoteAuthHeaders } from '../utils/syncRemoteAuthHeaders';

export const useUpdateOrbitToken = () => {
  const [coordinator] = useGlobal('coordinator');
  const [fingerprint] = useGlobal('fingerprint');

  return (myToken: string) => {
    const remote = coordinator?.getSource('remote') as JSONAPISource;
    const datachangeremote = coordinator?.getSource(
      'datachanges'
    ) as JSONAPISource;
    syncRemoteAuthHeaders(remote, myToken, fingerprint || '');
    syncRemoteAuthHeaders(datachangeremote, myToken, fingerprint || '');
  };
};

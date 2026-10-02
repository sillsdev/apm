import { useGetGlobal, useGlobal } from '../context/useGlobal';
import * as actions from '../store';
import Axios from 'axios';
import JSONAPISource from '@orbit/jsonapi';
import { API_CONFIG, OrbitNetworkErrorRetries } from '../../api-variable';
import { useDispatch } from 'react-redux';
import { LocalKey } from '../utils';
import Bugsnag from '@bugsnag/js';
import { orbitReset } from '../crud/orbitReset';

export function Online(doCheck: boolean, cb: (result: boolean) => void): void {
  const opts = {
    timeout: 10000,
  };

  //if we're electron, don't be using the internet even if it's available
  //until the user logs in or the override is true
  if (!doCheck) {
    cb(false);
  }

  Axios.get(API_CONFIG.host + '/api/AmIOnline/', opts)
    .then(() => {
      cb(true);
    })
    .catch((reason) => {
      cb(reason.response !== undefined);
    });
}
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-unused-vars
export const useCheckOnline = (label: string) => {
  const dispatch = useDispatch();
  const resetOrbitError = actions.resetOrbitError;
  const getGlobal = useGetGlobal();
  const [, setConnected] = useGlobal('connected');
  const [, setOrbitRetries] = useGlobal('orbitRetries');
  const [coordinator] = useGlobal('coordinator');
  const remote = coordinator?.getSource('remote') as JSONAPISource;

  const errorReset = async () => {
    dispatch(resetOrbitError());
    await orbitReset(remote, setOrbitRetries);
    // queue.retry() can re-dispatch ORBIT_RETRY via Sources updateError; clear
    // again so a later Record remount does not re-snack (TT-7720).
    dispatch(resetOrbitError());
  };

  const checkOnline = (
    cb: (result: boolean) => void,
    forceCheck: boolean = false
  ): void => {
    if (!forceCheck && getGlobal('offline')) {
      localStorage.setItem(LocalKey.connected, 'false');
    }
    const statusChange = (result: boolean) => {
      localStorage.setItem(
        LocalKey.connected,
        `${result && !getGlobal('offline')}`
      );
      if (API_CONFIG.snagId !== '') {
        if (result) {
          Bugsnag.resumeSession();
        } else {
          Bugsnag.pauseSession();
        }
      }
      setConnected(result);
    };
    //console.log('Checking online status for ' + label);
    Online(forceCheck || !getGlobal('offline'), (result) => {
      // TT-7720: clear stale orbit network-error snack when AmIOnline succeeds
      // even if `connected` is already true (Pending Retry / CloudOff paths).
      // Only run full orbitReset (queue.retry) on a false→true edge — retrying
      // the queue while already online re-fires non-network failures (e.g. 403
      // on passagestatechanges) and can surface a spurious API Error 500 page.
      if (result) {
        if (getGlobal('connected') !== result) {
          errorReset().finally(() => {
            statusChange(result);
          });
        } else {
          dispatch(resetOrbitError());
          setOrbitRetries(OrbitNetworkErrorRetries);
        }
      } else if (getGlobal('connected') !== result) {
        statusChange(result);
      }
      cb(result);
    });
  };
  return checkOnline;
};

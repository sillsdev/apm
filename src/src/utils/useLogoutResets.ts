import { useContext } from 'react';
import { useGlobal } from '../context/useGlobal';
import { isElectron } from '../../api-variable';
import { TokenContext } from '../context/TokenProvider';
import { LocalKey } from './localUserKey';
import { removeOrbitRemote } from './removeOrbitRemote';

export const useLogoutResets = (): (() => Promise<void>) => {
  const [, setUser] = useGlobal('user');
  const [, setIsOffline] = useGlobal('offline');
  const [coordinator] = useGlobal('coordinator');
  const ctx = useContext(TokenContext).state;

  return async (): Promise<void> => {
    if (ctx.accessToken || localStorage.getItem(LocalKey.loggedIn)) {
      localStorage.removeItem(LocalKey.loggedIn);
      await removeOrbitRemote(coordinator);
    }
    setUser('');
    if (isElectron) setIsOffline(isElectron);
  };
};

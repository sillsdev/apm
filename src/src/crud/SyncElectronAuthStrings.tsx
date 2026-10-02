import { useEffect } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { isElectron } from '../../api-variable';
import { electronAuthSelector } from '../selector';
import { MainAPI } from '@model/main-api';

const ipc = window?.api as MainAPI;

/** Push localized Electron auth-window strings to the main process (see auth-strings.ts). */
export function SyncElectronAuthStrings() {
  const t = useSelector(electronAuthSelector, shallowEqual);

  useEffect(() => {
    if (!isElectron) return;
    void ipc?.setAuthProcessStrings({
      abortLogin: t.abortLogin,
      back: t.back,
      exit: t.exit,
      loginFailed: t.loginFailed,
      tokenExchangeFailed: t.tokenExchangeFailed,
      tryAgain: t.tryAgain,
      workOffline: t.workOffline,
    });
  }, [t]);

  return null;
}

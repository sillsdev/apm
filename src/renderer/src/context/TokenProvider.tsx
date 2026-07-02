import React, { useRef } from 'react';
import { User, useAuth0, RedirectLoginOptions } from '@auth0/auth0-react';
import { IToken } from '../model';
import Busy from '../components/Busy';
import TokenDialog from '../components/TokenDialog';
import { DateTime } from 'luxon';
import { jwtDecode } from 'jwt-decode';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { useUpdateOrbitToken } from '../crud';
import {
  LocalKey,
  forceLogin,
  logError,
  Severity,
  useInterval,
} from '../utils';
import { removeOrbitRemote } from '../utils/removeOrbitRemote';
import { isElectron } from '../../api-variable';
import { useProjectDefaults } from '../crud/useProjectDefaults';
import { MainAPI } from '@model/main-api';
import envVariables from '../auth/auth0-variables.json';
const { apiIdentifier } = envVariables;
const ipc = window?.api as MainAPI;

const Expires = 0; // Set to 7110 to test 1:30 token

const initState = {
  accessToken: null as string | null,
  profile: undefined as User | undefined,
  expiresAt: 0 as number | null,
  email_verified: false as boolean | undefined,
  authSessionCleared: false as boolean,
  logout: () => {},
  invalidateOnlineSession: () => {},
  resetExpiresAt: () => {},
  authenticated: () => false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setAuthSession: (_profile: User | undefined, _accessToken: string) => {},
};

export type ICtxState = typeof initState;

export interface ITokenContext {
  state: ICtxState;
  setState: React.Dispatch<React.SetStateAction<ICtxState>>;
}

const TokenContext = React.createContext({
  state: initState as ICtxState,
  setState: () => {},
} as ITokenContext);

interface IProps {
  children: React.JSX.Element;
}

function TokenProvider(props: IProps) {
  const { children } = props;
  const {
    getAccessTokenSilently,
    loginWithRedirect,
    logout: auth0Logout,
    user,
    isLoading,
    isAuthenticated,
    error,
  } = useAuth0();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [secondsToExpire, setSecondsToExpire] = React.useState(0);
  const [errorReporter] = useGlobal('errorReporter');
  const [coordinator] = useGlobal('coordinator');
  const updateOrbitToken = useUpdateOrbitToken();
  const view = React.useRef<any>('');
  const { getLocalDefault } = useProjectDefaults();
  const options = {
    returnTo: getLocalDefault(LocalKey.deeplink),
  } as RedirectLoginOptions;
  const [state, setState] = React.useState({
    ...initState,
  });
  const expiresAtRef = useRef<number | null>(null);
  const skipAuthRestoreRef = useRef(false);
  const getGlobal = useGetGlobal();
  const webTokenOptions = {
    authorizationParams: { audience: apiIdentifier },
  };
  const setAuthSession = (profile: User | undefined, accessToken: string) => {
    skipAuthRestoreRef.current = false;
    if (accessToken) {
      const decodedToken = jwtDecode(accessToken) as IToken;
      expiresAtRef.current = decodedToken.exp;
    } else {
      expiresAtRef.current = null;
    }
    setState((state) => ({
      ...state,
      accessToken,
      profile,
      expiresAt: expiresAtRef.current,
      email_verified: profile?.email_verified,
      authSessionCleared: false,
    }));
    localStorage.setItem(LocalKey.loggedIn, 'true');
    updateOrbitToken(accessToken);
  };

  React.useEffect(() => {
    //this is only called on web
    if (!isAuthenticated) {
      skipAuthRestoreRef.current = false;
      return;
    }
    if (skipAuthRestoreRef.current) return;
    if (user) {
      getAccessTokenSilently(webTokenOptions)
        .then((token) => {
          setAuthSession(user, token);
        })
        .catch(() => {
          handleLogOut();
          loginWithRedirect(options);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  const logout = () => {
    skipAuthRestoreRef.current = true;
    expiresAtRef.current = null;
    localStorage.removeItem(LocalKey.loggedIn);
    setState((state) => ({
      ...state,
      accessToken: null,
      profile: undefined,
      expiresAt: -1,
      email_verified: false,
      authSessionCleared: true,
    }));
  };

  // The single place a rejected/expired session gets torn down. Every caller
  // used to also call forceLogin() itself (Sources.tsx, Loading.tsx) — folded
  // in here so there's one canonical "invalidate + force login" sequence.
  const invalidateOnlineSession = () => {
    void removeOrbitRemote(coordinator);
    logout();
    forceLogin();
    localStorage.removeItem(LocalKey.goingOnline);
    if (isElectron) {
      void ipc?.logout();
    } else {
      auth0Logout({ returnTo: window.location.origin } as RedirectLoginOptions);
    }
  };

  const authenticated = () => {
    if (!state.email_verified) return false;
    if (timeUntilExpire() < 0) return false;
    return true;
  };

  const resetExpiresAt = () => {
    if (getGlobal('offline')) return;
    if (isElectron) {
      ipc
        ?.refreshToken()
        .then(async () => {
          const myUser = await ipc?.getProfile();
          const myToken = (await ipc?.getToken()) as string;
          setAuthSession(myUser, myToken);
        })
        .catch((e: Error) => {
          localStorage.setItem(LocalKey.offlineAdmin, 'false');
          localStorage.removeItem(LocalKey.userId);
          handleLogOut();
          logError(Severity.error, errorReporter, e);
        });
    } else {
      getAccessTokenSilently(webTokenOptions)
        .then((token) => {
          setAuthSession(user, token);
        })
        .catch((e: any) => {
          if (e.error === 'login_required' && window?.location?.pathname) {
            localStorage.setItem(LocalKey.deeplink, window?.location?.pathname);
          }
          handleLogOut();
          logError(Severity.error, errorReporter, e);
          loginWithRedirect(options);
        });
    }
  };

  React.useEffect(() => {
    // Web token restore is handled by the auth0Effect above.
    if (!getGlobal('offline') && isElectron) {
      if (localStorage.getItem(LocalKey.loggedIn) === 'true') {
        resetExpiresAt();
      }
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const handleLogOut = () => {
    setState((state) => ({ ...state, expiresAt: -1 }));
    view.current = 'loggedOut';
    localStorage.removeItem(LocalKey.loggedIn);
    if (modalOpen) setModalOpen(false);
  };

  const timeUntilExpire = () => {
    if (!expiresAtRef.current) return -1;
    const currentUnix = DateTime.now().setLocale('en').toSeconds();
    const expires = DateTime.fromSeconds(expiresAtRef.current || 0)
      .setLocale('en')
      .toSeconds();
    const secondsLeft = expires - currentUnix;
    return secondsLeft;
  };

  const checkTokenExpired = () => {
    if (!getGlobal('offline')) {
      if ((expiresAtRef.current ?? 0) > 0) {
        const secondsLeft = timeUntilExpire();
        if (secondsLeft < Expires + 30) {
          setSecondsToExpire(secondsLeft);
          if (!modalOpen) {
            view.current = '';
            setModalOpen(true);
          } else {
            view.current = '';
          }
        } else {
          if (modalOpen) {
            view.current = '';
            setModalOpen(false);
          }
        }
      }
    }
  };

  useInterval(
    checkTokenExpired,
    (state?.expiresAt ?? 0) > 0 && !getGlobal('offline') ? 5000 : null
  );

  const handleClose = (value: number) => {
    setModalOpen(false);
    if (value < 0) {
      handleLogOut();
    } else {
      resetExpiresAt();
      setState((state) => ({
        ...state,
        expiresAt: state?.expiresAt ? state.expiresAt + 10 : 0,
      })); // allow time for refresh
      view.current = 'Continue';
    }
  };

  React.useEffect(() => {
    if (modalOpen && view.current === '' && secondsToExpire < Expires) {
      handleLogOut();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, secondsToExpire]);

  if (isLoading && !isElectron) {
    return <Busy />;
  }

  if (error && !isElectron) {
    console.log(error);
    if (errorReporter) logError(Severity.error, errorReporter, error);
    setTimeout(() => {
      loginWithRedirect(options);
    }, 1000);
    return <Busy />;
  }

  return (
    <TokenContext.Provider
      value={{
        state: {
          ...state,
          setAuthSession,
          logout,
          invalidateOnlineSession,
          authenticated,
          resetExpiresAt,
        },
        setState,
      }}
    >
      {children}
      <TokenDialog
        seconds={secondsToExpire}
        open={modalOpen && view.current === ''}
        onClose={handleClose}
      />
    </TokenContext.Provider>
  );
}

export { TokenContext, TokenProvider };

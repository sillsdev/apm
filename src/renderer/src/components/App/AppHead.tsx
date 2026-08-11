import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { AppBar, LinearProgress, Box, IconButton } from '@mui/material';
import JSONAPISource from '@orbit/jsonapi';
import { isElectron } from '../../../api-variable';
import { IState, IViewModeStrings } from '../../model';
import { TokenContext } from '../../context/TokenProvider';
import { UnsavedContext } from '../../context/UnsavedContext';
import { useGetGlobal, useGlobal } from '../../context/useGlobal';
import {
  resetData,
  exitElectronApp,
  forceLogin,
  localUserKey,
  LocalKey,
  useMounted,
  logError,
  Severity,
  relaunchApp,
  useMyNavigate,
  useHome,
  useWaitForRemoteQueue,
  useMobile,
  drainQueuesForLogout,
} from '../../utils';
import { useSnackBar } from '../../hoc/SnackBar';
import { withBucket } from '../../hoc/withBucket';
import { viewModeSelector } from '../../selector';
import { ApmLogo } from '../../control/ApmLogo';
import { spreadSx, rowSx, flexibleSx, rigidSx } from '../../control';
import HelpMenu from '../HelpMenu';
import PolicyDialog from '../PolicyDialog';
import ProjectDownloadAlert from '../ProjectDownloadAlert';
import UserMenu from '../UserMenu';
import DetailTitle from './DetailTitle';
import { HeadStatus } from './HeadStatus';
import { OrgHead } from './OrgHead';

type ResetRequests = () => Promise<void>;
export type DownloadAlertReason = 'cloud';

const isPreAuthPath = (path: string) =>
  path === '/' || path.startsWith('/access/');

export interface AppHeadProps {
  resetRequests?: ResetRequests;
  drawBottomBorder?: boolean;
  position?: 'fixed' | 'sticky' | 'relative';
  onDownloadAlert?: (open: boolean) => void;
}

export function AppHead({
  resetRequests,
  drawBottomBorder = true,
  position = 'fixed',
  onDownloadAlert,
}: AppHeadProps) {
  const { pathname } = useLocation();
  const navigate = useMyNavigate();

  const tv: IViewModeStrings = useSelector(viewModeSelector, shallowEqual);
  const orbitStatus = useSelector((state: IState) => state.orbit.status);
  const orbitErrorMsg = useSelector((state: IState) => state.orbit.message);

  const [coordinator] = useGlobal('coordinator');
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const [user] = useGlobal('user');
  const [errorReporter] = useGlobal('errorReporter');
  const [, setProject] = useGlobal('project');
  const [, setPlan] = useGlobal('plan'); //verified this is not used in a function 2/18/25
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [busy] = useGlobal('remoteBusy'); //verified this is not used in a function 2/18/25
  const [dataChangeCount] = useGlobal('dataChangeCount'); //verified this is not used in a function 2/18/25
  const [isChanged] = useGlobal('changed'); //verified this is only used in a useEffect
  const [complete] = useGlobal('progress'); //verified this is not used in a function 2/18/25
  const getGlobal = useGetGlobal();

  const tokenCtx = useContext(TokenContext);
  const tokenState = tokenCtx?.state ?? {
    expiresAt: null,
    authSessionCleared: false,
  };
  const ctx = useContext(UnsavedContext);
  const { checkSavedFn, startSave, toolsChanged, anySaving } = ctx.state;
  const { goHome } = useHome();

  const { isMobileWidth } = useMobile();
  const { showMessage } = useSnackBar();
  const isMounted = useMounted('apphead');
  const waitForRemoteQueue = useWaitForRemoteQueue();
  const waitForDataChangesQueue = useWaitForRemoteQueue('datachanges');

  const [view, setView] = useState('');
  const [doExit, setDoExit] = useState(false);
  const [exitAlert, setExitAlert] = useState(false);
  const [downloadAlert, setDownloadAlert] = useState(false);
  const [updateTipOpen, setUpdateTipOpen] = useState(false);
  const [showTerms, setShowTerms] = useState('');
  const downloadAlertReason = useRef<DownloadAlertReason | null>(null);
  const doingDone = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saving = useMemo(() => anySaving(), [toolsChanged]);

  const isDetail = useMemo(() => pathname.startsWith('/detail'), [pathname]);

  const progressVariant = useMemo(() => {
    if (complete !== 0 && complete !== 100) return 'determinate' as const;
    if (complete === 0 && (busy || saving || dataChangeCount))
      return 'indeterminate' as const;
    return undefined;
  }, [complete, busy, saving, dataChangeCount]);

  const planUrl = useMemo(() => {
    const fromUrl = localStorage.getItem(localUserKey(LocalKey.url));
    if (!fromUrl) return null;
    const m = /^\/(work|plan|detail)\/([0-9a-f-]+)\/?([0-9a-f-]*)/.exec(
      fromUrl
    );
    if (!m) return null;
    return `/plan/${m[2]}/0`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const downDone = (cancel?: boolean) => {
    if (doingDone.current) return;
    doingDone.current = true;
    setDownloadAlert(false);
    downloadAlertReason.current = null;
    if (cancel && !doExit) {
      const userId = localStorage.getItem(LocalKey.onlineUserId);
      if (userId) localStorage.setItem(LocalKey.userId, userId);
      return;
    }
    // This used to call exitApp(), which just quits with nothing to bring
    // the app back — the user is left staring at a closed app after
    // confirming "Go Offline". relaunchApp() quits and restarts, so it
    // reopens straight into the newly-offline session.
    if (localStorage.getItem(LocalKey.userId)) relaunchApp();
    else setView('Logout');
  };

  const handleUserMenuAction = (
    what: string,
    lastpath: string,
    setView: (v: string) => void,
    resetRequests: () => Promise<void>
  ) => {
    if (/terms|privacy/i.test(what)) {
      setShowTerms(what);
      return;
    }
    if (isElectron && /ClearLogout/i.test(what)) {
      resetData();
      exitElectronApp();
    }

    if (isElectron && /Logout/i.test(what)) {
      localStorage.removeItem(LocalKey.userId);
      checkSavedFn(() => {
        drainQueuesForLogout(
          waitForRemoteQueue,
          waitForDataChangesQueue,
          coordinator,
          'logout on electron'
        ).then(() => {
          if (getGlobal('offline')) downDone();
          else if (downloadAlertReason.current === 'cloud' && !isOffline)
            setDownloadAlert(true);
          else downDone();
        });
      });
      return;
    }
    if (!lastpath.endsWith('null')) {
      localStorage.setItem(localUserKey(LocalKey.url), lastpath);
    }
    if (!/Close/i.test(what)) {
      if (/ClearLogout/i.test(what)) {
        forceLogin();
        setView('Logout');
      } else if (/Clear/i.test(what)) {
        if (resetRequests) resetRequests().then(() => setView(what));
      } else if (/Logout/i.test(what)) {
        checkSavedFn(() => {
          drainQueuesForLogout(
            waitForRemoteQueue,
            waitForDataChangesQueue,
            coordinator,
            'logout on web'
          ).then(() => setView('Logout'));
        });
      } else checkSavedFn(() => setView(what));
    }
  };

  const handleMenu = (
    what: string,
    reason: DownloadAlertReason | null = null
  ) => {
    downloadAlertReason.current = reason;
    if (/\/team/i.test(pathname)) {
      setProject('');
      setPlan('');
    }
    handleUserMenuAction(
      what,
      pathname,
      setView,
      resetRequests as ResetRequests
    );
  };

  const handleUserMenu = (what: string) => {
    localStorage.removeItem('mode');
    localStorage.removeItem(LocalKey.plan);
    handleMenu(what);
  };

  // Clicking the APM logo leaves whatever project the user is in and returns
  // them to the team screen. Leaving a project is more than a navigation:
  //   1. checkSavedFn asks about unsaved edits first, and runs the rest only
  //      once the user has chosen to save or discard them.
  //   2. `mode` and `selected-plan` are where we remember what the user had
  //      open. They must be forgotten now, because TeamScreen treats a
  //      leftover `selected-plan` as "resume this plan" — so the next project
  //      card they click would send them back into the plan they just left.
  //   3. goHome() clears the project/plan/role globals and navigates to /team.
  const handleLogoHome = () =>
    checkSavedFn(() => {
      localStorage.removeItem('mode');
      localStorage.removeItem(LocalKey.plan);
      goHome();
    });

  const handleUnload = (e: any) => {
    if (isPreAuthPath(pathname)) return true;
    if (!exitAlert && isElectron && isMounted() && !doingDone.current) {
      setDoExit(true);
      setExitAlert(true);
    }
    const queueLength = remote?.requestQueue.length ?? 0;
    const busy = queueLength > 0 || getGlobal('remoteBusy');
    if ((getGlobal('changed') || busy) && !getGlobal('enableOffsite')) {
      e.preventDefault();
      e.returnValue = '';
      return true;
    }
    if (localStorage.getItem(localUserKey(LocalKey.url)) === '/team') {
      localStorage.setItem(localUserKey(LocalKey.url), '/');
    }
    return undefined;
  };

  const handleTermsClose = () => setShowTerms('');

  useEffect(() => {
    // expiresAt is legitimately -1 while genuinely offline (no online token
    // to expire) — this used to fire Logout unconditionally, which re-ran
    // the whole "Go Offline" teardown/relaunch flow every time AppHead
    // mounted offline, looping the app through logout -> relaunch forever.
    // Loading.tsx's equivalent check already guards with !offline; mirror it.
    if (
      !getGlobal('offline') &&
      tokenState.expiresAt === -1 &&
      !tokenState.authSessionCleared
    ) {
      handleMenu('Logout');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenState]);

  useEffect(() => {
    window.addEventListener('beforeunload', handleUnload);
    if (!user) {
      //are we here from a deeplink?
      if (!isPreAuthPath(pathname) && pathname !== '/loading') {
        setView('Access');
      }
    }
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => {
    if (exitAlert)
      if (!isChanged) {
        if (isMounted()) {
          if (downloadAlertReason.current === 'cloud' && !isOffline)
            setDownloadAlert(true);
          else downDone();
        }
      } else startSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitAlert, isChanged]);

  useEffect(() => {
    onDownloadAlert?.(downloadAlert);
    return () => onDownloadAlert?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadAlert]);

  useEffect(() => {
    logError(Severity.info, errorReporter, pathname);
    setUpdateTipOpen(pathname === '/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (orbitStatus) {
      showMessage(orbitErrorMsg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbitStatus, orbitErrorMsg]);

  if (view === 'Error') navigate('/error');
  if (view === 'Logout') setTimeout(() => navigate('/logout'), 500);
  if (view === 'Access') setTimeout(() => navigate('/'), 200);
  if (view === 'Terms') navigate('/terms');
  if (view === 'Privacy') navigate('/privacy');

  return (
    <AppBar
      position={position}
      color="inherit"
      sx={{
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        p: 1.5,
        backgroundColor: 'custom.headerBackground',
        ...(drawBottomBorder && {
          borderBottom: '1px solid',
          borderColor: 'divider',
        }),
      }}
    >
      {progressVariant && (
        <LinearProgress
          variant={progressVariant}
          value={complete}
          sx={{ position: 'absolute', top: 0, left: 0, right: 0 }}
        />
      )}
      <Box sx={spreadSx}>
        <Box sx={[rowSx, flexibleSx]}>
          {!isDetail ? (
            <IconButton
              aria-label={tv.home}
              onClick={handleLogoHome}
              sx={{ flexShrink: 0, p: 0 }}
            >
              <ApmLogo sx={{ width: '40px', height: '40px' }} />
            </IconButton>
          ) : (
            <IconButton
              onClick={() => navigate(planUrl || '/team')}
              sx={{ flexShrink: 0 }}
            >
              <ArrowBackIcon />
            </IconButton>
          )}
          {isDetail ? <DetailTitle /> : <OrgHead />}
        </Box>
        <Box sx={[rowSx, rigidSx]}>
          {!isMobileWidth && (
            <HeadStatus
              handleMenu={handleMenu}
              onUpdateTipOpen={setUpdateTipOpen}
            />
          )}
          <HelpMenu
            online={!isOffline}
            sx={updateTipOpen && isElectron ? { top: '40px' } : {}}
          />
          {!isPreAuthPath(pathname) && <UserMenu action={handleUserMenu} />}
        </Box>
      </Box>
      {downloadAlert && <ProjectDownloadAlert cb={downDone} />}
      <PolicyDialog
        isOpen={Boolean(showTerms)}
        content={showTerms}
        onClose={handleTermsClose}
      />
    </AppBar>
  );
}

const AppHeadWithBucket = withBucket(AppHead);
AppHeadWithBucket.displayName = 'AppHead';
export default AppHeadWithBucket;

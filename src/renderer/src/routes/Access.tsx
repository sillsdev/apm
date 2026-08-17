import React, { useState, useEffect, useContext, useRef } from 'react';
import { useGlobal, useGetGlobal } from '../context/useGlobal';
import { useLocation } from 'react-router-dom';
import { useAuth0, RedirectLoginOptions } from '@auth0/auth0-react';
import { shallowEqual, useSelector } from 'react-redux';
import {
  IState,
  IAccessStrings,
  UserD,
  GroupMembership,
  ProjectD,
  Plan,
  Section,
} from '../model';
import { TokenContext } from '../context/TokenProvider';
import * as action from '../store';
import {
  Typography,
  Button,
  Box,
  styled,
  TypographyProps,
  BoxProps,
} from '@mui/material';
import {
  useCheckOnline,
  waitForIt,
  useHome,
  useMyNavigate,
  LocalKey,
} from '../utils';
import { related, useOfflnProjRead, useOfflineSetup, ListEnum } from '../crud';
import { API_CONFIG, isElectron } from '../../api-variable';
import ImportTab from '../components/ImportTab';
import Confirm from '../components/AlertDialog';
import UserList from '../control/UserList';
import { useSnackBar } from '../hoc/SnackBar';
import AppLayout from '../components/App/AppLayout';
import { AltButton, PriButton, UserListItem } from '../control';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import UserListMode from '../control/userListMode';
import { ListMode } from '../control/ListMode';
import { accessSelector } from '../selector';
import { useOrbitData } from '../hoc/useOrbitData';
import { useDispatch } from 'react-redux';
import { goOnline, doLogout, switchUser } from './accessActions';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

const SectionHead = styled(Typography)<TypographyProps>(({ theme }) => ({
  fontSize: '14pt',
  paddingTop: theme.spacing(2),
}));

const ContainerBox = styled(Box)<BoxProps>(() => ({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
}));

const ActionBox = styled(Box)<BoxProps>(({ theme }) => ({
  paddingTop: theme.spacing(2),
}));

interface ICurrentUser {
  curUser: UserD;
  action?: () => void;
  goOnline: () => void;
  show?: ListEnum;
}

const CurrentUser = ({ curUser, action, goOnline, show }: ICurrentUser) => {
  const t: IAccessStrings = useSelector(accessSelector, shallowEqual);

  return (
    <>
      <SectionHead>{t.currentUser}</SectionHead>
      <Box sx={{ pt: 2 }}>
        <UserListItem
          u={curUser}
          onSelect={action ? action : goOnline}
          show={show}
        />
      </Box>
    </>
  );
};

export function Access() {
  const t: IAccessStrings = useSelector(accessSelector, shallowEqual);
  const users = useOrbitData<UserD[]>('user');
  const groupMemberships = useOrbitData<GroupMembership[]>('groupmembership');
  const projects = useOrbitData<ProjectD[]>('project');
  const plans = useOrbitData<Plan[]>('plan');
  const sections = useOrbitData<Section[]>('section');
  const importStatus = useSelector(
    (state: IState) => state.importexport.importexportStatus
  );
  const dispatch = useDispatch();
  const setLanguage = (lang: string) =>
    dispatch(action.setLanguage(lang) as any);
  const { pathname } = useLocation();
  const navigate = useMyNavigate();
  const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();
  //might need to add this to dependancy arrays?
  const [offline, setOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [isDeveloper] = useGlobal('developer');
  const [user] = useGlobal('user');

  const [, setOfflineOnly] = useGlobal('offlineOnly');
  const [, setRemoteBusy] = useGlobal('remoteBusy');
  const [, setCompleted] = useGlobal('progress');
  const getGlobal = useGetGlobal();
  const tokenCtx = useContext(TokenContext);
  const { logout, accessToken, expiresAt, authSessionCleared } = tokenCtx.state;
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState('');
  const [curUser, setCurUser] = useState<UserD>();
  const [whichUsers, setWhichUsers] = useState(
    localStorage.getItem('mode') ?? pathname.substring('/access/'.length)
  );
  const [selectedUser, setSelectedUser] = useState('');
  const offlineProjRead = useOfflnProjRead();
  const offlineSetup = useOfflineSetup();
  const { showMessage } = useSnackBar();
  const { resetProject } = useHome();
  const [listMode, setListMode] = useState<ListMode>(
    whichUsers === 'online-local' ? ListMode.WorkOffline : ListMode.SwitchUser
  );
  const [goOnlineConfirmation, setGoOnlineConfirmation] =
    useState<React.MouseEvent<HTMLElement>>();
  const reloginRef = useRef(false);
  const checkOnline = useCheckOnline('Access');
  const handleModeChange = (mode: ListMode) => {
    setListMode(mode);
  };

  const handleSelect = (uId: string) => {
    const selected = users.filter((u) => u.id === uId);
    if (selected.length > 0) {
      if (selected[0]?.keys?.remoteId === undefined) setOfflineOnly(true);
      setOffline(true);
      logout();
      localStorage.setItem(LocalKey.userId, (selected[0] as UserD).id);
      setSelectedUser(uId);
    }
  };

  const handleImport = () => {
    setImportOpen(true);
  };

  const handleGoOnlineConfirmed = async () => {
    if (isElectron) {
      if (!goOnlineConfirmation?.shiftKey) {
        const email = /^(auth0|google-oauth2)\|/.test(
          curUser?.attributes?.auth0Id ?? ''
        )
          ? curUser?.attributes?.email?.toLowerCase()
          : undefined;
        goOnline(email);
      } else ipc?.logout();
    }
    setGoOnlineConfirmation(undefined);
  };
  const handleGoOnlineRefused = () => {
    setGoOnlineConfirmation(undefined);
  };

  const handleGoOnline = () => {
    checkOnline((online) => {
      if (online) {
        //setGoOnlineConfirmation(event);
        handleGoOnlineConfirmed();
      } else {
        showMessage(t.mustBeOnline);
      }
    }, true);
  };

  const handleSwitchUser = () => {
    checkOnline((online) => {
      if (online) {
        //setGoOnlineConfirmation(event);
        switchUser();
      } else {
        showMessage(t.mustBeOnline);
      }
    }, true);
  };

  const handleCreateUser = async () => {
    setOffline(true);
    logout();
    setOfflineOnly(true);
    await offlineSetup();
  };

  // see: https://web.dev/persistent-storage/
  const persistData = async () => {
    if (navigator?.storage?.persisted) {
      let isPersisted = await navigator.storage.persisted();
      if (!isPersisted && navigator?.storage?.persist) {
        isPersisted = await navigator.storage.persist();
      }
      console.log(`Persisted storage granted: ${isPersisted}`);
    }
  };

  const isOnlineUserWithOfflineProjects = (userId: string) => {
    const userRec = users.filter((u) => u.id === userId);
    if (userRec.length === 0 || userRec[0]?.keys?.remoteId === undefined)
      return false;
    const grpIds = groupMemberships
      .filter((gm) => related(gm, 'user') === userId)
      .map((gm) => related(gm, 'group'));
    const projIds = projects
      .filter(
        (p) =>
          grpIds.includes(related(p, 'group')) &&
          offlineProjRead(p.id)?.attributes?.offlineAvailable
      )
      .map((p) => p.id);
    const planIds = plans
      .filter((p) => projIds.includes(related(p, 'project')))
      .map((p) => p.id);
    const userSections = sections.filter((s) =>
      planIds.includes(related(s, 'plan'))
    );
    return userSections.length > 0;
  };

  const hasOnlineUser = () => {
    for (let i = users.length - 1; i >= 0; i -= 1)
      if (typeof users[i]?.id === 'string')
        if (isOnlineUserWithOfflineProjects((users[i] as UserD).id))
          return true;
    return false;
  };

  const countWorkOfflineUsers = () => {
    let count = 0;
    for (let i = users.length - 1; i >= 0; i -= 1)
      if (typeof users[i]?.id === 'string')
        if (isOnlineUserWithOfflineProjects((users[i] as UserD).id)) count += 1;
    return count;
  };

  const isOfflineUserWithProjects = (userId: string) => {
    const userRec = users.filter((u) => u.id === userId);
    return userRec.length > 0 && userRec[0]?.keys?.remoteId === undefined;
  };

  const hasOfflineUser = () => {
    for (let i = users.length - 1; i >= 0; i -= 1)
      if (typeof users[i]?.id === 'string')
        if (isOfflineUserWithProjects((users[i] as UserD).id)) return true;
    return false;
  };

  const handleLogout = () => {
    localStorage.removeItem(LocalKey.userId);
    doLogout();
    setView('Logout');
  };

  const handleBack = () => {
    //localStorage.removeItem('offlineAdmin');
    localStorage.setItem(LocalKey.offlineAdmin, 'choose');
    localStorage.removeItem(LocalKey.loggedIn);
    setWhichUsers('');
  };

  useEffect(() => {
    if (isElectron) persistData();
    resetProject();
    checkOnline(() => {}, true);

    if (!tokenCtx.state.authenticated() && !offline && !isElectron) {
      if (!isAuthenticated) {
        const hasUsed = localStorage.key(0) !== null;
        if (hasUsed) {
          loginWithRedirect();
        } else {
          const opts =
            API_CONFIG.snagId !== ''
              ? ({ mode: 'signUp' } as RedirectLoginOptions)
              : ({ login_hint: 'signUp' } as RedirectLoginOptions);
          loginWithRedirect(opts);
        }
      } else if (
        authSessionCleared &&
        !accessToken &&
        expiresAt === -1 &&
        !isLoading
      ) {
        // Auth0 still authenticated after local session was cleared (e.g. 401).
        // Not the post-callback window before getAccessTokenSilently resolves.
        tokenCtx.state.invalidateOnlineSession();
      }
    }
    if (user && expiresAt !== -1) {
      if (localStorage.getItem(LocalKey.loggedIn) !== 'true') {
        handleSelect(user); //set by Quick Transcribe
      } else {
        waitForIt(
          'check if token is set',
          () => Boolean(accessToken),
          () => false,
          200
        ).then(() => {
          if (!localStorage.getItem(LocalKey.goingOnline)) {
            localStorage.setItem(LocalKey.goingOnline, 'true');
            handleGoOnline();
          }
        });
      }
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [accessToken, isAuthenticated, offline, expiresAt, isLoading]);

  useEffect(() => {
    if (isElectron && selectedUser === '') {
      ipc?.getProfile().then((result: any) => {
        if (result) {
          // Even tho async, this executes first b/c users takes time to load
          ipc?.getToken().then((accessToken: any) => {
            const loggedIn = localStorage.getItem(LocalKey.loggedIn) === 'true';
            if (loggedIn) {
              if (offline) setOffline(false);
              tokenCtx.state.setAuthSession(result, accessToken);
            }
            if (selectedUser === '' && loggedIn) setSelectedUser('unknownUser');
          });
        } else if (
          localStorage.getItem(LocalKey.loggedIn) === 'true' &&
          whichUsers === 'online' &&
          Boolean(
            localStorage.getItem(LocalKey.onlineUserId) ||
            localStorage.getItem(LocalKey.userId)
          ) &&
          !localStorage.getItem(LocalKey.goingOnline) &&
          !reloginRef.current
        ) {
          // Cold start: the main process only holds the auth session in
          // memory, so getProfile() is null until ipc.login() runs — which
          // used to happen only when the user clicked their own name here,
          // even though localStorage knows exactly who was logged in.
          // Continue automatically instead (same path as that click):
          // ipc.login() silently refreshes tokens from the stored refresh
          // token and only shows the auth window if that fails. Loading
          // then restores the last route (localUserKey(LocalKey.url)).
          reloginRef.current = true;
          handleGoOnline();
        }
      });
    }
    const userId = localStorage.getItem(
      localStorage.getItem(LocalKey.offlineAdmin) !== 'true'
        ? LocalKey.onlineUserId
        : LocalKey.userId
    );

    if (isElectron) {
      if (userId && !curUser) {
        const thisUser = users.filter(
          (u) => u.id === userId && Boolean(u?.keys?.remoteId)
        );
        if (thisUser.length === 1) {
          setCurUser(thisUser[0]);
          setLanguage(thisUser[0]?.attributes?.locale || 'en');
        }
      } else if (!userId && whichUsers.startsWith('online-cloud')) {
        localStorage.setItem(LocalKey.onlineUserId, 'unknown');
        handleGoOnline();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  useEffect(() => {
    const mode = localStorage.getItem('mode');
    if (mode === 'online-local') {
      handleSelect(curUser?.id || '');
    } else if (mode === 'online-cloud') {
      localStorage.removeItem('mode');
      handleGoOnline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curUser]);

  useEffect(() => {
    if (expiresAt === -1) {
      if (!offline) {
        setSelectedUser('');
      }
      localStorage.removeItem(LocalKey.goingOnline);
      reloginRef.current = false;
      setRemoteBusy(false);
      setCompleted(0);
    }
  }, [expiresAt, offline, setRemoteBusy, setCompleted]);

  useEffect(() => {
    if (
      isElectron &&
      !offline &&
      whichUsers.startsWith('online') &&
      expiresAt === -1 &&
      !tokenCtx.state.authenticated() &&
      !localStorage.getItem(LocalKey.goingOnline) &&
      !reloginRef.current
    ) {
      reloginRef.current = true;
      handleGoOnline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, whichUsers, offline]);

  if (tokenCtx.state.accessToken && !tokenCtx.state.email_verified) {
    if (localStorage.getItem(LocalKey.loggedIn) === 'true')
      navigate('/emailunverified');
    else doLogout();
  } else if (
    (!isElectron && tokenCtx.state.authenticated()) ||
    getGlobal('offlineOnly') ||
    (isElectron && selectedUser !== '')
  ) {
    // replace so neither /access nor /loading lingers in history — a back
    // traversal into either re-runs bootstrap and discards in-memory work.
    setTimeout(() => navigate('/loading', { replace: true }), 200);
  } else if (/Logout/i.test(view)) {
    navigate('/logout');
  } else if (whichUsers === '') {
    setTimeout(() => navigate('/'), 200);
  }

  const handleCurUser = () => {
    handleSelect(curUser?.id || '');
  };

  return (
    <AppLayout>
      {isElectron && (
        <Box sx={{ display: 'block' }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              pt: 4,
              pb: 0,
            }}
          >
            <Button id="back" color="primary" onClick={handleBack}>
              <ArrowBackIcon />
              {t.back}
            </Button>
            <Typography sx={{ fontSize: '16pt' }}>{t.title}</Typography>
            <Button sx={{ visibility: 'hidden' }}>
              <ArrowBackIcon />
              {t.back}
            </Button>
          </Box>

          {whichUsers.startsWith('online') && (
            <ContainerBox>
              <>
                <UserListMode
                  mode={listMode}
                  onMode={handleModeChange}
                  loggedIn={Boolean(curUser)}
                  allowOffline={hasOnlineUser()}
                />
                {listMode === ListMode.SwitchUser ? (
                  <ContainerBox>
                    {curUser && (
                      <>
                        <CurrentUser
                          curUser={curUser}
                          goOnline={handleGoOnline}
                        />
                        <SectionHead>{t.availableUsers}</SectionHead>
                      </>
                    )}
                    {!hasOnlineUser() && whichUsers === 'online-team' && (
                      <div>
                        <Box>{t.noOnlineUsers1}</Box>
                        <Box>{t.noOnlineUsers2}</Box>
                      </div>
                    )}
                    {!hasOnlineUser() && whichUsers === 'online-alone' && (
                      <div>
                        <Box>{t.noOnlineUsers3}</Box>
                        <Box>{t.noOnlineUsers4}</Box>
                      </div>
                    )}
                    <ActionBox>
                      <PriButton
                        id="accessSwitchUser"
                        onClick={handleSwitchUser}
                      >
                        {t.logIn}
                      </PriButton>
                    </ActionBox>
                    {/* </Paper> */}
                  </ContainerBox>
                ) : listMode === ListMode.WorkOffline ? (
                  <>
                    {curUser && (
                      <>
                        <CurrentUser
                          curUser={curUser}
                          action={handleCurUser}
                          goOnline={handleGoOnline}
                          show={ListEnum.organization}
                        />
                        {countWorkOfflineUsers() > 1 && (
                          <SectionHead>{t.availableUsers}</SectionHead>
                        )}
                      </>
                    )}
                    <UserList
                      isSelected={isOnlineUserWithOfflineProjects}
                      select={handleSelect}
                      curId={curUser?.id}
                      show={ListEnum.organization}
                    />
                  </>
                ) : (
                  curUser && (
                    <>
                      <CurrentUser
                        curUser={curUser}
                        action={handleLogout}
                        goOnline={handleGoOnline}
                      />
                      <AltButton id="logout" onClick={handleLogout}>
                        {t.logout}
                      </AltButton>
                    </>
                  )
                )}
              </>
            </ContainerBox>
          )}
          {whichUsers.startsWith('offline') && (
            <ContainerBox>
              <SectionHead>{t.offlineUsers}</SectionHead>
              {importStatus?.complete !== false && hasOfflineUser() && (
                <UserList
                  isSelected={isOfflineUserWithProjects}
                  select={handleSelect}
                  show={ListEnum.project}
                />
              )}
              {isDeveloper && (
                <ActionBox>
                  <AltButton id="accessCreateUser" onClick={handleCreateUser}>
                    {t.createUser}
                  </AltButton>
                </ActionBox>
              )}
              <ActionBox>
                <AltButton id="accessImport" onClick={handleImport}>
                  {t.importSnapshot}
                </AltButton>
              </ActionBox>
            </ContainerBox>
          )}
          {importOpen && (
            <ImportTab
              isOpen={importOpen}
              onOpen={setImportOpen}
              offerPtf={false}
            />
          )}
        </Box>
      )}
      {isElectron && goOnlineConfirmation && (
        <Confirm
          title={t.logIn}
          yesResponse={handleGoOnlineConfirmed}
          noResponse={handleGoOnlineRefused}
          no={t.cancel}
          text={''}
        />
      )}
    </AppLayout>
  );
}

export default Access;

import React, { useState, ReactNode } from 'react';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import { AlertSeverity } from '../hoc/SnackBar';
import { RoleNames } from '../model';
import bugsnagClient from '../auth/bugsnagClient';

// see: https://upmostly.com/tutorials/how-to-use-the-usecontext-hook-in-react

export interface GlobalState {
  //constants
  coordinator: Coordinator;
  errorReporter: typeof bugsnagClient; // bugsnagClient
  fingerprint: string;
  memory: Memory;

  //effectively constant
  lang: string; //profile
  latestVersion: string;
  loadComplete: boolean; //Loading
  offlineOnly: boolean; //errorPage, access, logout
  organization: string; //Loading
  releaseDate: string;
  user: string; //loading, profile, welcome, logout

  //modified during execution
  alertOpen: boolean; //verified
  autoOpenAddMedia: boolean; //verified  // open a dialog
  changed: boolean; //verified //UnsavedContext
  connected: boolean; //verified //useCheckOnline
  dataChangeCount: number; //verified
  developer: boolean; //not verified but not userfacing
  enableOffsite: boolean; //verified
  home: boolean; //verified //TeamScreen, useHome
  importexportBusy: boolean; //verified
  orbitRetries: number; //verified
  orgRole: RoleNames | undefined; //verified //useRole, useTeamCreate, useHome
  plan: string; //verified
  playingMediaId: string; //verified //MediaTitle - track currently playing media to coordinate playback
  progress: number; //verified
  project: string; //verified //AppHead, useUrlContext, Loading, TeamScreen
  projectsLoaded: string[]; //verified
  projType: string; //verified //useHome, useProjectType
  remoteBusy: boolean; //verified //datachanges, unsavedcontext, teamactions,consultantcheck, audiotable
  saveResult: string | undefined; //verified //PassageDetailContext, UnsavedContext
  snackAlert: AlertSeverity | undefined; //verified //SnackBar
  snackMessage: React.JSX.Element; //verified //SnackBar
  offline: boolean;
  mobileView: boolean; //verified //UserMenu - toggle mobile view
}

export type GlobalKey = keyof GlobalState;
export type GetGlobalType = <K extends GlobalKey>(prop: K) => GlobalState[K];

export interface GlobalCtxType {
  globalState: GlobalState;
  setGlobalState: React.Dispatch<React.SetStateAction<GlobalState>>;
}

const GlobalContext = React.createContext<GlobalCtxType | undefined>(undefined);

interface GlobalProps {
  init: GlobalState;
  children: ReactNode;
}

const GlobalProvider: React.FC<GlobalProps> = ({ init, children }) => {
  const [globalState, setGlobalState] = useState<GlobalState>(init);

  return (
    <GlobalContext.Provider value={{ globalState, setGlobalState }}>
      {children}
    </GlobalContext.Provider>
  );
};

export { GlobalContext, GlobalProvider };

import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';

import { coordinator, memory } from '../src/schema';
import Bugsnag from '@bugsnag/js';
import { LocalKey, localUserKey, Online } from '../src/utils';
import { isElectron, OrbitNetworkErrorRetries } from '../api-variable';
import { GlobalProvider } from '../src/context/GlobalContext';
import bugsnagClient from '../src/auth/bugsnagClient';
import { Root } from '../src/auth/Root';
import { MainAPI } from '@model/main-api';

const ipc = window?.api as MainAPI;

Online(true, (result) => {
  if (!result || !Bugsnag.isStarted()) {
    localStorage.setItem(LocalKey.connected, 'false');
  } else {
    localStorage.setItem(LocalKey.connected, 'true');
    Bugsnag.startSession();
  }
});

if (isElectron) {
  console.log(`Running in Electron: Filesystem access is enabled.`);
} else {
  console.log('Running on the Web, Filesystem access disabled.');
}

// localStorage home used by dataPath to avoid Promise
if (ipc?.home) {
  ipc.home().then((folder: string) => {
    localStorage.setItem(LocalKey.home, folder);
  });
}

const renderApp = (fingerprint: string, projectsLoaded: string[] = []) => {
  const state = {
    home: false,
    organization: '',
    orgRole: undefined,
    project: '',
    projType: '',
    plan: '',
    group: '',
    user: '',
    coordinator,
    memory,
    remoteBusy: true, //prevent datachanges until after login
    dataChangeCount: 0,
    saveResult: undefined,
    snackMessage: (<></>) as React.JSX.Element,
    snackAlert: undefined,
    changed: false,
    projectsLoaded,
    loadComplete: false,
    importexportBusy: false,
    autoOpenAddMedia: false,
    developer: localStorage.getItem(LocalKey.developer) === 'true',
    offline: isElectron,
    errorReporter: bugsnagClient,
    alertOpen: false,
    fingerprint,
    orbitRetries: OrbitNetworkErrorRetries,
    enableOffsite: false,
    connected: true,
    offlineOnly: false,
    latestVersion: '',
    releaseDate: '',
    progress: 0,
    playingMediaId: '',
    mobileView:
      localStorage.getItem(localUserKey(LocalKey.mobileView)) === 'true',
    addStoryOrPassage: false, //session-only, not persisted (cleared on exit)
  };

  const root = createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <React.StrictMode>
      <GlobalProvider init={state}>
        <Root />
      </GlobalProvider>
    </React.StrictMode>
  );
};

// first paint must not await IndexedDB migration or fingerprint.
renderApp('');

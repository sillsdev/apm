import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';

import { coordinator, memory } from '../src/schema';
import Bugsnag from '@bugsnag/js';
import {
  logError,
  Severity,
  infoMsg,
  getFingerprintArray,
  LocalKey,
  Online,
} from '../src/utils';
import { isElectron, OrbitNetworkErrorRetries } from '../api-variable';
import { GlobalProvider } from '../src/context/GlobalContext';
import bugsnagClient from '../src/auth/bugsnagClient';
import { Root } from '../src/auth/Root';
import { restoreBackup } from '../src/crud/restoreBackup';
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

const promises = [];
promises.push(getFingerprintArray());
if (isElectron) {
  console.log('restoring backup in electron in index');
  promises.push(restoreBackup(coordinator)); //.then(() => console.log('pull done'));
}
Promise.all(promises)
  .then((promResults) => {
    const state = {
      home: false,
      organization: '',
      orgRole: undefined,
      project: '',
      projType: '',
      plan: '',
      group: '',
      user: '',
      lang: 'en',
      coordinator,
      memory,
      remoteBusy: true, //prevent datachanges until after login
      dataChangeCount: 0,
      saveResult: undefined,
      snackMessage: (<></>) as JSX.Element,
      snackAlert: undefined,
      changed: false,
      projectsLoaded: promResults.length > 1 ? (promResults[1] ?? []) : [],
      loadComplete: false,
      importexportBusy: false,
      autoOpenAddMedia: false,
      developer: localStorage.getItem(LocalKey.developer) === 'true',
      offline: isElectron,
      errorReporter: bugsnagClient,
      alertOpen: false,
      fingerprint: promResults[0]?.[0] ?? '',
      orbitRetries: OrbitNetworkErrorRetries,
      enableOffsite: false,
      connected: true,
      offlineOnly: false,
      latestVersion: '',
      releaseDate: '',
      progress: 0,
      playingMediaId: '',
    };

    const root = createRoot(document.getElementById('root') as HTMLElement);
    root.render(
      <React.StrictMode>
        <GlobalProvider init={state}>
          <Root />
        </GlobalProvider>
      </React.StrictMode>
    );
  })
  .catch((err) => {
    logError(Severity.error, bugsnagClient, infoMsg(err, 'Fingerprint failed'));
  });

import DataProvider from '../hoc/DataProvider';
import { Provider } from 'react-redux';
import configureStore from '../store';

import TokenChecked from './TokenChecked';
import AuthApp from './AuthApp';
import { memory } from '../schema';
import { isElectron } from '../../api-variable';
import { RestoreBackupOnMount } from '../crud/RestoreBackupOnMount';
import { BootstrapFingerprint } from '../crud/BootstrapFingerprint';
import { SyncElectronAuthStrings } from '../crud/SyncElectronAuthStrings';

// Redux store
const store = configureStore();

export const Root: React.FC = () => (
  <DataProvider dataStore={memory}>
    <Provider store={store}>
      <BootstrapFingerprint />
      <SyncElectronAuthStrings />
      <RestoreBackupOnMount />
      {isElectron ? <TokenChecked /> : <AuthApp />}
    </Provider>
  </DataProvider>
);

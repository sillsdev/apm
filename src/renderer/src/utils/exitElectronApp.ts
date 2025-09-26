import { isElectron } from '../../api-variable';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

export const exitElectronApp = (): void => {
  if (isElectron) {
    ipc?.closeApp();
  }
};

export const relaunchApp = async (): Promise<void> => {
  if (isElectron) {
    await ipc?.relaunchApp();
  }
};

export const exitApp = async (): Promise<void> => {
  if (isElectron) {
    await ipc?.exitApp();
  }
};

export default exitElectronApp;

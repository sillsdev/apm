import { isElectron } from '../../api-variable';
const ipc = window?.electron;

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

import { isElectron } from '../../api-variable';
import { execFolder, launch } from '.';
import path from 'path-browserify';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

export const resetData = async (): Promise<void> => {
  if (isElectron) {
    const folder = path.join(await execFolder(), 'resources');
    if (await ipc?.isWindows()) {
      launch(path.join(folder, 'resetData.bat'), false);
    } else {
      launch(path.join(folder, 'resetData.sh'), false);
    }
  }
};

export default resetData;

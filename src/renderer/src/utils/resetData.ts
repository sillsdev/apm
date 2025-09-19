import { isElectron } from '../../api-variable';
import { execFolder, launch } from '.';
import path from 'path-browserify';
const ipc = window?.electron;

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

import path from 'path-browserify';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

export const execFolder = async (): Promise<string> => {
  const folder = await ipc?.execPath();
  const fromStr = path.join('node_modules', 'electron', 'dist');
  const toStr = path.join('dist', 'win-unpacked');
  const replaced = folder.replace(fromStr, toStr);
  const result = path.dirname(replaced);
  return result;
};

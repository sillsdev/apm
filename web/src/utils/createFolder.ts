import path from 'path-browserify';
import { MainAPI } from '../model/main-api';
const ipc = window?.api as MainAPI;

export const createFolder = async (folder: string): Promise<void> => {
  // Create folder if it doesn't exist
  await ipc?.createFolder(folder);
};

export const createPathFolder = (fullName: string): Promise<void> => {
  return createFolder(fullName.substring(0, fullName.lastIndexOf(path.sep)));
};

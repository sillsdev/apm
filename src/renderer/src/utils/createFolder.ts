import path from 'path-browserify';
interface ElectronIPC {
  createFolder: (folder: string) => Promise<void>;
}

const ipc = (window as { electron?: ElectronIPC })?.electron;

export const createFolder = async (folder: string): Promise<void> => {
  // Create folder if it doesn't exist
  await ipc?.createFolder(folder);
};

export const createPathFolder = (fullName: string): Promise<void> => {
  return createFolder(fullName.substring(0, fullName.lastIndexOf(path.sep)));
};

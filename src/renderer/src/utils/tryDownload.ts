import { dataPath, PathType } from './dataPath';
import path from 'path-browserify';
const ipc = window?.electron;

export const tryDownload = async (
  url: string,
  safe: boolean
): Promise<string> => {
  const local = { localname: '' };
  const where = await dataPath(url, PathType.MEDIA, local);

  if (where !== local.localname) {
    try {
      ipc?.createFolder(path.dirname(local.localname));
      console.log('downloading', local.localname, url);
      await ipc?.downloadFile(url, local.localname);
      if (await ipc?.exists(local.localname)) {
        if (safe) return local.localname;
        return local.localname;
      } else return url;
    } catch {
      return url;
    }
  }
  return local.localname;
};

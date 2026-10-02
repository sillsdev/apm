import { dataPath, PathType } from './dataPath';
import path from 'path-browserify';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

export interface TryDownloadResult {
  ok: boolean;
  path: string;
}

export const tryDownload = async (url: string): Promise<TryDownloadResult> => {
  const local = { localname: '' };
  const where = await dataPath(url, PathType.MEDIA, local);

  if (where !== local.localname) {
    try {
      ipc?.createFolder(path.dirname(local.localname));
      console.log('downloading', local.localname, url);
      const err = await ipc?.downloadFile(url, local.localname);
      if (err) {
        console.log('error', err);
        return { ok: false, path: url };
      }
      if (await ipc?.exists(local.localname)) {
        return { ok: true, path: local.localname };
      }
      return { ok: false, path: url };
    } catch {
      return { ok: false, path: url };
    }
  }
  return { ok: true, path: local.localname };
};

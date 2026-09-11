import { dataPath, PathType } from './dataPath';
import { isElectron } from '../../api-variable';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

// TT-7689: The desktop media cache is keyed by the URL basename, not by
// mediafile id. When a record is hard-deleted (Phrase Back Translate does this
// on re-record / clear) and a new take reuses the same server-generated name,
// the stale cached file would be served on playback. Evicting the cached file
// when its record is deleted lets the next fetch re-download the current audio.
export const evictMediaCache = async (url?: string): Promise<void> => {
  if (!isElectron || !url) return;
  const local = { localname: '' };
  const where = await dataPath(url, PathType.MEDIA, local);
  // dataPath returns the local path only when the cached file exists.
  if (where === local.localname && local.localname) {
    await ipc?.delete(local.localname);
  }
};

export default evictMediaCache;

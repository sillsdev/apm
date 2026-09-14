import path from 'path-browserify';
import { dataPath, PathType } from './dataPath';
import { isElectron, API_CONFIG } from '../../api-variable';
import { logError, Severity } from './logErrorService';
import bugsnagClient from '../auth/bugsnagClient';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;
const { offlineData } = API_CONFIG;

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
  if (where !== local.localname || !local.localname) return;
  // Defense-in-depth: cached media lives flat under <home>/<offlineData>/media,
  // so only unlink a path whose directory is exactly that folder. An encoded
  // traversal in the url (e.g. %2F..%2F) that decodes past the media dir then
  // resolves elsewhere is refused, so eviction can never delete an arbitrary
  // file. (Devin review, TT-7689.)
  const homeDir = localStorage.getItem('home') ?? '';
  // Without a home dir, mediaDir would be relative (e.g. offline/media) and the
  // containment check below could pass for a relative path; never target one.
  // (Copilot review, TT-7689.)
  if (!homeDir) return;
  const mediaDir = path.join(homeDir, offlineData, PathType.MEDIA);
  if (path.dirname(local.localname) !== mediaDir) return;
  // delete (fs.unlink) can reject (ENOENT race, EBUSY when the player still
  // holds the file, permissions). Report via the standard logError channel
  // (Bugsnag online / error log offline) rather than throwing, so a failed
  // eviction surfaces without derailing the PBT delete/reset flow that calls
  // us. Worst case is a stale clip left in the cache, not a broken re-record.
  try {
    await ipc?.delete(local.localname);
  } catch (err) {
    logError(
      Severity.error,
      bugsnagClient,
      `evictMediaCache failed for ${local.localname}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
};

export default evictMediaCache;

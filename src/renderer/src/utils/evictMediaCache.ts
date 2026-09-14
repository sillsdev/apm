import path from 'path-browserify';
import { dataPath, PathType } from './dataPath';
import { isElectron, API_CONFIG } from '../../api-variable';
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
  // Defense-in-depth: only unlink files inside the media cache tree
  // (<home>/<offlineData>/media, including subfolders that arise when dataPath
  // decodes %2F in an S3 filename into "/"). An encoded traversal in the url
  // (e.g. %2F..%2F) that decodes past the media dir resolves outside the tree
  // and is refused, so eviction can never delete an arbitrary file.
  // (Devin + Copilot review, TT-7689.)
  const homeDir = localStorage.getItem('home') ?? '';
  // Without a home dir, mediaDir would be relative (e.g. offline/media) and the
  // containment check below could pass for a relative path; never target one.
  if (!homeDir) return;
  const mediaDir = path.join(homeDir, offlineData, PathType.MEDIA);
  if (!local.localname.startsWith(mediaDir + '/')) return;
  // delete (fs.unlink) can reject (ENOENT race, EBUSY when the player still
  // holds the file, permissions). Report via the standard logError channel
  // (Bugsnag online / error log offline) rather than throwing, so a failed
  // eviction surfaces without derailing the PBT delete/reset flow that awaits
  // us. Worst case is a stale clip left in the cache, not a broken re-record.
  try {
    await ipc?.delete(local.localname);
  } catch (err) {
    // Import the logger lazily: it pulls in the utils barrel, and a static
    // import here would drag that whole graph into every component test that
    // transitively imports this helper (breaking jest's module parsing).
    const { logError, Severity } = await import('./logErrorService');
    const { default: bugsnagClient } = await import('../auth/bugsnagClient');
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

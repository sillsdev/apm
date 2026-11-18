/**
 * Background Sync nudge for Upload Pending (web, ADR 0016).
 *
 * The service worker cannot upload: it has no Auth0 token, presigned URL, or
 * Orbit. While offline the app registers a sync tag; when connectivity returns
 * the browser fires `sync` and `public/upload-pending-sync.js` asks one open
 * tab at a time to drain, waiting for its UploadPendingDrainReply. Upload
 * Pending that remains makes the sync fail, so the browser retries it later.
 * With no tab open nothing uploads; the next app open drains instead.
 *
 * The worker script is plain JS served outside the bundle, so it repeats the
 * tag and message literals below; `uploadPendingSyncWorker.test.ts` runs that
 * file against these constants. The service worker only exists in production
 * builds (`devOptions.enabled: false`): try it with `npm run build` then
 * `npm run serve`.
 */

export const UPLOAD_PENDING_SYNC_TAG = 'upload-pending';

export const UPLOAD_PENDING_DRAIN_MESSAGE = 'UPLOAD_PENDING_DRAIN' as const;

export type UploadPendingDrainMessage = {
  type: typeof UPLOAD_PENDING_DRAIN_MESSAGE;
};

/**
 * - `drained`: nothing Upload Pending is left for the tab's project.
 * - `pending`: some is left (upload failed, offline, or still in flight).
 * - `skipped`: this tab cannot drain (no project or token, or another tab is
 *   draining that project), so the worker asks the next tab.
 */
export type UploadPendingDrainResult = 'drained' | 'pending' | 'skipped';

/** Sent back on the MessagePort that came with the drain message. */
export type UploadPendingDrainReply = { result: UploadPendingDrainResult };

export const isUploadPendingDrainMessage = (
  data: unknown
): data is UploadPendingDrainMessage =>
  typeof data === 'object' &&
  data !== null &&
  Reflect.get(data, 'type') === UPLOAD_PENDING_DRAIN_MESSAGE;

type SyncManagerLike = { register: (tag: string) => Promise<void> };

/** SyncManager is not in lib.dom, and Safari and Firefox lack it. */
const syncManagerOf = (registration: object): SyncManagerLike | undefined => {
  const sync: unknown = Reflect.get(registration, 'sync');
  if (typeof sync !== 'object' || sync === null) return undefined;
  if (typeof Reflect.get(sync, 'register') !== 'function') return undefined;
  // register was checked to be a function just above.
  return sync as SyncManagerLike;
};

/**
 * Ask the browser to fire the Upload Pending sync when connectivity returns,
 * even if this tab has closed by then. Call it only while offline: online, the
 * sync fires at once and starts a second drain. Never rejects. Web only: in
 * Electron `navigator.serviceWorker.ready` never resolves.
 */
export const requestUploadPendingBackgroundSync = async (): Promise<void> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  try {
    const sync = syncManagerOf(await navigator.serviceWorker.ready);
    await sync?.register(UPLOAD_PENDING_SYNC_TAG);
  } catch {
    // Registration can fail (permission, private mode). Nothing is lost: the
    // online event and the next project open still drain.
  }
};

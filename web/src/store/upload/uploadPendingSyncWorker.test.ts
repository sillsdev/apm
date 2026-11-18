import { readFileSync } from 'fs';
import { join } from 'path';
import {
  UPLOAD_PENDING_DRAIN_MESSAGE,
  UPLOAD_PENDING_SYNC_TAG,
  type UploadPendingDrainResult,
} from './uploadPendingBackgroundSync';

/**
 * Runs the real public/upload-pending-sync.js against fake worker globals, so
 * the literals it repeats stay tied to uploadPendingBackgroundSync.ts.
 */

const workerSource = readFileSync(
  join(__dirname, '../../../public/upload-pending-sync.js'),
  'utf8'
);

type FakePort = { onmessage: ((event: { data: unknown }) => void) | null };
type SyncEvent = { tag: string; waitUntil: (p: Promise<unknown>) => void };

/** A tab that answers drain requests with `reply` (or never, if undefined). */
const fakeClient = (reply?: UploadPendingDrainResult) => {
  const messages: unknown[] = [];
  return {
    messages,
    postMessage: (message: unknown, transfer: FakePort[]) => {
      messages.push(message);
      if (reply) transfer[0]?.onmessage?.({ data: { result: reply } });
    },
  };
};

/** Loads the worker and fires one sync event; resolves with its outcome. */
const fireSync = (
  clients: Array<ReturnType<typeof fakeClient>>,
  tag = UPLOAD_PENDING_SYNC_TAG
): { waited: Promise<unknown> | undefined; matchAll: jest.Mock } => {
  let onSync: ((event: SyncEvent) => void) | undefined;
  const matchAll = jest.fn(async () => clients);
  const self = {
    addEventListener: (type: string, listener: (event: SyncEvent) => void) => {
      if (type === 'sync') onSync = listener;
    },
    clients: { matchAll },
  };
  class FakeMessageChannel {
    port1: FakePort = { onmessage: null };
    // The worker transfers port2 to the tab; the tab's reply lands on port1.
    port2 = this.port1;
  }
  new Function('self', 'MessageChannel', workerSource)(
    self,
    FakeMessageChannel
  );

  let waited: Promise<unknown> | undefined;
  onSync?.({ tag, waitUntil: (p) => (waited = p) });
  return { waited, matchAll };
};

describe('upload-pending-sync.js', () => {
  it('asks the first tab to drain with the shared message type', async () => {
    const tab = fakeClient('drained');
    const { waited } = fireSync([tab]);

    await expect(waited).resolves.toBeUndefined();
    expect(tab.messages).toEqual([{ type: UPLOAD_PENDING_DRAIN_MESSAGE }]);
  });

  it('stops at the first tab that drains, so no second tab uploads', async () => {
    const first = fakeClient('drained');
    const second = fakeClient('drained');
    await fireSync([first, second]).waited;

    expect(second.messages).toEqual([]);
  });

  it('moves on to the next tab when one skips', async () => {
    const noProject = fakeClient('skipped');
    const open = fakeClient('drained');
    await expect(fireSync([noProject, open]).waited).resolves.toBeUndefined();

    expect(open.messages).toHaveLength(1);
  });

  it('fails the sync when Upload Pending remains, so the browser retries', async () => {
    await expect(fireSync([fakeClient('pending')]).waited).rejects.toThrow(
      'Upload Pending remains'
    );
  });

  it('succeeds without uploading when no tab is open', async () => {
    await expect(fireSync([]).waited).resolves.toBeUndefined();
  });

  it('treats a tab that never replies as pending', async () => {
    jest.useFakeTimers();
    try {
      const { waited } = fireSync([fakeClient()]);
      const outcome = expect(waited).rejects.toThrow('Upload Pending remains');
      await jest.advanceTimersByTimeAsync(4 * 60 * 1000);
      await outcome;
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores other sync tags', () => {
    const { waited, matchAll } = fireSync([fakeClient('drained')], 'other');

    expect(waited).toBeUndefined();
    expect(matchAll).not.toHaveBeenCalled();
  });
});

import '@testing-library/jest-dom';
import {
  createPendingTitleMediaQueue,
  TitleMediaPending,
} from './pendingTitleMediaQueue';

const waitUntil = async (
  predicate: () => boolean,
  label: string,
  timeoutMs = 1000
) => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for ${label}`);
    }
    await new Promise((r) => setTimeout(r, 5));
  }
};

const pending = (
  index: number,
  mediaId: string,
  sectionId?: string
): TitleMediaPending => ({
  index,
  mediaId,
  sectionId: sectionId ?? `sec-${index}`,
  label: `row-${index}`,
});

describe('createPendingTitleMediaQueue', () => {
  it('applies all queued title media after idle and requests save once', async () => {
    let busy = true;
    const applied: TitleMediaPending[] = [];
    const saves: number[] = [];

    const queue = createPendingTitleMediaQueue({
      isBusy: () => busy,
      whenIdle: (fn) => {
        setTimeout(() => {
          busy = false;
          fn();
        }, 10);
      },
      applyOne: (item) => applied.push(item),
      requestSave: () => saves.push(1),
    });

    queue.enqueue(pending(0, 'media-row-1'));
    queue.enqueue(pending(1, 'media-row-2'));
    queue.enqueue(pending(2, 'media-row-3'));

    await waitUntil(() => applied.length === 3, 'three applies');

    expect(applied.map((a) => a.mediaId)).toEqual([
      'media-row-1',
      'media-row-2',
      'media-row-3',
    ]);
    expect(saves).toHaveLength(1);
  });

  it('retries when whenIdle rejects instead of dropping the update', async () => {
    let busy = true;
    let whenIdleAttempts = 0;
    const applied: TitleMediaPending[] = [];
    const saves: number[] = [];

    const queue = createPendingTitleMediaQueue({
      isBusy: () => busy,
      whenIdle: (fn) => {
        whenIdleAttempts += 1;
        if (whenIdleAttempts === 1) {
          return Promise.reject(new Error('waitForIt failed'));
        }
        busy = false;
        fn();
        return Promise.resolve();
      },
      applyOne: (item) => applied.push(item),
      requestSave: () => saves.push(1),
    });

    queue.enqueue(pending(1, 'media-row-2'));

    await waitUntil(() => applied.length === 1, 'apply after retry');

    expect(whenIdleAttempts).toBeGreaterThanOrEqual(2);
    expect(applied.map((a) => a.mediaId)).toEqual(['media-row-2']);
    expect(saves).toHaveLength(1);
  });

  it('overwrites pending media for the same section id (last write wins)', async () => {
    let busy = true;
    const applied: TitleMediaPending[] = [];
    const saves: number[] = [];

    const queue = createPendingTitleMediaQueue({
      isBusy: () => busy,
      whenIdle: (fn) => {
        setTimeout(() => {
          busy = false;
          fn();
        }, 10);
      },
      applyOne: (item) => applied.push(item),
      requestSave: () => saves.push(1),
    });

    queue.enqueue(pending(1, 'media-first', 'sec-a'));
    queue.enqueue(pending(1, 'media-last', 'sec-a'));

    await waitUntil(() => applied.length === 1, 'single apply for row');

    expect(applied.map((a) => a.mediaId)).toEqual(['media-last']);
    expect(saves).toHaveLength(1);
  });

  it('applies and requests save immediately when the sheet is idle', () => {
    const applied: TitleMediaPending[] = [];
    const saves: number[] = [];

    const queue = createPendingTitleMediaQueue({
      isBusy: () => false,
      whenIdle: (fn) => fn(),
      applyOne: (item) => applied.push(item),
      requestSave: () => saves.push(1),
    });

    queue.enqueue(pending(0, 'media-row-1'));

    expect(applied.map((a) => a.mediaId)).toEqual(['media-row-1']);
    expect(saves).toHaveLength(1);
  });
});

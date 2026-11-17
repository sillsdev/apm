jest.mock('./uploadPendingBlobs', () => ({
  isUploadPendingInFlight: (key: string) => key === 'busy',
}));

import { UploadType } from '../../components/UploadType';
import type { UploadPendingEntry } from './uploadPendingBlobs';
import { drainUploadPending } from './drainUploadPending';

const entry = (key: string): UploadPendingEntry => ({
  key,
  projectId: 'proj1',
  file: new File(['a'], `${key}.webm`),
  retryCount: 0,
  request: {
    uploadType: UploadType.Media,
    record: {} as UploadPendingEntry['request']['record'],
  },
});

describe('drainUploadPending', () => {
  it('does nothing for an empty queue', async () => {
    const upload = jest.fn();
    await drainUploadPending([], upload);
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads each entry in order, one at a time', async () => {
    const order: string[] = [];
    let running = 0;
    const upload = jest.fn(async (e: UploadPendingEntry) => {
      running += 1;
      expect(running).toBe(1);
      order.push(e.key);
      await Promise.resolve();
      running -= 1;
      return true;
    });

    await drainUploadPending([entry('a'), entry('b'), entry('c')], upload);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('stops at the first failure so the next online event resumes', async () => {
    const upload = jest.fn(async (e: UploadPendingEntry) => e.key !== 'b');

    await drainUploadPending([entry('a'), entry('b'), entry('c')], upload);
    expect(upload.mock.calls.map(([e]) => e.key)).toEqual(['a', 'b']);
  });

  it('skips an entry already uploading in this tab', async () => {
    const upload = jest.fn(async (_e: UploadPendingEntry) => true);

    await drainUploadPending([entry('busy'), entry('a')], upload);
    expect(upload.mock.calls.map(([e]) => e.key)).toEqual(['a']);
  });
});

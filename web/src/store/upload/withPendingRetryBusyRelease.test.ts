import { jest, describe, it, expect } from '@jest/globals';
import { withPendingRetryBusyRelease } from './withPendingRetryBusyRelease';

describe('withPendingRetryBusyRelease (TT-7363)', () => {
  it('releases dialog busy when secondary restore rejects', async () => {
    const releaseBusy = jest.fn();

    await expect(
      withPendingRetryBusyRelease(async () => {
        throw new Error('restore failed');
      }, releaseBusy)
    ).rejects.toThrow('restore failed');

    expect(releaseBusy).toHaveBeenCalledTimes(1);
  });

  it('releases dialog busy after successful restore', async () => {
    const releaseBusy = jest.fn();

    await expect(
      withPendingRetryBusyRelease(async () => 'ok', releaseBusy)
    ).resolves.toBe('ok');

    expect(releaseBusy).toHaveBeenCalledTimes(1);
  });
});

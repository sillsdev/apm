/**
 * TT-7911: while a reconnect ITF runs, the queued offline edits it carries must
 * not be replayed. orbitReset is the shared replay path, so it waits.
 */
jest.mock('../utils/logErrorService', () => ({
  __esModule: true,
  default: jest.fn(),
  Severity: { error: 'error' },
}));
jest.mock('../auth/bugsnagClient', () => ({ __esModule: true, default: {} }));

import type JSONAPISource from '@orbit/jsonapi';
import { orbitReset } from './orbitReset';
import { holdRemoteQueue } from '../utils/itfQueue';

const makeRemote = () =>
  ({
    requestQueue: {
      empty: false,
      autoProcess: true,
      retry: jest.fn().mockResolvedValue(undefined),
    },
  }) as unknown as JSONAPISource & {
    requestQueue: { retry: jest.Mock };
  };

describe('orbitReset (TT-7911)', () => {
  it('replays the queue when nothing holds it', async () => {
    const remote = makeRemote();
    await orbitReset(remote, jest.fn());
    expect(remote.requestQueue.retry).toHaveBeenCalledTimes(1);
  });

  it('does not replay while a reconnect ITF holds the queue', async () => {
    const remote = makeRemote();
    const release = holdRemoteQueue(remote);
    try {
      await orbitReset(remote, jest.fn());
      expect(remote.requestQueue.retry).not.toHaveBeenCalled();
    } finally {
      release();
    }
  });
});

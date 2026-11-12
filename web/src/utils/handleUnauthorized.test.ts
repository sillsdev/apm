import Coordinator from '@orbit/coordinator';
import JSONAPISource from '@orbit/jsonapi';
import { ITokenContext } from '../context/TokenProvider';
import {
  drainQueuesForLogout,
  handleUnauthorized,
  resetUnauthorizedRetry,
  skipAllRemoteQueues,
  skipRemoteQueue,
} from './handleUnauthorized';

const makeSource = () =>
  ({
    requestQueue: {
      length: 1,
      skip: jest.fn().mockResolvedValue(undefined),
      retry: jest.fn().mockResolvedValue(undefined),
    },
  }) as unknown as JSONAPISource;

const makeCoordinator = (remote: JSONAPISource, datachanges: JSONAPISource) =>
  ({
    sourceNames: ['remote', 'datachanges'],
    getSource: (name: string) => (name === 'remote' ? remote : datachanges),
  }) as unknown as Coordinator;

const makeTokenCtx = (accessToken: string | null): ITokenContext =>
  ({
    state: {
      accessToken,
      invalidateOnlineSession: jest.fn(),
    },
  }) as unknown as ITokenContext;

describe('handleUnauthorized queue helpers', () => {
  it('skipRemoteQueue skips when the queue has entries', async () => {
    const remote = makeSource();
    await skipRemoteQueue(remote);
    expect(remote.requestQueue.skip).toHaveBeenCalled();
  });

  it('skipAllRemoteQueues skips remote and datachanges', async () => {
    const remote = makeSource();
    const datachanges = makeSource();
    const coordinator = makeCoordinator(remote, datachanges);

    await skipAllRemoteQueues(coordinator);

    expect(remote.requestQueue.skip).toHaveBeenCalled();
    expect(datachanges.requestQueue.skip).toHaveBeenCalled();
  });

  it('drainQueuesForLogout proceeds after timeout and skips queues', async () => {
    jest.useFakeTimers();
    const remote = makeSource();
    const datachanges = makeSource();
    const coordinator = makeCoordinator(remote, datachanges);
    const waitForRemote = jest.fn(() => new Promise<void>(() => {}));
    const waitForDataChanges = jest.fn(() => new Promise<void>(() => {}));

    const done = drainQueuesForLogout(
      waitForRemote,
      waitForDataChanges,
      coordinator,
      'logout test'
    );
    await jest.advanceTimersByTimeAsync(10_000);
    await done;

    expect(waitForRemote).toHaveBeenCalledWith('logout test');
    expect(waitForDataChanges).toHaveBeenCalledWith('logout test');
    expect(remote.requestQueue.skip).toHaveBeenCalled();
    expect(datachanges.requestQueue.skip).toHaveBeenCalled();
    jest.useRealTimers();
  });
});

describe('handleUnauthorized queue routing', () => {
  beforeEach(() => resetUnauthorizedRetry());

  it('retry path retries the remote queue by default', () => {
    const remote = makeSource();
    const datachanges = makeSource();
    const coordinator = makeCoordinator(remote, datachanges);

    handleUnauthorized(makeTokenCtx('tok'), coordinator, 'fp', jest.fn());

    expect(remote.requestQueue.retry).toHaveBeenCalled();
    expect(datachanges.requestQueue.retry).not.toHaveBeenCalled();
  });

  it('retry path retries the datachanges queue when it is the failed source', () => {
    const remote = makeSource();
    const datachanges = makeSource();
    const coordinator = makeCoordinator(remote, datachanges);

    handleUnauthorized(
      makeTokenCtx('tok'),
      coordinator,
      'fp',
      jest.fn(),
      'datachanges'
    );

    expect(datachanges.requestQueue.retry).toHaveBeenCalled();
    expect(remote.requestQueue.retry).not.toHaveBeenCalled();
  });

  it('failure path skips the failed (datachanges) queue so it unsticks', async () => {
    const remote = makeSource();
    const datachanges = makeSource();
    const coordinator = makeCoordinator(remote, datachanges);
    // Second 401 (retry already attempted) drives the failure path.
    resetUnauthorizedRetry();
    handleUnauthorized(
      makeTokenCtx('tok'),
      coordinator,
      'fp',
      jest.fn(),
      'datachanges'
    );

    await handleUnauthorized(
      makeTokenCtx('tok'),
      coordinator,
      'fp',
      jest.fn(),
      'datachanges'
    );

    expect(datachanges.requestQueue.skip).toHaveBeenCalled();
  });
});

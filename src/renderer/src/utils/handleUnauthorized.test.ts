import Coordinator from '@orbit/coordinator';
import JSONAPISource from '@orbit/jsonapi';
import {
  drainQueuesForLogout,
  skipAllRemoteQueues,
  skipRemoteQueue,
} from './handleUnauthorized';

const makeSource = () =>
  ({
    requestQueue: {
      length: 1,
      skip: jest.fn().mockResolvedValue(undefined),
    },
  }) as unknown as JSONAPISource;

describe('handleUnauthorized queue helpers', () => {
  it('skipRemoteQueue skips when the queue has entries', async () => {
    const remote = makeSource();
    await skipRemoteQueue(remote);
    expect(remote.requestQueue.skip).toHaveBeenCalled();
  });

  it('skipAllRemoteQueues skips remote and datachanges', async () => {
    const remote = makeSource();
    const datachanges = makeSource();
    const coordinator = {
      getSource: (name: string) => (name === 'remote' ? remote : datachanges),
    } as unknown as Coordinator;

    await skipAllRemoteQueues(coordinator);

    expect(remote.requestQueue.skip).toHaveBeenCalled();
    expect(datachanges.requestQueue.skip).toHaveBeenCalled();
  });

  it('drainQueuesForLogout proceeds after timeout and skips queues', async () => {
    jest.useFakeTimers();
    const remote = makeSource();
    const datachanges = makeSource();
    const coordinator = {
      getSource: (name: string) => (name === 'remote' ? remote : datachanges),
    } as unknown as Coordinator;
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

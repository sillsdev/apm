import Coordinator, {
  EventLoggingStrategy,
  LogLevel,
} from '@orbit/coordinator';
import Memory from '@orbit/memory';
import { RecordSchema } from '@orbit/records';
import { removeOrbitRemote, withCoordinatorLock } from './removeOrbitRemote';

const schema = new RecordSchema({
  models: {
    user: {
      attributes: {
        name: { type: 'string' },
      },
    },
  },
});

const activatedCoordinator = async () => {
  const coordinator = new Coordinator();
  coordinator.addSource(new Memory({ schema, name: 'memory' }));
  coordinator.addSource(new Memory({ schema, name: 'remote' }));
  coordinator.addStrategy(new EventLoggingStrategy({ name: 'logging' }));
  await coordinator.activate({ logLevel: LogLevel.Warnings });
  return coordinator;
};

describe('removeOrbitRemote', () => {
  it('survives overlapping calls while going offline', async () => {
    const coordinator = await activatedCoordinator();
    await Promise.all([
      removeOrbitRemote(coordinator),
      removeOrbitRemote(coordinator),
    ]);
    expect(coordinator.sourceNames).toEqual(['memory']);
    expect(coordinator.strategyNames).toEqual(['logging']);
    expect(coordinator.activated).toBeInstanceOf(Promise);
  });

  it('waits for an in-flight teardown and not for other work', async () => {
    const coordinator = await activatedCoordinator();
    let releaseHeld: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      releaseHeld = resolve;
    });
    const holding = withCoordinatorLock(() => held);
    let releaseSlow: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      releaseSlow = resolve;
    });
    let logoutDone = false;
    const logout = removeOrbitRemote(coordinator).then(() => {
      logoutDone = true;
    });

    await Promise.resolve();
    expect(logoutDone).toBe(false);

    releaseHeld();
    await holding;
    await logout;
    expect(logoutDone).toBe(true);
    expect(coordinator.sourceNames).toEqual(['memory']);

    releaseSlow();
    await slow;
  });
});

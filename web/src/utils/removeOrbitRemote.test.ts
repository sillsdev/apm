import Coordinator, {
  EventLoggingStrategy,
  LogLevel,
} from '@orbit/coordinator';
import Memory from '@orbit/memory';
import { RecordSchema } from '@orbit/records';
import {
  bootstrapMayContinue,
  removeOrbitRemote,
  trackBackupRestore,
  withCoordinatorLock,
} from './removeOrbitRemote';

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

  it('waits for an in-flight backup restore before detaching remote', async () => {
    const coordinator = await activatedCoordinator();
    let releaseRestore: () => void = () => undefined;
    const restore = new Promise<string[]>((resolve) => {
      releaseRestore = () => resolve([]);
    });
    const tracked = trackBackupRestore(restore);
    try {
      const logout = removeOrbitRemote(coordinator);
      await Promise.resolve();
      expect(coordinator.sourceNames).toContain('remote');
      releaseRestore();
      await tracked;
      await logout;
      expect(coordinator.sourceNames).toEqual(['memory']);
    } finally {
      releaseRestore();
      await tracked;
    }
  });

  it('detaches remote after a failed backup restore', async () => {
    const coordinator = await activatedCoordinator();
    const tracked = trackBackupRestore(
      Promise.reject(new Error('IndexedDB database is not yet open'))
    );
    const logout = removeOrbitRemote(coordinator);
    await expect(tracked).rejects.toThrow('IndexedDB database is not yet open');
    await logout;
    expect(coordinator.sourceNames).toEqual(['memory']);
  });

  it('continues a fresh login before remote exists, then requires sync', () => {
    const fresh = {
      sourceNames: ['memory', 'backup'],
      strategyNames: ['logging'],
    };
    const intact = {
      sourceNames: ['memory', 'backup', 'remote'],
      strategyNames: ['remote-request', 'remote-update', 'remote-sync'],
    };
    expect(bootstrapMayContinue(fresh, true, false)).toBe(true);
    expect(bootstrapMayContinue(fresh, false, false)).toBe(false);
    expect(bootstrapMayContinue(intact, true, true)).toBe(true);
    expect(bootstrapMayContinue(intact, false, true)).toBe(false);
    expect(bootstrapMayContinue(fresh, true, true)).toBe(false);
  });
});

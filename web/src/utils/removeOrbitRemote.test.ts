import Coordinator, {
  EventLoggingStrategy,
  LogLevel,
} from '@orbit/coordinator';
import Memory from '@orbit/memory';
import { RecordSchema } from '@orbit/records';
import {
  BootstrapCancelled,
  bootstrapMayContinue,
  detachOrbitRemote,
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

  it('finishes a paused loading swap before logout teardown', async () => {
    const coordinator = await activatedCoordinator();
    let releaseLoad: () => void = () => undefined;
    const paused = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const events: string[] = [];
    const loading = (async () => {
      await withCoordinatorLock(async () => {
        events.push('load-lock');
        await paused;
        await detachOrbitRemote(coordinator, false);
        events.push('load-detached');
      });
      events.push('load-between');
      await withCoordinatorLock(async () => {
        if (!coordinator.activated) {
          await coordinator.activate({ logLevel: LogLevel.Warnings });
        }
        events.push('load-activate');
      });
      events.push('load-done');
    })();
    let teardown: Promise<void> = Promise.resolve();
    try {
      await Promise.resolve();
      teardown = removeOrbitRemote(coordinator).then(() => {
        events.push('teardown-done');
      });
      await Promise.resolve();
      expect(events).toEqual(['load-lock']);
      expect(coordinator.sourceNames).toContain('remote');

      releaseLoad();
      await loading;
      await teardown;
      expect(events).toEqual([
        'load-lock',
        'load-detached',
        'load-between',
        'teardown-done',
        'load-activate',
        'load-done',
      ]);
      expect(coordinator.sourceNames).toEqual(['memory']);
      expect(coordinator.activated).toBeInstanceOf(Promise);
    } finally {
      releaseLoad();
      await Promise.all(
        [loading, teardown].map((p) => p.catch(() => undefined))
      );
    }
  });

  it('waits for the source swap and not for the query after it', async () => {
    const coordinator = await activatedCoordinator();
    let releaseSwap: () => void = () => undefined;
    const swap = new Promise<void>((resolve) => {
      releaseSwap = resolve;
    });
    let releaseQuery: () => void = () => undefined;
    const query = new Promise<void>((resolve) => {
      releaseQuery = resolve;
    });
    // Same shape as Sources: hold the lock only while swapping sources, then
    // run the remote query outside it.
    const login = (async () => {
      await withCoordinatorLock(() => swap);
      coordinator.getSource('memory');
      await query;
    })();
    const logout = removeOrbitRemote(coordinator);

    await Promise.resolve();
    expect(coordinator.sourceNames).toContain('remote');

    releaseSwap();
    await logout;
    expect(coordinator.sourceNames).toEqual(['memory']);

    let queryFinished = false;
    void login.then(() => {
      queryFinished = true;
    });
    await Promise.resolve();
    expect(queryFinished).toBe(false);

    releaseQuery();
    await login;
  });

  it('waits for an in-flight backup restore before detaching remote', async () => {
    const coordinator = await activatedCoordinator();
    let releaseRestore: () => void = () => undefined;
    const restore = new Promise<string[]>((resolve) => {
      releaseRestore = () => resolve([]);
    });
    const tracked = trackBackupRestore(() => restore);
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
    const tracked = trackBackupRestore(() =>
      Promise.reject(new Error('IndexedDB database is not yet open'))
    );
    const logout = removeOrbitRemote(coordinator);
    await expect(tracked).rejects.toThrow('IndexedDB database is not yet open');
    await logout;
    expect(coordinator.sourceNames).toEqual(['memory']);
  });

  it('does not start a restore once teardown is requested', async () => {
    const coordinator = await activatedCoordinator();
    let releaseSwap: () => void = () => undefined;
    const swap = new Promise<void>((resolve) => {
      releaseSwap = resolve;
    });
    const loading = withCoordinatorLock(() => swap);
    await Promise.resolve();
    const logout = removeOrbitRemote(coordinator);
    let started = false;
    try {
      releaseSwap();
      expect(() =>
        trackBackupRestore(() => {
          started = true;
          return Promise.resolve([]);
        })
      ).toThrow(BootstrapCancelled);
      expect(started).toBe(false);
      expect(coordinator.sourceNames).toContain('remote');
      await loading;
      await logout;
      expect(coordinator.sourceNames).toEqual(['memory']);
      await expect(
        trackBackupRestore(() => Promise.resolve(['later']))
      ).resolves.toEqual(['later']);
    } finally {
      releaseSwap();
      await loading.catch(() => undefined);
      await logout.catch(() => undefined);
    }
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

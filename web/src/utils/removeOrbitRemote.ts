import { LogLevel } from '@orbit/coordinator';
import Coordinator from '@orbit/coordinator';

const remoteStrategies = [
  'remote-query-fail',
  'remote-update-fail',
  'datachanges-query-fail',
  'remote-request',
  'remote-update',
  'remote-sync',
] as const;

// Coordinator.deactivate() is not reentrant. A second call that starts before
// the first finishes makes EventLoggingStrategy drop listeners that are
// already gone (deepGet on undefined, reading 'memory'). Go Offline hits this
// when logout and another teardown both drop the remote. Queue only that
// teardown and the following activate — not backup restore or remote queries.
// Logout still waits for an in-flight backup restore before deactivating, so
// IndexedDB is not closed under the restore query.
let coordinatorTail: Promise<void> = Promise.resolve();
let restoreInFlight: Promise<unknown> = Promise.resolve();

/** Register the backup restore logout must finish before it deactivates. */
export function trackBackupRestore<T>(restore: Promise<T>): Promise<T> {
  const tracked = restore.then(
    (value) => {
      if (restoreInFlight === tracked) restoreInFlight = Promise.resolve();
      return value;
    },
    (err: unknown) => {
      if (restoreInFlight === tracked) restoreInFlight = Promise.resolve();
      throw err;
    }
  );
  restoreInFlight = tracked;
  return tracked;
}

export function waitForBackupRestore(): Promise<void> {
  return restoreInFlight.then(
    () => undefined,
    () => undefined
  );
}

export function withCoordinatorLock<T>(task: () => Promise<T>): Promise<T> {
  const run = coordinatorTail.then(task, task);
  coordinatorTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Caller must already hold withCoordinatorLock. */
export async function detachOrbitRemote(
  coordinator: Coordinator | undefined,
  reactivate = true
): Promise<void> {
  if (!coordinator?.sourceNames.includes('remote')) return;
  await coordinator.deactivate();
  for (const name of remoteStrategies) {
    if (coordinator.strategyNames.includes(name)) {
      coordinator.removeStrategy(name);
    }
  }
  coordinator.removeSource('remote');
  if (coordinator.sourceNames.includes('datachanges')) {
    coordinator.removeSource('datachanges');
  }
  if (reactivate) {
    await coordinator.activate({ logLevel: LogLevel.Warnings });
  }
}

export function removeOrbitRemote(
  coordinator: Coordinator | undefined,
  reactivate = true
): Promise<void> {
  return waitForBackupRestore().then(() =>
    withCoordinatorLock(() => detachOrbitRemote(coordinator, reactivate))
  );
}

/** Login stopped because logout cleared the session or detached remote sync. */
export class BootstrapCancelled extends Error {
  constructor() {
    super('Bootstrap cancelled');
    this.name = 'BootstrapCancelled';
  }
}

/** Online login may continue only while this session still owns a synced remote. */
export function onlineBootstrapIntact(
  coordinator: Pick<Coordinator, 'sourceNames' | 'strategyNames'> | undefined,
  loggedIn: boolean
): boolean {
  if (!loggedIn || !coordinator?.sourceNames.includes('remote')) return false;
  return (
    coordinator.strategyNames.includes('remote-request') &&
    coordinator.strategyNames.includes('remote-update') &&
    coordinator.strategyNames.includes('remote-sync')
  );
}

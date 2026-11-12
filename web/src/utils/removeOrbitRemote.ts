import Coordinator, { LogLevel } from '@orbit/coordinator';

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
// Logout waits for a restore that has already started. It also closes
// admission in the same turn, so a restore cannot start after teardown was
// requested and have IndexedDB closed under it. Admission reopens when every
// queued teardown has finished.
let coordinatorTail: Promise<void> = Promise.resolve();
let restoreInFlight: Promise<unknown> = Promise.resolve();
let teardownDepth = 0;

/** Login stopped because logout cleared the session or detached remote sync. */
export class BootstrapCancelled extends Error {
  constructor() {
    super('Bootstrap cancelled');
    this.name = 'BootstrapCancelled';
  }
}

/**
 * Start a backup restore, or refuse it when teardown is already requested.
 * `start` runs only if this call is admitted.
 */
export function trackBackupRestore<T>(start: () => Promise<T>): Promise<T> {
  if (teardownDepth > 0) throw new BootstrapCancelled();
  const restore = start();
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
  teardownDepth += 1;
  return waitForBackupRestore().then(() =>
    withCoordinatorLock(async () => {
      try {
        await detachOrbitRemote(coordinator, reactivate);
      } finally {
        teardownDepth -= 1;
      }
    })
  );
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

/**
 * Before this login installs remote, only a cleared session cancels bootstrap.
 * A fresh coordinator has memory and backup and no remote yet.
 */
export function bootstrapMayContinue(
  coordinator: Pick<Coordinator, 'sourceNames' | 'strategyNames'> | undefined,
  loggedIn: boolean,
  remoteInstalled: boolean
): boolean {
  if (!loggedIn) return false;
  if (!remoteInstalled) return true;
  return onlineBootstrapIntact(coordinator, true);
}

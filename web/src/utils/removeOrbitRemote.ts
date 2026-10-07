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
// when logout and another teardown both drop the remote. One queue for every
// deactivate/reactivate, including Sources().
let coordinatorTail: Promise<void> = Promise.resolve();

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
  return withCoordinatorLock(() => detachOrbitRemote(coordinator, reactivate));
}

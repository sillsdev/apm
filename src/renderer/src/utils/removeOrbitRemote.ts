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

export async function removeOrbitRemote(
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

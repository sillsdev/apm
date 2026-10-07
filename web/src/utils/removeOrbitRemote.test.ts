import Coordinator, {
  EventLoggingStrategy,
  LogLevel,
} from '@orbit/coordinator';
import Memory from '@orbit/memory';
import { RecordSchema } from '@orbit/records';
import { removeOrbitRemote } from './removeOrbitRemote';

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
});

jest.mock('../hoc/processDataChanges', () => ({
  processDataChanges: jest.fn(),
}));

jest.mock('../utils', () => {
  const currentDateTimeMod = jest.requireActual('../utils/currentDateTime');
  const localUserKeyMod = jest.requireActual('../utils/localUserKey');
  return {
    currentDateTime: currentDateTimeMod.currentDateTime,
    localUserKey: localUserKeyMod.localUserKey,
    LocalKey: localUserKeyMod.LocalKey,
  };
});

jest.mock('../crud', () => {
  const remoteIdMod = jest.requireActual('../crud/remoteId');
  return {
    ...remoteIdMod,
    offlineProjectUpdateSnapshot: jest.fn(),
    remoteIdNum: () => 1,
  };
});

import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import { doDataChanges } from '../hoc/doDataChanges';
import { processDataChanges } from '../hoc/processDataChanges';
import { LocalKey, localUserKey } from '../utils/localUserKey';

const mockProcessDataChanges = processDataChanges as jest.Mock;

const createCoordinator = () => {
  const memory = {
    keyMap: {
      idToKey: () => '1',
      keyToId: () => 'p-local',
    },
    cache: { query: () => [] },
    sync: jest.fn(),
  } as unknown as Memory;

  const backup = {
    cache: { dbVersion: 6 },
    sync: jest.fn(),
  };

  const remote = { activated: true };

  return {
    getSource: (name: string) => {
      if (name === 'memory') return memory;
      if (name === 'backup') return backup;
      if (name === 'remote') return remote;
      return {};
    },
  } as unknown as Coordinator;
};

const runDoDataChanges = async () => {
  await doDataChanges(
    'token',
    createCoordinator(),
    'fingerprint',
    [],
    () => ({ attributes: { snapshotDate: '2026-01-01T00:00:00.000Z' } }) as never,
    jest.fn(),
    'user-1',
    jest.fn(),
    jest.fn()
  );
};

beforeEach(() => {
  localStorage.clear();
  mockProcessDataChanges.mockReset();
});

describe('TT-6919 reload reconciliation', () => {
  it('completed save leaves LocalKey.start at 0 after doDataChanges', async () => {
    const timeKey = localUserKey(LocalKey.time);
    const startKey = localUserKey(LocalKey.start);
    localStorage.setItem(timeKey, '2026-06-23T00:00:00.000Z');
    localStorage.setItem(startKey, '0');

    mockProcessDataChanges.mockResolvedValue(-1);

    await expect(runDoDataChanges()).resolves.not.toThrow();
    expect(localStorage.getItem(startKey)).toBe('0');
  });

  it('interrupted save with mid-pagination start fails reconciliation', async () => {
    const timeKey = localUserKey(LocalKey.time);
    const startKey = localUserKey(LocalKey.start);
    localStorage.setItem(timeKey, '2026-06-20T00:00:00.000Z');
    localStorage.setItem(startKey, '5');

    mockProcessDataChanges.mockRejectedValue(
      new Error('datachanges pagination failed')
    );

    await expect(runDoDataChanges()).rejects.toThrow(
      'datachanges pagination failed'
    );
    expect(localStorage.getItem(startKey)).toBe('5');
  });

  it('recovers mid-pagination LocalKey.start after completed reconciliation (post-fix expectation)', async () => {
    const startKey = localUserKey(LocalKey.start);
    localStorage.setItem(localUserKey(LocalKey.time), '2026-06-20T00:00:00.000Z');
    localStorage.setItem(startKey, '5');

    mockProcessDataChanges.mockResolvedValue(-1);

    await expect(runDoDataChanges()).resolves.not.toThrow();
    expect(localStorage.getItem(startKey)).toBe('0');
  });
});

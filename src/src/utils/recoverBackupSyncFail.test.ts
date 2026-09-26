import IndexedDBSource from '@orbit/indexeddb';
import {
  isIndexedDbNotOpen,
  recoverBackupSyncFail,
} from './recoverBackupSyncFail';

const notOpen = () => new Error('IndexedDB database is not yet open');

const mockBackup = (opts: {
  isDBOpen?: boolean;
  empty?: boolean;
  openDB?: jest.Mock;
  retry?: jest.Mock;
  skip?: jest.Mock;
}) => {
  const retry = opts.retry ?? jest.fn().mockResolvedValue(undefined);
  const skip = opts.skip ?? jest.fn().mockResolvedValue(undefined);
  const openDB = opts.openDB ?? jest.fn().mockResolvedValue({});
  return {
    backup: {
      cache: {
        isDBOpen: opts.isDBOpen ?? false,
        openDB,
      },
      syncQueue: {
        empty: opts.empty ?? false,
        retry,
        skip,
      },
    } as unknown as IndexedDBSource,
    retry,
    skip,
    openDB,
  };
};

describe('isIndexedDbNotOpen', () => {
  it('matches Orbit IndexedDBCache.createTransaction', () => {
    expect(isIndexedDbNotOpen(notOpen())).toBe(true);
    expect(isIndexedDbNotOpen('IndexedDB database is not yet open')).toBe(true);
    expect(isIndexedDbNotOpen(new Error('other'))).toBe(false);
    expect(isIndexedDbNotOpen(undefined)).toBe(false);
  });
});

describe('recoverBackupSyncFail', () => {
  it('rethrows errors that are not a closed IndexedDB', async () => {
    const { backup, retry, skip } = mockBackup({ isDBOpen: true });
    const err = new Error('disk full');
    await expect(recoverBackupSyncFail(backup, err)).rejects.toBe(err);
    expect(retry).not.toHaveBeenCalled();
    expect(skip).not.toHaveBeenCalled();
  });

  it('reopens IndexedDB and retries the sync queue', async () => {
    const { backup, retry, skip } = mockBackup({ isDBOpen: false });
    const cache = (
      backup as unknown as { cache: { isDBOpen: boolean; openDB: jest.Mock } }
    ).cache;
    cache.openDB = jest.fn(async () => {
      cache.isDBOpen = true;
    });

    await recoverBackupSyncFail(backup, notOpen());

    expect(cache.openDB).toHaveBeenCalled();
    expect(retry).toHaveBeenCalled();
    expect(skip).not.toHaveBeenCalled();
  });

  it('retries without openDB when the database is already open', async () => {
    const { backup, retry, skip, openDB } = mockBackup({ isDBOpen: true });

    await recoverBackupSyncFail(backup, notOpen());

    expect(openDB).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalled();
    expect(skip).not.toHaveBeenCalled();
  });

  it('skips the queued sync when IndexedDB stays closed so loading can continue', async () => {
    const { backup, retry, skip, openDB } = mockBackup({ isDBOpen: false });

    await recoverBackupSyncFail(backup, notOpen());

    expect(openDB).toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    expect(skip).toHaveBeenCalled();
  });

  it('skips when retry still reports a closed IndexedDB so loading can continue', async () => {
    const { backup, skip } = mockBackup({
      isDBOpen: true,
      retry: jest.fn().mockRejectedValue(notOpen()),
    });

    await recoverBackupSyncFail(backup, notOpen());

    expect(skip).toHaveBeenCalled();
  });

  it('propagates skip failure so the blocking strategy does not look recovered', async () => {
    const skipErr = new Error('Processing cancelled via `TaskQueue#skip`');
    const { backup } = mockBackup({
      isDBOpen: false,
      skip: jest.fn().mockRejectedValue(skipErr),
    });

    await expect(recoverBackupSyncFail(backup, notOpen())).rejects.toBe(
      skipErr
    );
  });

  it('rethrows storage errors after reopen instead of dropping the backup write', async () => {
    const quota = new Error('QuotaExceededError');
    const { backup, skip } = mockBackup({
      isDBOpen: true,
      retry: jest.fn().mockRejectedValue(quota),
    });

    await expect(recoverBackupSyncFail(backup, notOpen())).rejects.toBe(quota);
    expect(skip).not.toHaveBeenCalled();
  });

  it('does nothing when the sync queue is empty', async () => {
    const { backup, retry, skip, openDB } = mockBackup({
      empty: true,
      isDBOpen: false,
    });

    await recoverBackupSyncFail(backup, notOpen());

    expect(openDB).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
    expect(skip).not.toHaveBeenCalled();
  });
});

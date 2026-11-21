const mockLogError = jest.fn();
jest.mock('./logErrorService', () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  Severity: { info: 0, error: 1, retry: 2 },
}));

import { hasStorageRoomFor } from './storageRoom';

const setEstimate = (estimate: (() => Promise<StorageEstimate>) | undefined) =>
  Object.defineProperty(navigator, 'storage', {
    value: estimate ? { estimate } : undefined,
    configurable: true,
  });

describe('hasStorageRoomFor', () => {
  const reporter = 'test-reporter';

  afterEach(() => mockLogError.mockReset());

  it('is true when the quota leaves room', async () => {
    setEstimate(async () => ({ quota: 1000, usage: 100 }));
    expect(await hasStorageRoomFor(900, reporter)).toBe(true);
  });

  it('is false when the download would exceed the quota', async () => {
    setEstimate(async () => ({ quota: 1000, usage: 500 }));
    expect(await hasStorageRoomFor(600, reporter)).toBe(false);
  });

  it('is true when the browser cannot estimate', async () => {
    setEstimate(undefined);
    expect(await hasStorageRoomFor(10, reporter)).toBe(true);
  });

  it('logs a failed estimate and allows the download', async () => {
    setEstimate(async () => {
      throw new Error('denied');
    });
    expect(await hasStorageRoomFor(10, reporter)).toBe(true);
    expect(mockLogError).toHaveBeenCalled();
  });
});

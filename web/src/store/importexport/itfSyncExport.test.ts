/**
 * TT-7911: the ITFSYNC export moved out of Sources.tsx so the online start and
 * the reconnect path share it. These pin the startup contract it had there.
 */
const mockElectronExport = jest.fn();
jest.mock('./electronExport', () => ({
  electronExport: (...args: unknown[]) => mockElectronExport(...args),
}));
const mockLogError = jest.fn();
jest.mock('../../utils/logErrorService', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockLogError(...args),
  logError: (...args: unknown[]) => mockLogError(...args),
  Severity: { error: 1 },
}));
jest.mock('../../utils/infoMsg', () => ({
  infoMsg: (e: Error, info: string) => ({ ...e, name: info + e.name }),
}));
jest.mock('../../auth/bugsnagClient', () => ({
  __esModule: true,
  default: {},
}));

import type Memory from '@orbit/memory';
import { exportItfSync } from './itfSyncExport';
import { ExportType } from './types';
import { markNeedItfSync, needItfSync } from '../../utils/needItfSync';

const args = {
  memory: {} as Memory,
  backup: undefined,
  getOfflineProject: jest.fn(),
  errorReporter: undefined,
};

describe('exportItfSync (TT-7911)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    markNeedItfSync();
  });

  it('exports every offline project as an ITFSYNC', async () => {
    mockElectronExport.mockResolvedValue(null);
    await exportItfSync(args);
    expect(mockElectronExport).toHaveBeenCalledTimes(1);
    expect(mockElectronExport.mock.calls[0][0]).toBe(ExportType.ITFSYNC);
    expect(mockElectronExport.mock.calls[0][2]).toBe(args.memory);
    expect(mockElectronExport.mock.calls[0][8]).toBe(args.getOfflineProject);
  });

  it('returns the file and the records it carries when there are changes', async () => {
    const buffer = Buffer.from('itf');
    const records = [{ type: 'passage', id: 'p1' }];
    mockElectronExport.mockResolvedValue({
      buffer,
      message: 'sync.itf',
      changes: 2,
      records,
    });
    await expect(exportItfSync(args)).resolves.toEqual({
      buffer,
      fileName: 'sync.itf',
      records,
    });
    // The flag clears only after a confirmed upload.
    expect(needItfSync()).toBe(true);
  });

  it('clears the flag and returns nothing when there is nothing to send', async () => {
    mockElectronExport.mockResolvedValue({
      buffer: undefined,
      message: 'sync.itf',
      changes: 0,
    });
    await expect(exportItfSync(args)).resolves.toBeUndefined();
    expect(needItfSync()).toBe(false);
  });

  it('reports and rethrows a failed export, keeping the flag', async () => {
    mockElectronExport.mockRejectedValue(new Error('zip failed'));
    await expect(exportItfSync(args)).rejects.toThrow('zip failed');
    expect(mockLogError).toHaveBeenCalled();
    expect(needItfSync()).toBe(true);
  });
});

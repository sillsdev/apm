/**
 * TT-7911: the reconnect ITF upload reuses processImportFile (the startup
 * path's upload) but reports progress to its caller instead of the import
 * dialog's Redux status, and can be cancelled until the server starts
 * applying it.
 */
import { IMPORT_ERROR, IMPORT_PENDING, IMPORT_SUCCESS } from './types';

type Params = {
  file: Blob;
  filename: string;
  getProcessUrl: (f: string, k: string) => string;
  getInitialStart: () => string;
  signal?: AbortSignal;
  dispatch: (action: { type: string; payload: unknown }) => void;
};
const mockProcessImportFile = jest.fn<Promise<unknown>, [Params]>();
jest.mock('./actions', () => ({
  processImportFile: (p: Params) => mockProcessImportFile(p),
  itfImportTarget: () => ({
    getProcessUrl: (f: string) => `https://api.test/api/offlineData/sync/${f}/`,
    getInitialStart: () => '0/0',
  }),
}));

import { uploadItfSync } from './uploadItfSync';

const file = {
  buffer: Buffer.from('itf'),
  fileName: 'sync.itf',
  records: [],
};

describe('uploadItfSync (TT-7911)', () => {
  beforeEach(() => mockProcessImportFile.mockReset());

  it('uploads the ITF to the sync endpoint with the cancel signal', async () => {
    mockProcessImportFile.mockImplementation(async (p) => {
      p.dispatch({ type: IMPORT_SUCCESS, payload: { msg: '[]' } });
      return {};
    });
    const controller = new AbortController();
    await uploadItfSync({
      file,
      token: 'tok',
      errorReporter: undefined,
      signal: controller.signal,
      onApplying: jest.fn(),
    });
    const params = mockProcessImportFile.mock.calls[0][0];
    expect(params.filename).toBe('sync.itf');
    expect(params.file.size).toBe(3);
    expect(params.getProcessUrl('up.itf', '')).toBe(
      'https://api.test/api/offlineData/sync/up.itf/'
    );
    expect(params.getInitialStart()).toBe('0/0');
    expect(params.signal).toBe(controller.signal);
  });

  it('tells the caller when the server starts applying the ITF', async () => {
    const onApplying = jest.fn();
    mockProcessImportFile.mockImplementation(async (p) => {
      p.dispatch({ type: IMPORT_PENDING, payload: '' });
      p.dispatch({ type: IMPORT_SUCCESS, payload: { msg: '[]' } });
      return {};
    });
    await uploadItfSync({
      file,
      token: 'tok',
      errorReporter: undefined,
      signal: new AbortController().signal,
      onApplying,
    });
    expect(onApplying).toHaveBeenCalledTimes(1);
  });

  it('rejects when the import reports an error without throwing', async () => {
    mockProcessImportFile.mockImplementation(async (p) => {
      p.dispatch({
        type: IMPORT_ERROR,
        payload: { errStatus: 413, errMsg: '50 GB' },
      });
      return {};
    });
    await expect(
      uploadItfSync({
        file,
        token: 'tok',
        errorReporter: undefined,
        signal: new AbortController().signal,
        onApplying: jest.fn(),
      })
    ).rejects.toThrow('50 GB');
  });

  it('passes a failed upload through', async () => {
    mockProcessImportFile.mockRejectedValue(new Error('Network Error'));
    await expect(
      uploadItfSync({
        file,
        token: 'tok',
        errorReporter: undefined,
        signal: new AbortController().signal,
        onApplying: jest.fn(),
      })
    ).rejects.toThrow('Network Error');
  });
});

/**
 * TT-7911: a cancelled reconnect ITF must not reach the server's import step,
 * and a cancel is not reported as an import error.
 */
import Axios from 'axios';

jest.mock('../../../api-variable', () => ({
  API_CONFIG: { host: 'https://api.test' },
}));
jest.mock('axios');
jest.mock('../../utils', () => ({
  logError: jest.fn(),
  orbitInfo: jest.fn(),
  Severity: { error: 'error', retry: 'retry' },
}));
jest.mock('../../utils/axios', () => ({ axiosPost: jest.fn() }));
jest.mock('../../crud', () => ({
  remoteIdGuid: jest.fn(),
  related: jest.fn(),
  insertData: jest.fn(),
  remoteId: jest.fn(),
  findRecord: jest.fn(),
  mediaArtifacts: jest.fn(),
  ArtifactTypeSlug: {},
  VernacularTag: '',
}));
jest.mock('../../crud/updateBackTranslationType', () => ({
  updateBackTranslationType: jest.fn(),
}));
jest.mock('../../crud/updateConsultantWorkflowStep', () => ({
  updateConsultantWorkflowStep: jest.fn(),
}));
jest.mock('./electronExport', () => ({ electronExport: jest.fn() }));
jest.mock('../../serializers/getSerializer', () => ({
  getDocSerializer: jest.fn(),
}));
jest.mock('../../schema', () => ({ requestedSchema: 1 }));

import { itfImportTarget, processImportFile } from './actions';

const mockedAxios = Axios as jest.Mocked<typeof Axios>;

describe('processImportFile cancel (TT-7911)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stops before uploading when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const dispatch = jest.fn();
    await expect(
      processImportFile({
        filename: 'sync.itf',
        file: new Blob(['itf']),
        itf: true,
        ...itfImportTarget(0),
        token: 'tok',
        errorReporter: undefined,
        pendingmsg: '',
        completemsg: '',
        dispatch,
        signal: controller.signal,
      })
    ).rejects.toBeDefined();
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.put).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('targets the sync endpoint for a whole-account ITF', () => {
    const target = itfImportTarget(0);
    expect(target.getProcessUrl('up.itf', '')).toBe(
      'https://api.test/api/offlineData/sync/up.itf/'
    );
    expect(target.getInitialStart()).toBe('0/0');
  });

  it('targets the project import endpoint for a project ITF', () => {
    const target = itfImportTarget(42);
    expect(target.getProcessUrl('up.itf', '')).toBe(
      'https://api.test/api/offlineData/project/import/42/up.itf/'
    );
    expect(target.getInitialStart()).toBe('0');
  });
});

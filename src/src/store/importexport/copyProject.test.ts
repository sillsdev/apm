/* eslint-disable @typescript-eslint/no-require-imports */
import Axios from 'axios';
import { COPY_ERROR, COPY_PENDING, COPY_SUCCESS } from './types';

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

const { copyProject } = require('./actions') as typeof import('./actions');

const mockedAxios = Axios as jest.Mocked<typeof Axios>;

const headerTooLarge =
  "Your request header section exceeds the maximum allowed size.=>Exception of type 'Amazon.Runtime.Internal.HttpErrorResponseException' was thrown.";

const copyProps = {
  projectid: 302465,
  orgid: 0,
  token: 'tok',
  errorReporter: {},
  pendingmsg: 'Copy to Team',
  completemsg: '{0}',
};

describe('copyProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.put.mockReset();
    mockedAxios.isAxiosError.mockImplementation((err: unknown) =>
      Boolean(
        err &&
        typeof err === 'object' &&
        (err as { isAxiosError?: boolean }).isAxiosError
      )
    );
  });

  it('fails when copydata returns 422 in the body instead of treating it as progress', async () => {
    mockedAxios.put
      .mockResolvedValueOnce({
        data: {
          status: 200,
          id: 1,
          fileURL: '302496',
          message: 'copied 1',
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: 422,
          id: 0,
          fileURL: '302496',
          message: headerTooLarge,
          contentType: 'application/json',
        },
      })
      .mockResolvedValueOnce({ data: {} });

    const dispatch = jest.fn();
    await copyProject(copyProps)(dispatch);

    const payloads = dispatch.mock.calls.map((c) => c[0]);
    expect(payloads.map((a) => a.type)).not.toContain(COPY_SUCCESS);
    const error = payloads.find((a) => a.type === COPY_ERROR);
    expect(error?.payload.errStatus).toBe(422);
    expect(error?.payload.errMsg).toContain('header section exceeds');
    expect(
      payloads.filter(
        (a) =>
          a.type === COPY_PENDING &&
          String(a.payload).includes('header section')
      )
    ).toHaveLength(0);
  });

  it('uses the copydata error body when Axios throws HTTP 422', async () => {
    const err = Object.assign(
      new Error('Request failed with status code 422'),
      {
        isAxiosError: true,
        response: {
          status: 422,
          data: {
            status: 422,
            message: headerTooLarge,
            fileURL: '302496',
            id: 0,
          },
        },
      }
    );
    mockedAxios.put.mockRejectedValueOnce(err);
    mockedAxios.put.mockResolvedValueOnce({ data: {} });

    const dispatch = jest.fn();
    await copyProject(copyProps)(dispatch);

    const error = dispatch.mock.calls
      .map((c) => c[0])
      .find((a) => a.type === COPY_ERROR);
    expect(error?.payload.errStatus).toBe(422);
    expect(error?.payload.errMsg).toContain('header section exceeds');
  });

  it('completes when copydata returns 200 and id -1', async () => {
    mockedAxios.put
      .mockResolvedValueOnce({
        data: {
          status: 200,
          id: 1,
          fileURL: '302496',
          message: 'copied 1',
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: 200,
          id: -1,
          fileURL: '302496',
          message: 'done',
        },
      })
      .mockResolvedValueOnce({ data: {} });

    const dispatch = jest.fn();
    await copyProject(copyProps)(dispatch);

    const types = dispatch.mock.calls.map((c) => c[0].type);
    expect(types).toContain(COPY_SUCCESS);
    expect(types).not.toContain(COPY_ERROR);
  });
});

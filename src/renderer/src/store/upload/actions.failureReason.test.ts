/* eslint-disable @typescript-eslint/no-require-imports */
import Axios from 'axios';
import { UploadType } from '../../components/UploadType';
import { type MediaFileAttributes } from '../../model';
import { UploadFailureReason } from './uploadRetry';

jest.mock('../../../api-variable', () => ({
  API_CONFIG: { host: 'https://api.test', sizeLimit: '500' },
}));
jest.mock('../../utils/typeLimit', () => ({
  typeLimit: () => 500,
}));
jest.mock('axios');
jest.mock('../../auth/bugsnagClient', () => ({}));

jest.mock('./pendingMediaUploads', () => ({
  appendPendingMediaUpload: jest.fn(() => ({
    id: 'pending-1',
    localAbsolutePath: '/staged/test.mp3',
  })),
  updatePendingMediaUpload: jest.fn(() => ({
    id: 'pending-1',
    localAbsolutePath: '/staged/test.mp3',
  })),
  removePendingMediaUpload: jest.fn(),
}));

jest.mock('../../utils', () => ({
  dataPath: jest.fn(),
  infoMsg: jest.fn((e: Error) => e.message),
  logError: jest.fn(),
  PathType: { MEDIA: 'media' },
  Severity: { error: 'error' },
  createPathFolder: jest.fn(),
  removeExtension: jest.fn((name: string) => ({ name, ext: 'mp3' })),
}));

jest.mock('./uploadRetry', () => {
  const actual = jest.requireActual('./uploadRetry');
  return {
    ...actual,
    waitForImportExportIdle: jest.fn(async () => undefined),
    sleepMs: jest.fn(() => Promise.resolve()),
  };
});

const { nextUpload } = require('./actions') as typeof import('./actions');

const mockedAxios = Axios as jest.Mocked<typeof Axios>;

const baseRecord = {
  planId: '1',
  versionNumber: 1,
  originalFile: 'test.mp3',
  contentType: 'audio/mpeg',
  artifactTypeId: '',
  passageId: '',
  userId: '1',
  recordedbyUserId: '1',
  sourceMediaId: '',
  sourceSegments: '{}',
  performedBy: null,
  topic: '',
  eafUrl: '',
  transcription: '',
} as unknown as MediaFileAttributes;

const makeFile = (name = 'test.mp3') =>
  new File([new Uint8Array([1, 2, 3])], name, { type: 'audio/mpeg' });

const flushPromises = async (times = 40) => {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
};

/** Drive the PUT through XMLHttpRequest with the outcome a real S3 attempt would give. */
function stubPutResponse(outcome: 'networkError' | 'timeout' | number) {
  const xhrProto = XMLHttpRequest.prototype;
  jest.spyOn(xhrProto, 'open').mockImplementation(() => undefined);
  jest.spyOn(xhrProto, 'setRequestHeader').mockImplementation(() => undefined);
  jest.spyOn(xhrProto, 'send').mockImplementation(function (
    this: XMLHttpRequest
  ) {
    if (outcome === 'networkError') {
      // A dropped connection: the browser reports status 0, not an HTTP status.
      Object.defineProperty(this, 'status', { value: 0, configurable: true });
      this.onerror?.(new ProgressEvent('error'));
      return;
    }
    if (outcome === 'timeout') {
      this.ontimeout?.(new ProgressEvent('timeout'));
      return;
    }
    Object.defineProperty(this, 'status', {
      value: outcome,
      configurable: true,
    });
    this.onload?.(new ProgressEvent('load'));
  });
}

async function runUpload(file = makeFile(), record = baseRecord) {
  const cb = jest.fn();
  const action = nextUpload({
    record,
    files: [file],
    n: 0,
    token: 'token',
    offline: false,
    errorReporter: {} as never,
    uploadType: UploadType.Media,
    cb,
  });
  action(jest.fn());
  await flushPromises();
  return cb;
}

const reasonOf = (cb: jest.Mock) => cb.mock.calls.at(-1)?.[3]?.reason;

describe('nextUpload failure reason reported to cb', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.post.mockResolvedValue({
      data: { data: { id: 7, attributes: { 'audio-url': 'https://s3/put' } } },
    } as never);
    mockedAxios.delete.mockResolvedValue({} as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports NoResponse when the PUT never reaches the server', async () => {
    stubPutResponse('networkError');
    expect(reasonOf(await runUpload())).toBe(UploadFailureReason.NoResponse);
  });

  it('reports Timeout when the PUT times out', async () => {
    stubPutResponse('timeout');
    expect(reasonOf(await runUpload())).toBe(UploadFailureReason.Timeout);
  });

  it('reports Rejected when the PUT is refused', async () => {
    stubPutResponse(403);
    expect(reasonOf(await runUpload())).toBe(UploadFailureReason.Rejected);
  });

  it('reports ServerError when the PUT fails server-side', async () => {
    stubPutResponse(500);
    expect(reasonOf(await runUpload())).toBe(UploadFailureReason.ServerError);
  });

  it('reports NoResponse when the POST gets no response', async () => {
    stubPutResponse(200);
    mockedAxios.post.mockRejectedValue({ message: 'Network Error' } as never);
    expect(reasonOf(await runUpload())).toBe(UploadFailureReason.NoResponse);
  });

  it('reports Rejected when the POST is refused', async () => {
    stubPutResponse(200);
    mockedAxios.post.mockRejectedValue({
      response: { status: 403 },
      message: 'Forbidden',
    } as never);
    expect(reasonOf(await runUpload())).toBe(UploadFailureReason.Rejected);
  });

  it('reports UnsupportedType before any request is made', async () => {
    stubPutResponse(200);
    const cb = await runUpload(
      new File([new Uint8Array([1])], 'notes.xyz', { type: 'application/xyz' }),
      { ...baseRecord, originalFile: 'notes.xyz' } as MediaFileAttributes
    );
    expect(reasonOf(cb)).toBe(UploadFailureReason.UnsupportedType);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
import Axios from 'axios';
import { UploadType } from '../../components/UploadType';
import { MediaFileAttributes } from '../../model';
import { waitForImportExportIdle } from './uploadRetry';

jest.mock('../../../api-variable', () => ({
  API_CONFIG: { host: 'https://api.test', sizeLimit: '500' },
}));
jest.mock('../../components/MediaUpload', () => ({
  SIZELIMIT: () => 500,
}));
jest.mock('axios');
jest.mock('../../auth/bugsnagClient', () => ({}));
jest.mock('./pendingMediaUploads', () => ({
  appendPendingMediaUpload: jest.fn(),
  removePendingMediaUpload: jest.fn(),
}));
jest.mock('../../utils', () => ({
  dataPath: jest.fn(),
  infoMsg: jest.fn((e: Error) => e.message),
  logError: jest.fn(),
  PathType: { MEDIA: 'media' },
  Severity: { error: 'error' },
  createPathFolder: jest.fn(),
  removeExtension: jest.fn((name: string) => ({
    name,
    ext: 'mp3',
  })),
}));

jest.mock('./uploadRetry', () => {
  const actual = jest.requireActual('./uploadRetry');
  return {
    ...actual,
    waitForImportExportIdle: jest.fn(actual.waitForImportExportIdle),
    sleepMs: jest.fn(() => Promise.resolve()),
  };
});

const { nextUpload } = require('./actions') as typeof import('./actions');

const mockedAxios = Axios as jest.Mocked<typeof Axios>;
const mockedWait = waitForImportExportIdle as jest.MockedFunction<
  typeof waitForImportExportIdle
>;

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
} as MediaFileAttributes & {
  planId: string;
  artifactTypeId: string;
  passageId: string;
  userId: string;
  recordedbyUserId: string;
  sourceMediaId: string;
};

const makeFile = () =>
  new File([new Uint8Array([1, 2, 3])], 'test.mp3', { type: 'audio/mpeg' });

const vndResponse = {
  data: {
    data: {
      id: '42',
      type: 'mediafiles',
      attributes: {
        'version-number': 1,
        'original-file': 'test.mp3',
        'content-type': 'audio/mpeg',
        'audio-url': 'https://s3.example/presigned',
        'eaf-url': '',
        'date-created': '2026-01-01T00:00:00.000Z',
        'source-segments': '{}',
        'performed-by': null,
        topic: '',
        transcription: '',
      },
    },
  },
};

describe('nextUpload import/export busy handling', () => {
  let dispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    dispatch = jest.fn();
    mockedAxios.post.mockResolvedValue(vndResponse as never);
    mockedWait.mockImplementation(async (getBusy) => {
      while (getBusy()) {
        await Promise.resolve();
      }
    });
    // uploadFile uses XHR; skip PUT by using text/plain non-downloadable - no, mp3 is downloadable
    // Mock uploadFile path via successful PUT - need to mock XMLHttpRequest
    const xhrProto = XMLHttpRequest.prototype;
    jest.spyOn(xhrProto, 'open').mockImplementation(function (
      this: XMLHttpRequest,
      _method: string,
      _url: string | URL
    ) {
      return undefined;
    });
    jest.spyOn(xhrProto, 'send').mockImplementation(function (
      this: XMLHttpRequest
    ) {
      Object.defineProperty(this, 'status', { value: 200, configurable: true });
      if (this.onload) this.onload(new ProgressEvent('load'));
    });
    jest
      .spyOn(xhrProto, 'setRequestHeader')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const flushPromises = async (times = 12) => {
    for (let i = 0; i < times; i += 1) {
      await Promise.resolve();
    }
  };

  const runNextUpload = async (
    overrides: Partial<Parameters<typeof nextUpload>[0]>
  ) => {
    const action = nextUpload({
      record: baseRecord,
      files: [makeFile()],
      n: 0,
      token: 'token',
      offline: false,
      errorReporter: {} as never,
      uploadType: UploadType.Media,
      cb: jest.fn(),
      ...overrides,
    });
    action(dispatch);
    await flushPromises();
  };

  it('proceeds when import is not busy', async () => {
    await runNextUpload({
      getImportExportBusy: () => false,
    });

    expect(mockedWait).toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalled();
  });

  it('skips import wait when getImportExportBusy is omitted (subsequent batch files)', async () => {
    mockedWait.mockClear();
    await runNextUpload({});

    expect(mockedWait).not.toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalled();
  });
});

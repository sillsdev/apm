/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-require-imports */
import Axios from 'axios';
import { UploadType } from '../../components/UploadType';
import { type MediaFileAttributes } from '../../model';

jest.mock('../../../api-variable', () => ({
  API_CONFIG: { host: 'https://api.test', sizeLimit: '500' },
}));
jest.mock('../../utils/typeLimit', () => ({
  typeLimit: () => 500,
}));
jest.mock('axios');
jest.mock('../../auth/bugsnagClient', () => ({}));

const appendPendingMediaUpload = jest.fn();
const updatePendingMediaUpload = jest.fn();
const removePendingMediaUpload = jest.fn();
const removeMatchingPendingUploads = jest.fn();

jest.mock('./pendingMediaUploads', () => ({
  appendPendingMediaUpload: (...args: unknown[]) =>
    appendPendingMediaUpload(...args),
  updatePendingMediaUpload: (...args: unknown[]) =>
    updatePendingMediaUpload(...args),
  removePendingMediaUpload: (...args: unknown[]) =>
    removePendingMediaUpload(...args),
  removeMatchingPendingUploads: (...args: unknown[]) =>
    removeMatchingPendingUploads(...args),
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

const pendingRecord = {
  id: 'pending-retry-1',
  failedAt: '2026-01-01T00:00:00.000Z',
  localAbsolutePath: '/staged/test.mp3',
  fileSize: 3,
  uploadType: UploadType.Media,
  record: baseRecord,
};

describe('nextUpload pending retry failure', () => {
  let dispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    dispatch = jest.fn();
    mockedAxios.post.mockRejectedValue({
      response: { status: 500 },
      message: 'network error',
    } as never);
    updatePendingMediaUpload.mockReturnValue(pendingRecord);
    appendPendingMediaUpload.mockReturnValue(pendingRecord);

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

  const flushPromises = async (times = 16) => {
    for (let i = 0; i < times; i += 1) {
      await Promise.resolve();
    }
  };

  it('updates existing pending row instead of appending on terminal failure', async () => {
    const action = nextUpload({
      record: baseRecord,
      files: [makeFile()],
      n: 0,
      token: 'token',
      offline: false,
      errorReporter: {} as never,
      uploadType: UploadType.Media,
      pendingUploadIdToClearOnSuccess: 'pending-retry-1',
      cb: jest.fn(),
    });
    action(dispatch);
    await flushPromises();

    expect(updatePendingMediaUpload).toHaveBeenCalledWith(
      'pending-retry-1',
      expect.objectContaining({
        fileSize: 3,
        uploadType: UploadType.Media,
      })
    );
    expect(appendPendingMediaUpload).not.toHaveBeenCalled();
  });

  it('appends pending row on terminal failure when not retrying from queue', async () => {
    const action = nextUpload({
      record: baseRecord,
      files: [makeFile()],
      n: 0,
      token: 'token',
      offline: false,
      errorReporter: {} as never,
      uploadType: UploadType.Media,
      cb: jest.fn(),
    });
    action(dispatch);
    await flushPromises();

    expect(appendPendingMediaUpload).toHaveBeenCalled();
    expect(updatePendingMediaUpload).not.toHaveBeenCalled();
  });
});

const vndResponse = {
  data: {
    data: {
      id: '42',
      type: 'mediafiles',
      attributes: {
        'version-number': 1,
        'original-file': 'test.mp3',
        'content-type': 'audio/mpeg',
        'audio-url': 'https://s3.example.com/test.mp3',
      },
    },
  },
};

describe('nextUpload pending clear on success (TT-7347)', () => {
  let dispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    dispatch = jest.fn();
    mockedAxios.post.mockResolvedValue(vndResponse as never);

    const xhrProto = XMLHttpRequest.prototype;
    jest.spyOn(xhrProto, 'open').mockImplementation(function () {
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

  const flushPromises = async (times = 16) => {
    for (let i = 0; i < times; i += 1) {
      await Promise.resolve();
    }
  };

  it('clears matching pending rows on success even without a retry id', async () => {
    const action = nextUpload({
      record: { ...baseRecord, passageId: 'passage-1' } as typeof baseRecord,
      files: [makeFile()],
      n: 0,
      token: 'token',
      offline: false,
      errorReporter: {} as never,
      uploadType: UploadType.Media,
      cb: jest.fn(),
    });
    action(dispatch);
    await flushPromises();

    expect(mockedAxios.post).toHaveBeenCalled();
    expect(removeMatchingPendingUploads).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: '1',
        passageId: 'passage-1',
        originalFile: 'test.mp3',
      })
    );
    expect(removePendingMediaUpload).not.toHaveBeenCalled();
  });

  it('removes the staged pending id after a successful PUT', async () => {
    const file = Object.assign(makeFile(), { path: '/staged/test.mp3' });
    appendPendingMediaUpload.mockImplementation((entry: unknown) => ({
      id: 'staged-success-1',
      failedAt: '2026-01-01T00:00:00.000Z',
      ...(entry as object),
    }));

    const action = nextUpload({
      record: baseRecord,
      files: [file],
      n: 0,
      token: 'token',
      offline: false,
      errorReporter: {} as never,
      uploadType: UploadType.Media,
      cb: jest.fn(),
    });
    action(dispatch);
    await flushPromises();

    expect(appendPendingMediaUpload).toHaveBeenCalled();
    expect(removePendingMediaUpload).toHaveBeenCalledWith('staged-success-1');
    expect(removeMatchingPendingUploads).toHaveBeenCalled();
  });
});

describe('nextUpload enqueue after staging (TT-7348)', () => {
  let dispatch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    dispatch = jest.fn();
    appendPendingMediaUpload.mockImplementation((entry: unknown) => ({
      id: 'staged-1',
      failedAt: '2026-01-01T00:00:00.000Z',
      ...(entry as object),
    }));
    updatePendingMediaUpload.mockImplementation(
      (id: unknown, patch: unknown) => ({
        id,
        failedAt: '2026-01-01T00:00:00.000Z',
        ...(patch as object),
      })
    );

    const xhrProto = XMLHttpRequest.prototype;
    jest.spyOn(xhrProto, 'open').mockImplementation(function () {
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

  const flushPromises = async (times = 16) => {
    for (let i = 0; i < times; i += 1) {
      await Promise.resolve();
    }
  };

  it('appends pending after local staging even if POST never completes', async () => {
    mockedAxios.post.mockImplementation(() => new Promise(() => undefined));
    const file = Object.assign(makeFile(), { path: '/staged/test.mp3' });

    const action = nextUpload({
      record: baseRecord,
      files: [file],
      n: 0,
      token: 'token',
      offline: false,
      errorReporter: {} as never,
      uploadType: UploadType.Media,
      cb: jest.fn(),
    });
    action(dispatch);
    await flushPromises();

    expect(appendPendingMediaUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        localAbsolutePath: '/staged/test.mp3',
        fileSize: 3,
        uploadType: UploadType.Media,
      })
    );
    expect(mockedAxios.post).toHaveBeenCalled();
  });

  it('updates the staged pending row on terminal failure instead of appending a second time', async () => {
    mockedAxios.post.mockRejectedValue({
      response: { status: 500 },
      message: 'network error',
    } as never);
    const file = Object.assign(makeFile(), { path: '/staged/test.mp3' });

    const action = nextUpload({
      record: baseRecord,
      files: [file],
      n: 0,
      token: 'token',
      offline: false,
      errorReporter: {} as never,
      uploadType: UploadType.Media,
      cb: jest.fn(),
    });
    action(dispatch);
    await flushPromises();

    expect(appendPendingMediaUpload).toHaveBeenCalledTimes(1);
    expect(updatePendingMediaUpload).toHaveBeenCalledWith(
      'staged-1',
      expect.objectContaining({
        localAbsolutePath: '/staged/test.mp3',
      })
    );
  });
});

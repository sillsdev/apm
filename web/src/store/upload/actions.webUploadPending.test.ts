/* eslint-disable @typescript-eslint/no-require-imports */
import Axios from 'axios';
import { UploadType } from '../../components/UploadType';
import { type MediaFileAttributes } from '../../model';

// Web: the Upload Pending queue is the Local Media Blob store (ADR 0016).
jest.mock('../../../api-variable', () => ({
  API_CONFIG: { host: 'https://api.test', sizeLimit: '500' },
  isElectron: false,
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
const findPendingUploadIdForIdentity = jest.fn();
jest.mock('./pendingMediaUploads', () => ({
  appendPendingMediaUpload: (...a: unknown[]) => appendPendingMediaUpload(...a),
  updatePendingMediaUpload: (...a: unknown[]) => updatePendingMediaUpload(...a),
  removePendingMediaUpload: (...a: unknown[]) => removePendingMediaUpload(...a),
  removeMatchingPendingUploads: (...a: unknown[]) =>
    removeMatchingPendingUploads(...a),
  findPendingUploadIdForIdentity: (...a: unknown[]) =>
    findPendingUploadIdForIdentity(...a),
}));

const events: string[] = [];
const saveUploadPendingBlob = jest.fn();
const findUploadPendingKeyForIdentity = jest.fn();
const recordUploadPendingFailure = jest.fn();
const settleUploadPending = jest.fn();
const claimUploadPending = jest.fn();
const releaseUploadPending = jest.fn();
jest.mock('./uploadPendingBlobs', () => ({
  saveUploadPendingBlob: (...a: unknown[]) => saveUploadPendingBlob(...a),
  findUploadPendingKeyForIdentity: (...a: unknown[]) =>
    findUploadPendingKeyForIdentity(...a),
  recordUploadPendingFailure: (...a: unknown[]) =>
    recordUploadPendingFailure(...a),
  settleUploadPending: (...a: unknown[]) => settleUploadPending(...a),
  claimUploadPending: (...a: unknown[]) => claimUploadPending(...a),
  releaseUploadPending: (...a: unknown[]) => releaseUploadPending(...a),
  newUploadPendingKey: () => 'new-key',
}));

jest.mock('./uploadPendingBackgroundSync', () => ({
  requestUploadPendingBackgroundSync: jest.fn(async () => undefined),
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
  const actual = jest.requireActual(
    './uploadRetry'
  ) as typeof import('./uploadRetry');
  return {
    ...actual,
    waitForImportExportIdle: jest.fn(async () => undefined),
    sleepMs: jest.fn(() => Promise.resolve()),
  };
});

const { nextUpload } = require('./actions') as typeof import('./actions');
const { logError } = require('../../utils') as { logError: jest.Mock };

const mockedAxios = Axios as jest.Mocked<typeof Axios>;

const record = {
  planId: '1',
  versionNumber: 1,
  originalFile: 'test.mp3',
  contentType: 'audio/mpeg',
  artifactTypeId: '',
  passageId: 'passage-1',
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

const vndResponse = {
  data: {
    data: {
      id: 42,
      type: 'mediafiles',
      attributes: {
        'original-file': 'test.mp3',
        'content-type': 'audio/mpeg',
        'audio-url': 'https://s3.example.com/test.mp3',
      },
    },
  },
};

const makeFile = () =>
  new File([new Uint8Array([1, 2, 3])], 'test.mp3', { type: 'audio/mpeg' });

const settle = async () => {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const run = (extra: Partial<Parameters<typeof nextUpload>[0]> = {}) => {
  const cb = jest.fn();
  nextUpload({
    record,
    files: [makeFile()],
    n: 0,
    token: 'token',
    offline: false,
    errorReporter: {} as never,
    uploadType: UploadType.Media,
    projectId: 'project-1',
    cb,
    ...extra,
  })(jest.fn());
  return cb;
};

let putStatus = 200;

beforeEach(() => {
  jest.clearAllMocks();
  events.length = 0;
  putStatus = 200;
  findUploadPendingKeyForIdentity.mockResolvedValue(undefined);
  claimUploadPending.mockReturnValue(true);
  saveUploadPendingBlob.mockImplementation(async () => {
    events.push('save');
  });
  settleUploadPending.mockResolvedValue(undefined);
  recordUploadPendingFailure.mockResolvedValue(undefined);
  mockedAxios.post.mockImplementation(async () => {
    events.push('post');
    return vndResponse as never;
  });

  const xhrProto = XMLHttpRequest.prototype;
  jest.spyOn(xhrProto, 'open').mockImplementation(() => undefined);
  jest.spyOn(xhrProto, 'send').mockImplementation(function (
    this: XMLHttpRequest
  ) {
    Object.defineProperty(this, 'status', {
      value: putStatus,
      configurable: true,
    });
    if (this.onload) this.onload(new ProgressEvent('load'));
  });
  jest.spyOn(xhrProto, 'setRequestHeader').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('nextUpload on web saves an Upload Pending Local Media Blob', () => {
  it('saves the recording on the device before the cloud attempt', async () => {
    run();
    await settle();

    expect(events).toEqual(['save', 'post']);
    expect(saveUploadPendingBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'new-key',
        projectId: 'project-1',
        request: expect.objectContaining({
          uploadType: UploadType.Media,
          record: expect.objectContaining({ originalFile: 'test.mp3' }),
        }),
      })
    );
  });

  it('marks it Cloud-backed under the mediafile id after success', async () => {
    const cb = run();
    await settle();

    expect(cb).toHaveBeenCalledWith(0, true, expect.anything());
    expect(settleUploadPending).toHaveBeenCalledWith({
      key: 'new-key',
      mediafileId: '42',
      projectId: 'project-1',
      identity: {
        planId: '1',
        passageId: 'passage-1',
        artifactTypeId: '',
        originalFile: 'test.mp3',
      },
    });
    expect(releaseUploadPending).toHaveBeenCalledWith('new-key');
    expect(removeMatchingPendingUploads).not.toHaveBeenCalled();
  });

  it('leaves it Upload Pending and keeps no localStorage row when the upload fails', async () => {
    putStatus = 500;
    const onTerminalFailure = jest.fn();
    const cb = run({ onTerminalFailure });
    await settle();

    expect(cb).toHaveBeenCalledWith(0, false, undefined, expect.any(String));
    expect(recordUploadPendingFailure).toHaveBeenCalledWith('new-key');
    expect(settleUploadPending).not.toHaveBeenCalled();
    expect(appendPendingMediaUpload).not.toHaveBeenCalled();
    expect(updatePendingMediaUpload).not.toHaveBeenCalled();
    expect(onTerminalFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingRecord: expect.objectContaining({ id: 'new-key' }),
      })
    );
    expect(releaseUploadPending).toHaveBeenCalledWith('new-key');
  });

  describe('offline (localOnlyMedia)', () => {
    let onLine: jest.SpyInstance<boolean, []>;
    beforeEach(() => {
      onLine = jest
        .spyOn(window.navigator, 'onLine', 'get')
        .mockReturnValue(false);
      mockedAxios.post.mockImplementation(async () => {
        events.push('post');
        throw Object.assign(new Error('Network Error'), {
          isAxiosError: true,
        });
      });
    });
    afterEach(() => onLine.mockRestore());

    it('hands back the Upload Pending key without retrying', async () => {
      const cb = run();
      await settle();

      expect(events.filter((e) => e === 'post')).toHaveLength(1);
      expect(cb).toHaveBeenCalledWith(
        0,
        false,
        expect.objectContaining({
          uploadPendingKey: 'new-key',
          audioUrl: 'local-media:new-key',
          originalFile: 'test.mp3',
        }),
        expect.any(String)
      );
    });

    it('does not hand back a key when the server rejected the upload', async () => {
      mockedAxios.post.mockImplementation(async () => {
        throw Object.assign(new Error('Bad Request'), {
          isAxiosError: true,
          response: { status: 400 },
        });
      });
      const cb = run();
      await settle();

      expect(cb).toHaveBeenCalledWith(0, false, undefined, expect.any(String));
    });
  });

  it('reuses the blob already saved for this recording (TT-7365)', async () => {
    findUploadPendingKeyForIdentity.mockResolvedValue('earlier-key');
    run();
    await settle();

    expect(findUploadPendingKeyForIdentity).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({ passageId: 'passage-1' })
    );
    expect(saveUploadPendingBlob).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'earlier-key' })
    );
  });

  it('retries a queued blob under its own key', async () => {
    run({ pendingUploadIdToClearOnSuccess: 'queued-key' });
    await settle();

    expect(findUploadPendingKeyForIdentity).not.toHaveBeenCalled();
    expect(findPendingUploadIdForIdentity).not.toHaveBeenCalled();
    expect(settleUploadPending).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'queued-key' })
    );
  });

  it('saves a separate copy when that blob is already uploading in this tab', async () => {
    claimUploadPending.mockImplementation((key: string) => key !== 'busy-key');
    run({ pendingUploadIdToClearOnSuccess: 'busy-key' });
    await settle();

    expect(saveUploadPendingBlob).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'new-key' })
    );
  });

  it('still uploads, and reports the problem, when the device save fails', async () => {
    saveUploadPendingBlob.mockRejectedValue(new Error('quota'));
    const cb = run();
    await settle();

    expect(logError).toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith(0, true, expect.anything());
    expect(settleUploadPending).not.toHaveBeenCalled();
    expect(releaseUploadPending).toHaveBeenCalledWith('new-key');
  });

  it('keeps the blob claimed until it is marked Cloud-backed', async () => {
    // cb runs before settleUploadPending, so a drain sees this upload finish
    // before the Cloud-backed write commits. The claim stays held until that
    // write ends, so a second drain pass skips the blob instead of uploading
    // it again.
    let finishSettle!: () => void;
    settleUploadPending.mockReturnValue(
      new Promise<void>((resolve) => {
        finishSettle = resolve;
      })
    );
    const cb = run({ pendingUploadIdToClearOnSuccess: 'queued-key' });
    await settle();

    expect(cb).toHaveBeenCalledWith(0, true, expect.anything());
    expect(settleUploadPending).toHaveBeenCalled();
    expect(releaseUploadPending).not.toHaveBeenCalled();

    finishSettle();
    await settle();

    expect(releaseUploadPending).toHaveBeenCalledWith('queued-key');
  });

  it('keeps the blob Upload Pending when the success callback fails', async () => {
    const cb = jest.fn(() => Promise.reject(new Error('restore failed')));
    run({ cb });
    await settle();

    expect(settleUploadPending).not.toHaveBeenCalled();
  });

  it('does not save links on the device', async () => {
    run({
      record: { ...record, contentType: 'text/markdown' },
      files: [new File(['# hi'], 'note.md', { type: 'text/markdown' })],
      uploadType: UploadType.MarkDown,
    });
    await settle();

    expect(saveUploadPendingBlob).not.toHaveBeenCalled();
  });
});

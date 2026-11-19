/* eslint-disable @typescript-eslint/no-require-imports */
import { type MediaFileAttributes } from '../../model';
import type { PutBlobBodyReject } from './putBlobBody';

jest.mock('../../../api-variable', () => ({
  API_CONFIG: { host: 'https://api.test', sizeLimit: '500' },
  isElectron: false,
}));
jest.mock('../../utils/typeLimit', () => ({ typeLimit: () => 500 }));
jest.mock('axios');
jest.mock('../../auth/bugsnagClient', () => ({}));
jest.mock('../../utils', () => ({
  dataPath: jest.fn(),
  infoMsg: jest.fn((e: Error) => e.message),
  logError: jest.fn(),
  PathType: { MEDIA: 'media' },
  Severity: { error: 'error' },
  createPathFolder: jest.fn(),
  removeExtension: jest.fn((name: string) => ({ name, ext: 'mp3' })),
}));

const mockPutBlobBody = jest.fn();
jest.mock('./putBlobBody', () => ({
  ...jest.requireActual<typeof import('./putBlobBody')>('./putBlobBody'),
  putBlobBody: (...args: unknown[]) => mockPutBlobBody(...args),
}));

const { uploadFile, UploadFileReject } =
  require('./actions') as typeof import('./actions');
const { logError } = require('../../utils') as { logError: jest.Mock };

const media = {
  audioUrl: 'https://bucket.s3.test/key?sig=1',
  contentType: 'audio/webm',
} as MediaFileAttributes;
const file = new File([new Uint8Array(3)], 'take.webm');

const failWith = (rej: PutBlobBodyReject) =>
  mockPutBlobBody.mockRejectedValueOnce(rej);

const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });

describe('uploadFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setOnline(true);
  });

  it('resolves with the PUT result and sends the file to the presigned URL', async () => {
    mockPutBlobBody.mockResolvedValueOnce({ statusNum: 0, statusText: '' });

    await expect(uploadFile(media, file, undefined as never)).resolves.toEqual({
      statusNum: 0,
      statusText: '',
    });
    expect(mockPutBlobBody).toHaveBeenCalledWith(
      expect.objectContaining({
        url: media.audioUrl,
        blob: file,
        contentType: 'audio/webm',
      })
    );
  });

  it('reports an HTTP failure with its status and body', async () => {
    failWith({
      failure: 'http',
      statusNum: 403,
      statusText: 'SignatureDoesNotMatch',
      httpStatus: 403,
    });

    const err = await uploadFile(media, file, undefined as never).catch(
      (e: unknown) => e
    );

    expect(err).toBeInstanceOf(UploadFileReject);
    expect(err).toMatchObject({
      statusNum: 403,
      statusText: 'SignatureDoesNotMatch',
      httpStatus: 403,
    });
    expect(logError).toHaveBeenCalledWith(
      'error',
      undefined,
      'upload take.webm: (403) SignatureDoesNotMatch'
    );
  });

  it('reports a network error with offline state, size, and host', async () => {
    setOnline(false);
    failWith({
      failure: 'network',
      statusNum: 500,
      statusText: 'upload failed',
    });

    const err = await uploadFile(media, file, undefined as never).catch(
      (e: unknown) => e
    );

    const detail =
      'upload failed; network error; offline; take.webm (3 bytes); bucket.s3.test';
    expect(err).toMatchObject({
      statusNum: 500,
      statusText: detail,
      httpStatus: undefined,
    });
    expect(logError).toHaveBeenCalledWith(
      'error',
      undefined,
      `upload take.webm: ${detail}`
    );
  });

  it('names the HTTP status of an error that got a response', async () => {
    failWith({
      failure: 'network',
      statusNum: 502,
      statusText: 'upload failed',
      httpStatus: 502,
    });

    await expect(
      uploadFile(media, file, undefined as never)
    ).rejects.toMatchObject({
      statusNum: 502,
      statusText:
        'upload failed; HTTP 502; take.webm (3 bytes); bucket.s3.test',
    });
  });

  it.each([
    ['aborted', 499, 'upload aborted'],
    ['timeout', 408, 'upload timed out after 1000ms'],
  ] as const)(
    'rejects %s without a report (the caller retries)',
    async (failure, statusNum, statusText) => {
      failWith({ failure, statusNum, statusText, httpStatus: statusNum });

      await expect(
        uploadFile(media, file, undefined as never)
      ).rejects.toMatchObject({ statusNum, statusText });
      expect(logError).not.toHaveBeenCalled();
    }
  );
});

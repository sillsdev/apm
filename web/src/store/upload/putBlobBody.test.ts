import {
  isPutBlobBodyReject,
  putBlobBody,
  UPLOAD_ABORTED_STATUS,
  UPLOAD_FAILED_TEXT,
  UPLOAD_NO_RESPONSE_STATUS,
  UPLOAD_TIMEOUT_STATUS,
} from './putBlobBody';

type FakeXhr = {
  open: jest.Mock;
  setRequestHeader: jest.Mock;
  send: jest.Mock;
  status: number;
  responseText: string;
  timeout: number;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  ontimeout: (() => void) | null;
};

const fakeXhr = (status = 200, responseText = ''): FakeXhr => ({
  open: jest.fn(),
  setRequestHeader: jest.fn(),
  send: jest.fn(),
  status,
  responseText,
  timeout: 0,
  onload: null,
  onerror: null,
  onabort: null,
  ontimeout: null,
});

const blob = new Blob([new Uint8Array([1, 2, 3])]);

/** Starts a PUT on `xhr`; the test then fires one of its handlers. */
const startPut = (xhr: FakeXhr) =>
  putBlobBody(
    {
      url: 'https://s3.example/put',
      blob,
      contentType: 'audio/webm',
      timeoutMs: 1000,
    },
    // The fake implements every member putBlobBody touches.
    () => xhr as unknown as XMLHttpRequest
  );

describe('putBlobBody', () => {
  it('sends the blob itself with the content type and timeout', async () => {
    const xhr = fakeXhr();
    const pending = startPut(xhr);
    xhr.onload?.();

    await expect(pending).resolves.toEqual({ statusNum: 0, statusText: '' });
    expect(xhr.open).toHaveBeenCalledWith(
      'PUT',
      'https://s3.example/put',
      true
    );
    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      'Content-Type',
      'audio/webm'
    );
    expect(xhr.timeout).toBe(1000);
    expect(xhr.send).toHaveBeenCalledWith(blob);
  });

  it('rejects a non-2xx response with its status and body', async () => {
    const xhr = fakeXhr(403, 'SignatureDoesNotMatch');
    const pending = startPut(xhr);
    xhr.onload?.();

    await expect(pending).rejects.toEqual({
      failure: 'http',
      statusNum: 403,
      statusText: 'SignatureDoesNotMatch',
      httpStatus: 403,
    });
  });

  it('falls back to a generic message when a failed response has no body', async () => {
    const xhr = fakeXhr(500, '');
    const pending = startPut(xhr);
    xhr.onload?.();

    await expect(pending).rejects.toMatchObject({
      statusText: UPLOAD_FAILED_TEXT,
    });
  });

  it('rejects a network error with no HTTP status', async () => {
    const xhr = fakeXhr(0);
    const pending = startPut(xhr);
    xhr.onerror?.();

    await expect(pending).rejects.toEqual({
      failure: 'network',
      statusNum: UPLOAD_NO_RESPONSE_STATUS,
      statusText: UPLOAD_FAILED_TEXT,
      httpStatus: undefined,
    });
  });

  it('keeps the status of an error that did get a response', async () => {
    const xhr = fakeXhr(502);
    const pending = startPut(xhr);
    xhr.onerror?.();

    await expect(pending).rejects.toMatchObject({
      failure: 'network',
      statusNum: 502,
      httpStatus: 502,
    });
  });

  it('rejects an abort', async () => {
    const xhr = fakeXhr();
    const pending = startPut(xhr);
    xhr.onabort?.();

    await expect(pending).rejects.toMatchObject({
      failure: 'aborted',
      statusNum: UPLOAD_ABORTED_STATUS,
    });
  });

  it('rejects a timeout and names the limit', async () => {
    const xhr = fakeXhr();
    const pending = startPut(xhr);
    xhr.ontimeout?.();

    await expect(pending).rejects.toEqual({
      failure: 'timeout',
      statusNum: UPLOAD_TIMEOUT_STATUS,
      statusText: 'upload timed out after 1000ms',
      httpStatus: UPLOAD_TIMEOUT_STATUS,
    });
  });
});

describe('isPutBlobBodyReject', () => {
  it('accepts a reject from putBlobBody', () => {
    expect(
      isPutBlobBodyReject({ failure: 'http', statusNum: 403, statusText: 'x' })
    ).toBe(true);
  });

  it.each([
    ['null', null],
    ['an Error', new Error('boom')],
    ['an unknown failure', { failure: 'other', statusNum: 1, statusText: '' }],
    ['a missing status', { failure: 'http', statusText: '' }],
  ])('rejects %s', (_label, value) => {
    expect(isPutBlobBodyReject(value)).toBe(false);
  });
});

/**
 * PUT a media blob to a presigned S3 URL with XHR. `xhr.send(blob)` reads the
 * Blob from disk as it sends, so a large recording is never held as a second
 * full copy in memory.
 *
 * A streaming fetch body (ReadableStream + `duplex: 'half'`) is not used:
 * Chromium only streams request bodies over HTTP/2 or QUIC, and an S3 PUT is
 * HTTP/1.1 and needs a Content-Length. Uploading in true chunks would need S3
 * multipart upload, which needs server support (ADR 0016).
 */

export type PutBlobBodyArgs = {
  url: string;
  blob: Blob;
  contentType: string;
  timeoutMs: number;
};

export type PutBlobBodyResult = { statusNum: number; statusText: string };

/** Why the PUT failed, so callers can report each case differently. */
export type PutBlobBodyFailure = 'http' | 'network' | 'aborted' | 'timeout';

export type PutBlobBodyReject = PutBlobBodyResult & {
  failure: PutBlobBodyFailure;
  /** The HTTP status, or undefined when no response arrived. */
  httpStatus?: number;
};

export const UPLOAD_FAILED_TEXT = 'upload failed';
export const UPLOAD_ABORTED_TEXT = 'upload aborted';
/** Status reported when the request never got an HTTP response. */
export const UPLOAD_NO_RESPONSE_STATUS = 500;
export const UPLOAD_ABORTED_STATUS = 499;
export const UPLOAD_TIMEOUT_STATUS = 408;

const FAILURES: ReadonlyArray<PutBlobBodyFailure> = [
  'http',
  'network',
  'aborted',
  'timeout',
];

export const isPutBlobBodyReject = (
  value: unknown
): value is PutBlobBodyReject => {
  if (typeof value !== 'object' || value === null) return false;
  const failure: unknown = Reflect.get(value, 'failure');
  return (
    FAILURES.some((f) => f === failure) &&
    typeof Reflect.get(value, 'statusNum') === 'number' &&
    typeof Reflect.get(value, 'statusText') === 'string'
  );
};

/** Resolves on a 2xx/1xx response; rejects with a PutBlobBodyReject. */
export const putBlobBody = (
  args: PutBlobBodyArgs,
  xhrFactory: () => XMLHttpRequest = () => new XMLHttpRequest()
): Promise<PutBlobBodyResult> =>
  new Promise((resolve, reject) => {
    let xhr = xhrFactory();
    const cleanup = (): void => {
      xhr.onload = null;
      xhr.onerror = null;
      xhr.onabort = null;
      xhr.ontimeout = null;
      // @ts-ignore allow memory to be released
      xhr = null;
    };
    const fail = (rej: PutBlobBodyReject): void => {
      cleanup();
      reject(rej);
    };
    xhr.open('PUT', args.url, true);
    xhr.setRequestHeader('Content-Type', args.contentType);
    xhr.timeout = args.timeoutMs;

    xhr.onload = () => {
      if (xhr.status < 300) {
        cleanup();
        resolve({ statusNum: 0, statusText: '' });
        return;
      }
      fail({
        failure: 'http',
        statusNum: xhr.status,
        statusText: xhr.responseText || UPLOAD_FAILED_TEXT,
        httpStatus: xhr.status,
      });
    };
    xhr.onerror = () => {
      const httpStatus = xhr.status || undefined;
      fail({
        failure: 'network',
        statusNum: httpStatus ?? UPLOAD_NO_RESPONSE_STATUS,
        statusText: UPLOAD_FAILED_TEXT,
        httpStatus,
      });
    };
    xhr.onabort = () =>
      fail({
        failure: 'aborted',
        statusNum: UPLOAD_ABORTED_STATUS,
        statusText: UPLOAD_ABORTED_TEXT,
        httpStatus: UPLOAD_ABORTED_STATUS,
      });
    xhr.ontimeout = () =>
      fail({
        failure: 'timeout',
        statusNum: UPLOAD_TIMEOUT_STATUS,
        statusText: `upload timed out after ${args.timeoutMs}ms`,
        httpStatus: UPLOAD_TIMEOUT_STATUS,
      });
    // Send the Blob/File as-is: slice() would only add another wrapper.
    xhr.send(args.blob);
  });

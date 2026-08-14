import {
  isRetryableUploadError,
  runWithUploadRetries,
  suggestsConnectionProblem,
  uploadFailureReasonFromStatus,
  UploadFailureReason,
  UPLOAD_MAX_ATTEMPTS,
} from './uploadRetry';

describe('isRetryableUploadError', () => {
  it('does not retry 403 UploadFileReject', () => {
    expect(
      isRetryableUploadError({
        statusNum: 403,
        statusText: 'Forbidden',
        httpStatus: 403,
      })
    ).toBe(false);
  });

  it('does not retry 400 bad request', () => {
    expect(
      isRetryableUploadError({
        statusNum: 400,
        statusText: 'bad request',
        httpStatus: 400,
      })
    ).toBe(false);
  });

  it('retries network and 5xx errors', () => {
    expect(
      isRetryableUploadError({
        statusNum: 0,
        statusText: 'network error',
      })
    ).toBe(true);
    expect(
      isRetryableUploadError({
        statusNum: 503,
        statusText: 'unavailable',
        httpStatus: 503,
      })
    ).toBe(true);
    expect(
      isRetryableUploadError({
        statusNum: 408,
        statusText: 'timeout',
        httpStatus: 408,
      })
    ).toBe(true);
  });
});

describe('uploadFailureReasonFromStatus', () => {
  it.each([
    [undefined, UploadFailureReason.NoResponse],
    [0, UploadFailureReason.NoResponse],
    [408, UploadFailureReason.Timeout],
    [403, UploadFailureReason.Rejected],
    [429, UploadFailureReason.Rejected],
    [500, UploadFailureReason.ServerError],
    [503, UploadFailureReason.ServerError],
  ])('classifies %s as %s', (status, reason) => {
    expect(uploadFailureReasonFromStatus(status)).toBe(reason);
  });
});

describe('suggestsConnectionProblem', () => {
  it.each([[UploadFailureReason.NoResponse], [UploadFailureReason.Timeout]])(
    'is true for %s: the request never completed',
    (reason) => {
      expect(suggestsConnectionProblem({ reason })).toBe(true);
    }
  );

  it.each([
    [UploadFailureReason.Rejected, 403],
    [UploadFailureReason.ServerError, 500],
    [UploadFailureReason.UnsupportedType, undefined],
    [UploadFailureReason.TooBig, undefined],
    [UploadFailureReason.LocalWriteFailed, undefined],
  ])(
    'is false for %s: we reached the server, or never left the client',
    (reason, statusNum) => {
      expect(suggestsConnectionProblem({ reason, statusNum })).toBe(false);
    }
  );

  it('treats missing failure info as no evidence', () => {
    expect(suggestsConnectionProblem(undefined)).toBe(false);
  });
});

describe('runWithUploadRetries', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not retry permanent upload failures', async () => {
    const runAttempt = jest.fn().mockRejectedValue({
      statusNum: 403,
      statusText: 'Forbidden',
      httpStatus: 403,
    });
    const onRetry = jest.fn();

    await expect(
      runWithUploadRetries(runAttempt, onRetry)
    ).rejects.toMatchObject({ httpStatus: 403 });

    expect(runAttempt).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('retries transient failures up to UPLOAD_MAX_ATTEMPTS', async () => {
    const runAttempt = jest.fn().mockRejectedValue({
      statusNum: 503,
      statusText: 'down',
      httpStatus: 503,
    });
    const onRetry = jest.fn();

    const promise = runWithUploadRetries(runAttempt, onRetry);
    const assert = expect(promise).rejects.toMatchObject({ httpStatus: 503 });
    await jest.runAllTimersAsync();
    await assert;

    expect(runAttempt).toHaveBeenCalledTimes(UPLOAD_MAX_ATTEMPTS);
    expect(onRetry).toHaveBeenCalledTimes(UPLOAD_MAX_ATTEMPTS - 1);
  });
});

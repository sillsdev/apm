import {
  isFetchNetworkError,
  isUnauthorized,
  isTimeoutError,
  isRetryableError,
} from './httpError';
import { withNetworkRetry } from './networkRetry';
import { NetworkError } from '@orbit/jsonapi';

describe('isFetchNetworkError', () => {
  it('matches Failed to fetch / Network Error / NetworkError', () => {
    expect(isFetchNetworkError(new Error('Failed to fetch'))).toBe(true);
    expect(isFetchNetworkError(new Error('Network Error'))).toBe(true);
    expect(isFetchNetworkError(new NetworkError({} as any))).toBe(true);
    expect(isFetchNetworkError(new Error('API Error: 500'))).toBe(false);
    expect(isFetchNetworkError('Failed to fetch')).toBe(false);
  });
});

describe('isUnauthorized', () => {
  it('matches 401 across Orbit, axios, and bare status', () => {
    expect(isUnauthorized(401)).toBe(true);
    expect(isUnauthorized({ response: { status: 401 } })).toBe(true);
    expect(isUnauthorized({ errStatus: 401 })).toBe(true);
    expect(isUnauthorized({ status: 401 })).toBe(true);
    expect(isUnauthorized(403)).toBe(false);
    expect(isUnauthorized({ response: { status: 500 } })).toBe(false);
    expect(isUnauthorized(new Error('Failed to fetch'))).toBe(false);
  });
});

describe('isTimeoutError', () => {
  it('matches axios timeout codes and timeout messages', () => {
    expect(isTimeoutError({ code: 'ECONNABORTED', message: 'timeout' })).toBe(
      true
    );
    expect(isTimeoutError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isTimeoutError({ code: 'ERR_TIMED_OUT' })).toBe(true);
    expect(isTimeoutError(new Error('timeout of 10000ms exceeded'))).toBe(true);
    expect(isTimeoutError(new Error('Network Error'))).toBe(false);
  });
});

describe('isRetryableError', () => {
  it('includes network, timeout, and gateway statuses', () => {
    expect(isRetryableError(new Error('Failed to fetch'))).toBe(true);
    expect(isRetryableError({ code: 'ECONNABORTED' })).toBe(true);
    expect(isRetryableError({ response: { status: 408 } })).toBe(true);
    expect(isRetryableError({ response: { status: 502 } })).toBe(true);
    expect(isRetryableError({ response: { status: 503 } })).toBe(true);
    expect(isRetryableError({ response: { status: 504 } })).toBe(true);
    expect(isRetryableError({ response: { status: 500 } })).toBe(false);
    expect(isRetryableError({ response: { status: 401 } })).toBe(false);
    expect(isRetryableError({ response: { status: 404 } })).toBe(false);
  });
});

describe('withNetworkRetry', () => {
  it('returns on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(withNetworkRetry(fn, 3, 1)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries network errors then succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValue('ok');
    await expect(withNetworkRetry(fn, 3, 1)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries gateway errors then succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce({ response: { status: 503 } })
      .mockRejectedValueOnce({ response: { status: 504 } })
      .mockResolvedValue('ok');
    await expect(withNetworkRetry(fn, 3, 1)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries timeout errors then succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNABORTED', message: 'timeout' })
      .mockResolvedValue('ok');
    await expect(withNetworkRetry(fn, 3, 1)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting network retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Failed to fetch'));
    await expect(withNetworkRetry(fn, 3, 1)).rejects.toThrow('Failed to fetch');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(withNetworkRetry(fn, 3, 1)).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
